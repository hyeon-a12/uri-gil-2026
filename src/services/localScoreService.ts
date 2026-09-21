/**
 * "핵심기능3: 개인 맞춤형 관광지 추천" — 실시간 방문자 수 API가 없어서,
 * 이미 호출 중인 API 응답값만으로 "얼마나 로컬(덜 알려진) 스팟인가"를
 * 어림하는 프록시 점수를 계산합니다. 서버/DB 작업 없이 클라이언트에서만
 * 계산합니다.
 *
 * 점수는 50을 중립으로 두고, "이미 잘 알려졌다"는 신호가 있을 때마다
 * 점수를 올립니다 — 즉 낮을수록 로컬 스팟, 높을수록 인기 명소로 해석합니다.
 */

/**
 * 한국관광공사 두루누비 지역기반 목록(LocgoHubTarService1) 응답에서 나온
 * 장소의 로컬 점수 계산용 입력값입니다. 원본 API 응답을 그대로 넘길
 * 필요는 없고, 아래 필드만 채워서 넘기면 됩니다.
 */
export interface TourApiPlace {
  /** 관광지명(hubTatsNm 등). */
  name: string;
  /** 두루누비 응답의 hubRank(1위부터의 순위)를 0-based로 바꾼 값. 실제
   * API 응답을 까보면 이 필드가 그대로 들어있고(가나다순이 아님), 값이
   * 작을수록(=1위에 가까울수록) 이미 잘 알려진 관광지로 봅니다(역순
   * 가중치: 앞쪽 = 점수 상승 = 인기 명소 쪽). 거리순 등으로 다시 정렬한
   * 배열의 인덱스를 쓰면 안 됩니다 — 그건 "가까운 정도"지 "유명한 정도"가
   * 아니라서 신호가 틀어집니다. */
  rankIndex: number;
  /** hubRank의 분모가 되는 원본 응답 전체 개수(거리로 추려낸 개수가 아님). */
  totalCount: number;
  /** 이 장소가 속한 동네의 "맛집"+"카페" 밀집도(있으면). */
  nearbyPopularCount?: number;
}

/** 카카오 Local API(카테고리/키워드 검색) 결과 장소의 로컬 점수 계산용 입력값. */
export interface KakaoPlace {
  name: string;
  /** category_group_code. 관광명소는 'AT4'. */
  categoryGroupCode?: string;
  nearbyPopularCount?: number;
}

const NEUTRAL_SCORE = 50;
// a) 카카오 category_group_code가 관광명소(AT4)면 이미 유명할 가능성이
//    높다고 보고 점수를 올립니다(인기 명소 쪽).
const TOURIST_CATEGORY_BONUS = 30;
// c) 두루누비 응답 안에서의 순번 — 맨 앞(rankRatio=1)이면 +20, 맨 뒤
//    (rankRatio=0)면 -20 정도로 반영합니다.
const RANK_WEIGHT_RANGE = 40;
// b) 반경 내 "맛집"+"카페" 검색 결과 개수 — 붐비는 동네일수록(결과가
//    많을수록) 점수를 올리고, 한산한 동네일수록(결과가 적을수록) 점수를
//    내립니다. DENSITY_CAP 이상은 전부 "매우 붐빔"으로 취급해 클램프합니다.
const DENSITY_CAP = 20;
const DENSITY_WEIGHT_RANGE = 30;

function isTourApiPlace(place: TourApiPlace | KakaoPlace): place is TourApiPlace {
  return 'rankIndex' in place && 'totalCount' in place;
}

export function calculateLocalScore(place: TourApiPlace | KakaoPlace): number {
  let score = NEUTRAL_SCORE;

  if (!isTourApiPlace(place) && place.categoryGroupCode === 'AT4') {
    score += TOURIST_CATEGORY_BONUS;
  }

  if (isTourApiPlace(place) && place.totalCount > 1) {
    const rankRatio = 1 - place.rankIndex / (place.totalCount - 1); // 1(맨앞) ~ 0(맨뒤)
    score += (rankRatio - 0.5) * RANK_WEIGHT_RANGE;
  }

  if (typeof place.nearbyPopularCount === 'number') {
    const clamped = Math.max(0, Math.min(DENSITY_CAP, place.nearbyPopularCount));
    score += (clamped / DENSITY_CAP - 0.5) * DENSITY_WEIGHT_RANGE;
  }

  return score;
}

// hubRank 같은 신호가 "확실히 방문자 수 기반"이라고 공식 문서로 보장되진
// 않아서(가나다순이 아니라는 것과 큰 틀의 순위라는 정황만 확인됨), 이미
// 유명하다고 단정하는 "인기명소" 배지는 화면에 노출하지 않습니다. 점수
// 자체는 그대로 계산해서 정렬에는 씁니다 — 잘 알려진 곳들이 목록
// 뒤쪽으로 밀리는 효과는 유지하고, 배지로 단정하는 것만 뺀 겁니다.
export type LocalBadge = '로컬스팟';

export interface RankedPlace<T> {
  place: T;
  score: number;
  badge: LocalBadge | null;
}

const LOCAL_BADGE_RATIO = 0.4; // 하위 40%

/**
 * 장소 목록에 로컬 점수를 매기고, 오름차순(로컬 점수 낮은 = 로컬 스팟이
 * 앞, 잘 알려진 곳이 뒤)으로 정렬한 뒤 하위 40% 구간에 "로컬스팟" 배지를
 * 붙여서 돌려줍니다. 배지는 이 함수가 실제로 정렬한 결과를 기준으로만
 * 붙기 때문에, 화면에서 정렬과 배지가 어긋날 일이 없습니다.
 *
 * T는 화면이 쓰는 실제 장소 타입(예: RecommendedPlace)을 그대로 두고,
 * toSignals로 점수 계산에 필요한 최소 입력값만 뽑아서 넘기면 됩니다.
 */
export function rankByLocalScore<T>(
  places: T[],
  toSignals: (place: T) => TourApiPlace | KakaoPlace,
): RankedPlace<T>[] {
  const scored = places.map((place) => ({
    place,
    score: calculateLocalScore(toSignals(place)),
  }));

  const sorted = [...scored].sort((a, b) => a.score - b.score);
  const localCutoff = Math.ceil(sorted.length * LOCAL_BADGE_RATIO);

  return sorted.map((entry, index) => ({
    place: entry.place,
    score: entry.score,
    badge: index < localCutoff ? '로컬스팟' : null,
  }));
}
