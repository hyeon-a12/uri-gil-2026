import AsyncStorage from "@react-native-async-storage/async-storage";

import { getCurrentUserId } from './authService';
import { getAllFolders } from './folderService';
import { apiFetch } from './api';

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
  /** 서버(RouteSpot) 쪽 id. 이 기기에서 만들어서 아직 서버 저장이 안 됐거나
   * 실패했으면 없을 수 있습니다 — 그 경우 삭제해도 서버엔 지울 게 없습니다. */
  serverId?: number;
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
  "id" | "tripId" | "order" | "createdAt" | "serverId"
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
async function setStopServerId(
  userId: string,
  tripId: string,
  stopId: string,
  serverId: number,
): Promise<void> {
  await withWriteLock(async () => {
    const raw = await AsyncStorage.getItem(storageKey(userId, tripId));
    if (!raw) return;
    try {
      const stops = JSON.parse(raw) as TripScheduleStop[];
      const updated = stops.map((s) => (s.id === stopId ? { ...s, serverId } : s));
      await AsyncStorage.setItem(storageKey(userId, tripId), JSON.stringify(updated));
    } catch {
      // 손상된 저장값이면 조용히 넘어갑니다 — 다음 저장 때 정상 구조로 복구됩니다.
    }
  });
}

export async function appendTripScheduleStops(
  tripId: string,
  stops: NewTripScheduleStop[],
): Promise<TripScheduleStop[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const { saved, newStops } = await withWriteLock(async () => {
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
    return { saved, newStops };
  });

  // 서버에도 장소 저장 시도 (실패해도 로컬 저장은 이미 끝났으니 무시). routeId가
  // 없으면(오프라인 생성 등) 서버에 보낼 곳이 없으니 건너뜁니다. RouteSpot
  // 스키마엔 day(며칠째 일정인지)가 없어서, 다른 기기가 이 장소를 받아와도
  // 어느 날짜에 넣을지는 알 수 없습니다 — 지금은 "이 기기에서 만든 게 서버에서
  // 안 사라짐" 수준의 백업이고, 다른 기기 화면에 자동으로 나타나진 않습니다.
  if (newStops.length > 0) {
    try {
      const folders = await getAllFolders();
      const folder = folders.find((f) => f.id === tripId);

      if (folder?.routeId) {
        for (const stop of newStops) {
          try {
            const created = await apiFetch('/spots/', {
              method: 'POST',
              body: JSON.stringify({
                route_id: folder.routeId,
                spot_name: stop.title,
                latitude: stop.latitude,
                longitude: stop.longitude,
                visit_order: stop.order,
                visited_at: null,
              }),
            });

            if (created?.id) {
              await setStopServerId(userId, tripId, stop.id, created.id);
            }
          } catch (serverError) {
            console.error('[trip-schedule-service] 서버 장소 저장 실패:', serverError);
          }
        }
      }
    } catch (error) {
      console.error('[trip-schedule-service] 여행 정보 조회 실패:', error);
    }
  }

  return saved;
}

export async function removeTripScheduleStop(
  tripId: string,
  stopId: string,
): Promise<TripScheduleStop[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const { remaining, removedServerId } = await withWriteLock(async () => {
    const existing = await getTripScheduleStops(tripId);
    const target = existing.find((stop) => stop.id === stopId);
    const remaining = existing
      .filter((stop) => stop.id !== stopId)
      .map((stop, index) => ({ ...stop, order: index + 1 }));

    await AsyncStorage.setItem(storageKey(userId, tripId), JSON.stringify(remaining));
    return { remaining, removedServerId: target?.serverId };
  });

  // 서버에도 삭제 반영 시도 (실패해도 로컬 삭제는 이미 끝났으니 무시)
  if (removedServerId) {
    try {
      await apiFetch(`/spots/${removedServerId}`, { method: 'DELETE' });
    } catch (serverError) {
      console.error('[trip-schedule-service] 서버 장소 삭제 실패:', serverError);
    }
  }

  return remaining;
}
