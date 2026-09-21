import AsyncStorage from "@react-native-async-storage/async-storage";

import { getCurrentUserId } from './authService';

const STORAGE_PREFIX = "trip-schedule:v1:";

// appendTripScheduleStops/removeTripScheduleStop은 "전체 목록을 읽고 → 수정하고 →
// 통째로 다시 쓰는" 패턴이라, 두 호출이 겹치면(AI 추천 확정 저장과 스톱 삭제가
// 동시에 일어나는 등) 나중에 끝난 쪽이 먼저 쓴 걸 덮어써서 스톱이 사라질 수
// 있습니다(folderService.ts/recordingService.ts에 있던 것과 같은 문제). 이
// 모듈을 드나드는 모든 쓰기를 한 줄로 직렬화해서 막습니다.
let writeQueue: Promise<unknown> = Promise.resolve();

function withWriteLock<T>(task: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(task, task);
  writeQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export type TripScheduleStop = {
  id: string;
  tripId: string;
  source: "ai-recommendation" | "manual";
  placeId: string;
  title: string;
  address: string;
  category: string;
  latitude: number;
  longitude: number;
  order: number;
  /** 여행 시작일 기준 며칠째 일정인지 (1부터 시작). 예전에 저장된 값엔 없을 수 있어 optional. */
  day?: number;
  distanceFromPreviousMeters?: number;
  createdAt: string;
};

export type NewTripScheduleStop = Omit<
  TripScheduleStop,
  "id" | "tripId" | "order" | "createdAt"
>;

// 계정별로 일정을 분리하기 위해 user_id를 키에 섞습니다.
function storageKey(userId: string, tripId: string) {
  return `${STORAGE_PREFIX}${userId}:${tripId}`;
}

export async function getTripScheduleStops(
  tripId: string,
): Promise<TripScheduleStop[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const raw = await AsyncStorage.getItem(storageKey(userId, tripId));
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as TripScheduleStop[];
    return [...parsed].sort((a, b) => a.order - b.order);
  } catch {
    // 손상된 저장값은 화면을 멈추게 하지 않고 비어 있는 일정으로 처리합니다.
    return [];
  }
}

/**
 * AI에서 확정한 장소를 일정 마지막에 추가합니다.
 * 이미 같은 placeId가 저장돼 있다면 중복 저장하지 않습니다.
 */
export async function appendTripScheduleStops(
  tripId: string,
  stops: NewTripScheduleStop[],
): Promise<TripScheduleStop[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  return withWriteLock(async () => {
    const existing = await getTripScheduleStops(tripId);
    const existingPlaceIds = new Set(existing.map((stop) => stop.placeId));
    const now = new Date().toISOString();

    const newStops = stops
      .filter((stop) => !existingPlaceIds.has(stop.placeId))
      .map((stop, index) => ({
        ...stop,
        id: `schedule-${Date.now()}-${index}-${Math.random()
          .toString(36)
          .slice(2, 8)}`,
        tripId,
        order: existing.length + index + 1,
        createdAt: now,
      }));

    const saved = [...existing, ...newStops];
    await AsyncStorage.setItem(storageKey(userId, tripId), JSON.stringify(saved));
    return saved;
  });
}

export async function removeTripScheduleStop(
  tripId: string,
  stopId: string,
): Promise<TripScheduleStop[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  return withWriteLock(async () => {
    const existing = await getTripScheduleStops(tripId);
    const remaining = existing
      .filter((stop) => stop.id !== stopId)
      .map((stop, index) => ({ ...stop, order: index + 1 }));

    await AsyncStorage.setItem(storageKey(userId, tripId), JSON.stringify(remaining));
    return remaining;
  });
}
