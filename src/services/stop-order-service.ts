import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_PREFIX = 'stop-order:v1:';

/** day(1부터) → 그 날짜 스톱들의 원하는 순서(id 배열). */
export type StopOrderMap = Record<number, string[]>;

function storageKey(tripId: string) {
  return `${STORAGE_PREFIX}${tripId}`;
}

/** 여행에 저장된 day별 커스텀 스톱 순서를 불러옵니다. 없으면 빈 객체. */
export async function getStopOrder(tripId: string): Promise<StopOrderMap> {
  const raw = await AsyncStorage.getItem(storageKey(tripId));
  if (!raw) return {};

  try {
    return JSON.parse(raw) as StopOrderMap;
  } catch {
    // 손상된 저장값은 화면을 멈추게 하지 않고 순서 없음으로 처리합니다.
    return {};
  }
}

/** 특정 day의 스톱 순서(드래그로 바꾼 결과)를 저장합니다. */
export async function saveStopOrder(
  tripId: string,
  day: number,
  orderedIds: string[],
): Promise<StopOrderMap> {
  const existing = await getStopOrder(tripId);
  const next: StopOrderMap = { ...existing, [day]: orderedIds };
  await AsyncStorage.setItem(storageKey(tripId), JSON.stringify(next));
  return next;
}

/**
 * 저장된 순서(orderedIds)대로 stops를 재배열합니다.
 * 저장된 목록에 없는 새 항목은 원래 상대 순서를 유지한 채 뒤로 밀려납니다.
 */
export function applyStopOrder<T extends { id: string }>(
  stops: T[],
  orderedIds: string[] | undefined,
): T[] {
  if (!orderedIds || orderedIds.length === 0) return stops;

  const priority = new Map(orderedIds.map((id, index) => [id, index]));

  return [...stops].sort((a, b) => {
    const aRank = priority.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const bRank = priority.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    return aRank - bRank;
  });
}
