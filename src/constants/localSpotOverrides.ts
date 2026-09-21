/**
 * "핵심기능3: 개인 맞춤형 관광지 추천" 화면에서, 실시간 방문자 데이터가 없어
 * 점수(localScoreService.calculateLocalScore)로만 판정하기엔 데모/심사에서
 * 결과가 흔들릴 수 있는 장소를 수동으로 못박아두는 화이트리스트입니다.
 *
 * 여기 이름이 걸리는 장소는 점수 계산을 건너뛰고 지정된 태그를 그대로
 * 씁니다(localScoreService.rankByLocalScore 참고). lat/lng가 있는 항목은
 * 추천 API가 비어있거나 실패했을 때 보여줄 최소한의 폴백 카드로도 씁니다.
 */

export type LocalSpotBadge = '로컬스팟' | '인기명소';

export interface LocalSpotOverride {
  placeName: string;
  tag: LocalSpotBadge;
  /** API 실패/빈 응답 폴백 카드용 좌표. 화이트리스트 매칭에만 쓰고 폴백
   * 카드로는 쓸 필요 없는 항목은 생략해도 됩니다. */
  lat?: number;
  lng?: number;
  category?: string;
}

// 좌표는 전주 시내 실제 위치 기준 근사치입니다. 6곳을 둬서, API가 전부
// 막혀도 "최소 4~6개는 항상 보여준다" 기준을 넉넉히 만족합니다.
export const LOCAL_SPOT_OVERRIDES: LocalSpotOverride[] = [
  { placeName: '전주 한옥마을', tag: '인기명소', lat: 35.8155, lng: 127.152, category: '역사관광' },
  { placeName: '전동성당', tag: '인기명소', lat: 35.8125, lng: 127.1538, category: '역사관광' },
  { placeName: '객리단길', tag: '로컬스팟', lat: 35.8123, lng: 127.1467, category: '골목상권' },
  { placeName: '팔복예술공장', tag: '로컬스팟', lat: 35.8508, lng: 127.1298, category: '문화관광' },
  { placeName: '덕진공원', tag: '로컬스팟', lat: 35.8464, lng: 127.1436, category: '자연관광' },
  { placeName: '남부시장 청년몰', tag: '로컬스팟', lat: 35.8095, lng: 127.1448, category: '쇼핑' },
];

// 화이트리스트 이름 비교용 정규화 — 공백/붙임표/가운뎃점/괄호를 지우고
// 소문자로 맞춰서, "전주 한옥마을"과 "전주한옥마을" 같은 표기 차이나
// 카카오 API가 붙여주는 지점명 접미사(예: "전주 한옥마을(경기전)")도
// 부분 일치로 잡히게 합니다.
function normalize(value: string): string {
  return value.replace(/[\s\-_·/()]/g, '').toLowerCase();
}

export function findLocalSpotOverride(placeName: string): LocalSpotOverride | undefined {
  const normalized = normalize(placeName);
  if (!normalized) return undefined;
  return LOCAL_SPOT_OVERRIDES.find((entry) => {
    const normalizedEntry = normalize(entry.placeName);
    return normalized.includes(normalizedEntry) || normalizedEntry.includes(normalized);
  });
}

/** lat/lng가 채워진 항목만 — 추천 API가 실패/빈 응답일 때 폴백 카드로 씁니다. */
export const LOCAL_SPOT_FALLBACK_PLACES = LOCAL_SPOT_OVERRIDES.filter(
  (entry): entry is LocalSpotOverride & { lat: number; lng: number } =>
    typeof entry.lat === 'number' && typeof entry.lng === 'number',
);
