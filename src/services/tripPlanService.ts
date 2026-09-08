// 클립을 "일자 + 장소"로 묶어서 여행 일정 타임라인을 만드는 로직.
//
// 여기에 더해, AI 추천 검색에서 확정해 저장해둔 장소(trip-schedule-service)가
// 있으면 그 장소들도 일정 맨 앞에 스톱으로 끼워 넣습니다 — 실제 촬영은 아직
// 안 했지만 "가기로 확정한 곳"이라는 뜻입니다. my-route.tsx(활성 여행)와
// trip-detail(임의의 여행 상세)이 이 로직을 공유합니다.

import { parseDateRange, type FolderItem } from '@/services/folderService';
import type { TripScheduleStop } from '@/services/trip-schedule-service';
import { applyStopOrder, type StopOrderMap } from '@/services/stop-order-service';
import type { RecordingData } from '@/types/recording';

export interface PlanStop {
  id: string;
  order: number;
  name: string;
  day: number;
  time: string;
  /** AI 추천을 확정해서 추가된 스톱인지, 직접 검색해서 추가한 스톱인지, 실제 촬영 기록에서 만들어진 스톱인지 구분합니다. */
  source?: 'ai-recommendation' | 'manual' | 'recording';
  /** 지도에 핀을 찍기 위한 좌표. 좌표를 알 수 없는 스톱은 null. */
  latitude: number | null;
  longitude: number | null;
  clips: {
    id: string;
    thumbnail: string;
    duration: string;
    /** 클립 관리 화면과 동일한 영상 미리보기(ClipPreviewModal)를 열기 위한 정보 */
    uri: string;
    recordedAt: string;
    durationMs?: number;
  }[];
}

export interface PlanTravelLog {
  id: string;
  day: number;
  time: string;
  thumbnail: string;
}

