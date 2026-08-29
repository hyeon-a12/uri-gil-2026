import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_PREFIX = 'stop-memo:v1:';

/** stopId → 그 장소에 남긴 메모. */
export type StopMemoMap = Record<string, string>;

function storageKey(tripId: string) {
  return `${STORAGE_PREFIX}${tripId}`;
}

/** 여행에 저장된 장소별 메모를 불러옵니다. 없으면 빈 객체. */
export async function getStopMemos(tripId: string): Promise<StopMemoMap> {
  const raw = await AsyncStorage.getItem(storageKey(tripId));
  if (!raw) return {};

  try {
    return JSON.parse(raw) as StopMemoMap;
  } catch {
    // 손상된 저장값은 화면을 멈추게 하지 않고 메모 없음으로 처리합니다.
    return {};
  }
}

/** 특정 장소의 메모를 저장합니다. 빈 문자열이면 메모를 지웁니다. */
export async function saveStopMemo(
  tripId: string,
  stopId: string,
  text: string,
): Promise<StopMemoMap> {
  const existing = await getStopMemos(tripId);
  const next: StopMemoMap = { ...existing };

  if (text.trim().length > 0) {
    next[stopId] = text.trim();
  } else {
    delete next[stopId];
  }

  await AsyncStorage.setItem(storageKey(tripId), JSON.stringify(next));
  return next;
}
