import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_PREFIX = "trip-transit-log:v1:";

// 이동 중 기록은 장소 영상과 구분되는 사진 스냅 전용입니다.
export type TransitLogKind = "photo";

export type TransitLog = {
  id: string;
  tripId: string;
  kind: TransitLogKind;
  /** 사진 기록일 때의 로컬 URI. */
  assetUri?: string;
  /** 기기 사진첩에 있는 원본 자산 ID. 존재할 때만 사진첩 원본 삭제가 가능합니다. */
  mediaLibraryAssetId?: string;
  /** 한 줄 기록 또는 사진 설명. */
  text?: string;
  /** ISO 8601 형식. */
  recordedAt: string;
  /** 이동 기록을 남긴 날. 현재 일정 UI에서는 Day 1을 기본값으로 사용합니다. */
  day: number;
  previousStopId?: string;
  nextStopId?: string;
  createdAt: string;
};

export type NewTransitLog = Omit<TransitLog, "id" | "tripId" | "createdAt">;

function storageKey(tripId: string) {
  return `${STORAGE_PREFIX}${tripId}`;
}

export async function getTransitLogs(tripId: string): Promise<TransitLog[]> {
  const raw = await AsyncStorage.getItem(storageKey(tripId));
  if (!raw) return [];

  try {
    const logs = JSON.parse(raw) as TransitLog[];
    return [...logs].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
  } catch {
    return [];
  }
}

export async function addTransitLog(
  tripId: string,
  log: NewTransitLog,
): Promise<TransitLog> {
  const existing = await getTransitLogs(tripId);
  const now = new Date().toISOString();
  const newLog: TransitLog = {
    ...log,
    id: `transit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tripId,
    createdAt: now,
  };

  await AsyncStorage.setItem(
    storageKey(tripId),
    JSON.stringify([newLog, ...existing]),
  );
  return newLog;
}

export async function removeTransitLog(
  tripId: string,
  logId: string,
): Promise<TransitLog[]> {
  const existing = await getTransitLogs(tripId);
  const remaining = existing.filter((log) => log.id !== logId);
  await AsyncStorage.setItem(storageKey(tripId), JSON.stringify(remaining));
  return remaining;
}