function formatClipDuration(durationMs?: number): string {
  const totalSeconds = Math.floor((durationMs ?? 0) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function formatClipTime(recordedAt: string): string {
  const date = new Date(recordedAt);
  return `${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes(),
  ).padStart(2, '0')}`;
}

/** day 탭/제목 라벨: 여행 시작일을 알면 "7/7"처럼 실제 날짜로, 모르면 "1일차"로 대체합니다. */
export function getDayLabel(day: number, _tripStartDate: Date | null): string {
  return `DAY ${day}`;
}

/** 여행 시작일 기준 며칠째인지 (1부터 시작). 기간을 못 읽으면 항상 1일차로 취급. */
function dayIndexOf(recordedAt: string, tripStart: Date | null): number {
  if (!tripStart) return 1;
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const recordedDate = new Date(recordedAt);
  const diff = Math.floor(
    (new Date(
      recordedDate.getFullYear(),
      recordedDate.getMonth(),
      recordedDate.getDate(),
    ).getTime() -
      new Date(
        tripStart.getFullYear(),
        tripStart.getMonth(),
        tripStart.getDate(),
      ).getTime()) /
      MS_PER_DAY,
  );
  return Math.max(1, diff + 1);
}

/**
 * 클립을 "같은 날 + 같은 장소명"끼리 묶어 일정 타임라인용 스톱으로 만듭니다.
 * 장소명이 없는 클립(placeName 미입력)은 스톱으로 묶지 않고 '이동 중 기록'으로 뺍니다.
 */
export function buildPlanData(
  recordings: RecordingData[],
  trip: FolderItem | null,
  savedScheduleStops: TripScheduleStop[] = [],
  stopOrderOverrides: StopOrderMap = {},
): { stops: PlanStop[]; travelLogs: PlanTravelLog[]; dayNumbers: number[] } {
  const tripStart = trip ? parseDateRange(trip.dateRange)?.start ?? null : null;

  const sorted = [...recordings].sort((a, b) =>
    a.recordedAt.localeCompare(b.recordedAt),
  );

  const stopOrder: string[] = []; // 그룹 키의 최초 등장 순서
  const stopGroups = new Map<string, PlanStop>();
  // 그룹(day+장소명)에 "클립 추가" 버튼으로 명시적으로 연결된 스톱 id가 있으면
  // 여기 기록해둡니다 — 아래에서 이름이 아니라 이 id로만 aiStops와 합칩니다.
  const groupLinkedStopId = new Map<string, string>();
  // 스톱 id → 생성 시각(ISO). 같은 day 안에서 "먼저 생긴 스톱이 위, 나중에
  // 추가된 스톱이 아래"가 되도록 정렬할 때 씁니다 — 이게 없으면 이미 클립을
  // 찍어둔 장소를 나중에 "직접 추가"로 또 넣었을 때 새 스톱이 기존 스톱보다
  // 위로 가버립니다.
  const stopCreatedAt = new Map<string, string>();
  const travelLogs: PlanTravelLog[] = [];

  for (const recording of sorted) {
    const day = dayIndexOf(recording.recordedAt, tripStart);
    const placeName = recording.location.placeName?.trim();

    const clip = {
      id: recording.id,
      thumbnail: recording.thumbnail,
      duration: formatClipDuration(recording.durationMs),
      uri: recording.videoUri,
      recordedAt: recording.recordedAt,
      durationMs: recording.durationMs,
    };

    if (!placeName) {
      travelLogs.push({
        id: recording.id,
        day,
        time: formatClipTime(recording.recordedAt),
        thumbnail: recording.thumbnail,
      });
      continue;
    }

    const groupKey = `${day}::${placeName}`;

    if (recording.location.linkedStopId && !groupLinkedStopId.has(groupKey)) {
      groupLinkedStopId.set(groupKey, recording.location.linkedStopId);
    }

    const existing = stopGroups.get(groupKey);
    if (existing) {
      existing.clips.push(clip);
      continue;
    }

    // sorted는 recordedAt 오름차순이라, 그룹을 처음 만드는 이 시점의
    // recordedAt이 곧 이 장소를 "처음 방문/촬영한" 시각입니다.
    stopCreatedAt.set(groupKey, recording.recordedAt);

    stopOrder.push(groupKey);
    stopGroups.set(groupKey, {
      id: groupKey,
      order: stopOrder.length,
      name: placeName,
      day,
      time: formatClipTime(recording.recordedAt),
      latitude: recording.location.latitude,
      longitude: recording.location.longitude,
      clips: [clip],
    });
  }

  const recordedStops = stopOrder.map((key) => stopGroups.get(key)!);
  const aiStops: PlanStop[] = savedScheduleStops.map((stop) => {
    stopCreatedAt.set(stop.id, stop.createdAt);
    return {
      id: stop.id,
      order: 0, // 아래에서 전체 순서를 다시 매길 때 덮어씌워집니다.
      name: stop.title,
      day: stop.day ?? 1,
      time: stop.source === 'manual' ? '직접 추가' : 'AI 추천',
      source: stop.source,
      latitude: stop.latitude,
      longitude: stop.longitude,
      clips: [],
    };
  });

  // 이미 확정된 스톱(AI 추천/직접 추가)의 "클립 추가" 버튼으로 찍은 클립은 그
  // 스톱에 명시적으로 연결된 id(linkedStopId)로만 합칩니다. 예전에는 "같은
  // 날짜 + 같은 장소명"이면 무조건 합쳤는데, 그러면 이미 클립을 찍어둔 장소를
  // 장소 검색으로 "직접 추가"만 해도(별도 스톱을 새로 만들려던 것) 이름이
  // 같다는 이유로 기존 스톱에 합쳐져 버려서 순서가 뒤섞이고, 병합된 스톱은
  // source가 'manual'로 남아 화면에 클립 개수 대신 "직접 추가한 장소"만 표시되는
  // 문제가 있었습니다. id로 정확히 연결된 경우만 합치고, 그 외에는(이름만 같은
  // 경우 포함) 항상 별개의 새 스톱으로 남겨둡니다.
  const unmatchedRecordedStops: PlanStop[] = [];
  for (const recorded of recordedStops) {
    const linkedStopId = groupLinkedStopId.get(recorded.id);
    const matchingAiStop = linkedStopId
      ? aiStops.find((ai) => ai.id === linkedStopId)
      : undefined;
    if (matchingAiStop) {
      matchingAiStop.clips.push(...recorded.clips);
      matchingAiStop.time = recorded.time;
      continue;
    }
    unmatchedRecordedStops.push(recorded);
  }

  // 같은 day 안에서는 기본적으로 먼저 생긴(먼저 촬영했거나 먼저 추가한) 스톱이
  // 위, 나중에 생긴 스톱이 아래에 오도록 시간순으로 둡니다 — 이미 클립을 찍어둔
  // 장소를 나중에 "직접 추가"로 또 넣어도 새 스톱이 기존 것 아래로 들어갑니다.
  // 사용자가 드래그로 순서를 바꿔서 저장해뒀다면(stopOrderOverrides) 그 순서를
  // day별로 우선 적용한 뒤 전체 순번을 다시 매깁니다.
  const combinedStops = [...aiStops, ...unmatchedRecordedStops].sort((a, b) => {
    const aTime = stopCreatedAt.get(a.id) ?? '';
    const bTime = stopCreatedAt.get(b.id) ?? '';
    return aTime.localeCompare(bTime);
  });

  const byDay = new Map<number, PlanStop[]>();
  for (const stop of combinedStops) {
    const list = byDay.get(stop.day) ?? [];
    list.push(stop);
    byDay.set(stop.day, list);
  }

  const stops = Array.from(byDay.keys())
    .sort((a, b) => a - b)
    .flatMap((day) => applyStopOrder(byDay.get(day)!, stopOrderOverrides[day]))
    .map((stop, index) => ({
      ...stop,
      order: index + 1,
    }));

  const actualDayNumbers = new Set([
    ...stops.map((s) => s.day),
    ...travelLogs.map((l) => l.day),
  ]);

  // 아직 클립이 없는 날짜도 "N박 M일" 전체 기간만큼 day 탭이 미리 보이도록,
  // 여행 기간(dateRange)으로 전체 day 범위를 채워 넣습니다. 촬영 기록이 기간
  // 밖의 날짜에 찍혀 있는 경우를 대비해 실제 day 값도 함께 합쳐줍니다.
  const tripEnd = trip ? parseDateRange(trip.dateRange)?.end ?? null : null;
  if (tripStart && tripEnd) {
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    // tripEnd는 종료일 23:59:59라서 Math.round를 쓰면 하루가 더 잡힙니다.
    // Math.floor로 정확한 박 수를 구한 뒤 +1(일수)을 더합니다.
    const totalDays = Math.max(
      1,
      Math.floor((tripEnd.getTime() - tripStart.getTime()) / MS_PER_DAY) + 1,
    );
    for (let day = 1; day <= totalDays; day++) {
      actualDayNumbers.add(day);
    }
  }

  const dayNumbers = Array.from(actualDayNumbers).sort((a, b) => a - b);

  return { stops, travelLogs, dayNumbers };
}
