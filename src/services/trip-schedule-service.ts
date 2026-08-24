import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_PREFIX = "trip-schedule:v1:";

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
  distanceFromPreviousMeters?: number;
  createdAt: string;
};

export type NewTripScheduleStop = Omit<
  TripScheduleStop,
  "id" | "tripId" | "order" | "createdAt"
>;

function storageKey(tripId: string) {
  return `${STORAGE_PREFIX}${tripId}`;
}

export async function getTripScheduleStops(
  tripId: string,
): Promise<TripScheduleStop[]> {
  const raw = await AsyncStorage.getItem(storageKey(tripId));
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
  await AsyncStorage.setItem(storageKey(tripId), JSON.stringify(saved));
  return saved;
}

export async function removeTripScheduleStop(
  tripId: string,
  stopId: string,
): Promise<TripScheduleStop[]> {
  const existing = await getTripScheduleStops(tripId);
  const remaining = existing
    .filter((stop) => stop.id !== stopId)
    .map((stop, index) => ({ ...stop, order: index + 1 }));

  await AsyncStorage.setItem(storageKey(tripId), JSON.stringify(remaining));
  return remaining;
}
