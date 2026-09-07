import AsyncStorage from '@react-native-async-storage/async-storage';

import { getCurrentUserId } from './authService';

const STORAGE_PREFIX = 'stop-memo:v1:';

/** stopId → 그 장소에 남긴 메모. */
export type StopMemoMap = Record<string, string>;

// 계정별로 메모를 분리하기 위해 user_id를 키에 섞습니다.
function storageKey(userId: string, tripId: string) {
  return `${STORAGE_PREFIX}${userId}:${tripId}`;
}

/** 여행에 저장된 장소별 메모를 불러옵니다. 로그인 전이거나 없으면 빈 객체. */
export async function getStopMemos(tripId: string): Promise<StopMemoMap> {
  const userId = await getCurrentUserId();
  if (!userId) return {};

  const raw = await AsyncStorage.getItem(storageKey(userId, tripId));
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
  const userId = await getCurrentUserId();
  if (!userId) return {};

  const existing = await getStopMemos(tripId);
  const next: StopMemoMap = { ...existing };

  if (text.trim().length > 0) {
    next[stopId] = text.trim();
  } else {
    delete next[stopId];
  }

  await AsyncStorage.setItem(storageKey(userId, tripId), JSON.stringify(next));
  return next;
}
