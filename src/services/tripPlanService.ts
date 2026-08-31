// 클립을 "일자 + 장소"로 묶어서 여행 일정 타임라인을 만드는 로직.
//
// AI 추천/직접 추가 장소와 실제 촬영 기록을 하나의 일정으로 합칩니다.
// 촬영 기록의 GPS가 존재하면 RoutePlanView에서 실제 지도 경로를 그릴 수 있도록
// latitude / longitude를 PlanStop에 전달합니다.

import {
  parseDateRange,
  type FolderItem,
} from '@/services/folderService';

import type { TripScheduleStop } from '@/services/trip-schedule-service';

import {
  applyStopOrder,
  type StopOrderMap,
} from '@/services/stop-order-service';

import type { RecordingData } from '@/types/recording';

export interface PlanStop {
  id: string;

  order: number;

  name: string;

  day: number;

  time: string;

  /**
   * AI 추천 / 직접 추가 / 실제 촬영 장소 구분
   */
  source?: 'ai-recommendation' | 'manual' | 'recording';

  /**
   * 실제 지도에 표시할 좌표
   */
  latitude: number | null;

  longitude: number | null;

  clips: {
    id: string;

    thumbnail: string;

    duration: string;
  }[];
}

export interface PlanTravelLog {
  id: string;

  day: number;

  time: string;

  thumbnail: string;
}

/* ============================================================
 * 유틸
 * ============================================================ */

function formatClipDuration(
  durationMs?: number,
): string {
  const totalSeconds = Math.floor(
    (durationMs ?? 0) / 1000,
  );

  const minutes = Math.floor(
    totalSeconds / 60,
  );

  const seconds =
    totalSeconds % 60;

  return `${String(minutes).padStart(
    2,
    '0',
  )}:${String(seconds).padStart(
    2,
    '0',
  )}`;
}

export function formatClipTime(
  recordedAt: string,
): string {
  const date =
    new Date(recordedAt);

  return `${String(
    date.getHours(),
  ).padStart(2, '0')}:${String(
    date.getMinutes(),
  ).padStart(2, '0')}`;
}

/**
 * DAY 1 / DAY 2 형태
 */
export function getDayLabel(
  day: number,
  _tripStartDate: Date | null,
): string {
  return `DAY ${day}`;
}

/**
 * 여행 시작일 기준 몇 일차인지 계산
 */
function dayIndexOf(
  recordedAt: string,
  tripStart: Date | null,
): number {
  if (!tripStart) {
    return 1;
  }

  const MS_PER_DAY =
    24 * 60 * 60 * 1000;

  const recordedDate =
    new Date(recordedAt);

  const recordedDay =
    new Date(
      recordedDate.getFullYear(),
      recordedDate.getMonth(),
      recordedDate.getDate(),
    ).getTime();

  const tripStartDay =
    new Date(
      tripStart.getFullYear(),
      tripStart.getMonth(),
      tripStart.getDate(),
    ).getTime();

  const diff =
    Math.floor(
      (recordedDay -
        tripStartDay) /
      MS_PER_DAY,
    );

  return Math.max(
    1,
    diff + 1,
  );
}

/**
 * latitude / longitude 값 검증
 */
