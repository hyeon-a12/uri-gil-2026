// 클립을 "일자 + 장소"로 묶어서 여행 일정 타임라인을 만드는 로직.
//
// 앱에 아직 "핑/경로 계획" 저장 모델이 없어서, 실제로 트립별로 저장돼 있는 건
// recordingService의 클립뿐입니다. 그래서 일정은 클립을 장소명 기준으로 묶어서
// 만듭니다. my-route.tsx(활성 여행)와 trip-detail(임의의 여행 상세)이 이 로직을
// 공유합니다.

import { parseDateRange, type FolderItem } from '@/services/folderService';
import type { RecordingData } from '@/types/recording';

export interface PlanStop {
  id: string;
  order: number;
  name: string;
  day: number;
  time: string;
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

function formatClipDuration(durationMs?: number): string {
  const totalSeconds = Math.floor((durationMs ?? 0) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatClipTime(recordedAt: string): string {
  const date = new Date(recordedAt);
  return `${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes(),
  ).padStart(2, '0')}`;
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
): { stops: PlanStop[]; travelLogs: PlanTravelLog[]; dayNumbers: number[] } {
  const tripStart = trip ? parseDateRange(trip.dateRange)?.start ?? null : null;

  const sorted = [...recordings].sort((a, b) =>
    a.recordedAt.localeCompare(b.recordedAt),
  );

  const stopOrder: string[] = []; // 그룹 키의 최초 등장 순서
  const stopGroups = new Map<string, PlanStop>();
  const travelLogs: PlanTravelLog[] = [];

  for (const recording of sorted) {
    const day = dayIndexOf(recording.recordedAt, tripStart);
    const placeName = recording.location.placeName?.trim();

    const clip = {
      id: recording.id,
      thumbnail: recording.thumbnail,
      duration: formatClipDuration(recording.durationMs),
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
    const existing = stopGroups.get(groupKey);
    if (existing) {
      existing.clips.push(clip);
      continue;
    }

    stopOrder.push(groupKey);
    stopGroups.set(groupKey, {
      id: groupKey,
      order: stopOrder.length,
      name: placeName,
      day,
      time: formatClipTime(recording.recordedAt),
      clips: [clip],
    });
  }

  const stops = stopOrder.map((key) => stopGroups.get(key)!);
  const dayNumbers = Array.from(
    new Set([...stops.map((s) => s.day), ...travelLogs.map((l) => l.day)]),
  ).sort((a, b) => a - b);

  return { stops, travelLogs, dayNumbers };
}