function normalizeCoordinate(
  value: unknown,
): number | null {
  if (
    typeof value === 'number' &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (
    typeof value === 'string'
  ) {
    const parsed =
      Number(value);

    if (
      Number.isFinite(parsed)
    ) {
      return parsed;
    }
  }

  return null;
}

/* ============================================================
 * BUILD PLAN DATA
 * ============================================================ */

export function buildPlanData(
  recordings: RecordingData[],
  trip: FolderItem | null,

  savedScheduleStops: TripScheduleStop[] = [],

  stopOrderOverrides: StopOrderMap = {},
): {
  stops: PlanStop[];

  travelLogs: PlanTravelLog[];

  dayNumbers: number[];
} {
  const tripStart =
    trip
      ? parseDateRange(
        trip.dateRange,
      )?.start ?? null
      : null;

  /* ----------------------------------------------------------
   * 녹화 시간순 정렬
   * ---------------------------------------------------------- */

  const sorted = [
    ...recordings,
  ].sort((a, b) =>
    a.recordedAt.localeCompare(
      b.recordedAt,
    ),
  );

  const stopOrder: string[] =
    [];

  const stopGroups =
    new Map<
      string,
      PlanStop
    >();

  const travelLogs: PlanTravelLog[] =
    [];

  /* ----------------------------------------------------------
   * 실제 촬영 기록 → 장소 스톱
   * ---------------------------------------------------------- */

  for (const recording of sorted) {
    const day =
      dayIndexOf(
        recording.recordedAt,
        tripStart,
      );

    const placeName =
      recording.location
        ?.placeName?.trim();

    const latitude =
      normalizeCoordinate(
        recording.location
          ?.latitude,
      );

    const longitude =
      normalizeCoordinate(
        recording.location
          ?.longitude,
      );

    const clip = {
      id: recording.id,

      thumbnail:
        recording.thumbnail,

      duration:
        formatClipDuration(
          recording.durationMs,
        ),
    };

    /*
     * 장소 이름이 없는 영상은
     * 이동 중 기록으로 처리
     */
    if (!placeName) {
      travelLogs.push({
        id: recording.id,

        day,

        time:
          formatClipTime(
            recording.recordedAt,
          ),

        thumbnail:
          recording.thumbnail,
      });

      continue;
    }

    /*
     * 같은 날짜 + 같은 장소는
     * 하나의 스톱으로 묶음
     */
    const groupKey =
      `${day}::${placeName}`;

    const existing =
      stopGroups.get(
        groupKey,
      );

    if (existing) {
      existing.clips.push(
        clip,
      );

      /*
       * 중요:
       *
       * 첫 번째 영상에는 GPS가 없었는데
       * 같은 장소에서 찍은 이후 영상에는 GPS가 있다면
       * 그 GPS를 스톱에 반영
       */
      if (
        existing.latitude ===
        null &&
        latitude !== null
      ) {
        existing.latitude =
          latitude;
      }

      if (
        existing.longitude ===
        null &&
        longitude !== null
      ) {
        existing.longitude =
          longitude;
      }

      continue;
    }

    stopOrder.push(
      groupKey,
    );

    stopGroups.set(
      groupKey,
      {
        id: groupKey,

        order:
          stopOrder.length,

        name:
          placeName,

        day,

        time:
          formatClipTime(
            recording.recordedAt,
          ),

        source:
          'recording',

        latitude,

        longitude,

        clips: [
          clip,
        ],
      },
    );
  }

  /* ----------------------------------------------------------
   * 실제 촬영 장소
   * ---------------------------------------------------------- */

  const recordedStops =
    stopOrder.map(
      (key) =>
        stopGroups.get(
          key,
        )!,
    );

  /* ----------------------------------------------------------
   * AI 추천 / 직접 추가 장소
   * ---------------------------------------------------------- */

  const scheduleStops: PlanStop[] =
    savedScheduleStops.map(
      (stop) => ({
        id: stop.id,

        order: 0,

        name:
          stop.title,

        day:
          stop.day ?? 1,

        time:
          stop.source ===
            'manual'
            ? '직접 추가'
            : 'AI 추천',

        source:
          stop.source,

        latitude:
          normalizeCoordinate(
            stop.latitude,
          ),

        longitude:
          normalizeCoordinate(
            stop.longitude,
          ),

        clips: [],
      }),
    );

  /* ----------------------------------------------------------
   * 날짜별 그룹
   * ---------------------------------------------------------- */

  const byDay =
    new Map<
      number,
      PlanStop[]
    >();

  for (const stop of [
    ...scheduleStops,
    ...recordedStops,
  ]) {
    const list =
      byDay.get(
        stop.day,
      ) ?? [];

    list.push(
      stop,
    );

    byDay.set(
      stop.day,
      list,
    );
  }

  /* ----------------------------------------------------------
   * 사용자 지정 순서 적용
   * ---------------------------------------------------------- */

  const stops =
    Array.from(
      byDay.keys(),
    )
      .sort(
        (a, b) =>
          a - b,
      )
      .flatMap(
        (day) =>
          applyStopOrder(
            byDay.get(day)!,
            stopOrderOverrides[
            day
            ],
          ),
      )
      /*
       * 중요:
       *
       * 전체 여행 기준 번호가 아니라
       * 각 DAY 내부에서 1부터 번호 시작
       */
      .map(
        (
          stop,
        ) => ({
          ...stop,
        }),
      );

  /*
   * day별 order 다시 계산
   */
  const dayOrderMap =
    new Map<
      number,
      number
    >();

  const orderedStops =
    stops.map(
      (stop) => {
        const nextOrder =
          (dayOrderMap.get(
            stop.day,
          ) ?? 0) + 1;

        dayOrderMap.set(
          stop.day,
          nextOrder,
        );

        return {
          ...stop,

          order:
            nextOrder,
        };
      },
    );

  /* ----------------------------------------------------------
   * DAY 목록 생성
   * ---------------------------------------------------------- */

  const actualDayNumbers =
    new Set<number>([
      ...orderedStops.map(
        (stop) =>
          stop.day,
      ),

      ...travelLogs.map(
        (log) =>
          log.day,
      ),
    ]);

  /*
   * 여행 기간에 해당하는 DAY를 전부 생성
   */
  const tripEnd =
    trip
      ? parseDateRange(
        trip.dateRange,
      )?.end ?? null
      : null;

  if (
    tripStart &&
    tripEnd
  ) {
    const MS_PER_DAY =
      24 *
      60 *
      60 *
      1000;

    const totalDays =
      Math.max(
        1,

        Math.floor(
          (tripEnd.getTime() -
            tripStart.getTime()) /
          MS_PER_DAY,
        ) + 1,
      );

    for (
      let day = 1;
      day <= totalDays;
      day++
    ) {
      actualDayNumbers.add(
        day,
      );
    }
  }

  /*
   * 데이터가 전혀 없어도
   * DAY 1은 존재
   */
  if (
    actualDayNumbers.size ===
    0
  ) {
    actualDayNumbers.add(
      1,
    );
  }

  const dayNumbers =
    Array.from(
      actualDayNumbers,
    ).sort(
      (a, b) =>
        a - b,
    );

  return {
    stops:
      orderedStops,

    travelLogs,

    dayNumbers,
  };
}