import { useCallback, useEffect, useMemo, useState, type ComponentProps } from 'react';
import { ActivityIndicator, Image as RNImage, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import { AppText as Text } from '@/components/AppText';
import { AppHeader } from '@/components/web/AppHeader.web';
import { useTripStore } from '@/store/useTripStore';
import { getAllRecordings } from '@/services/recordingService';
import { getMergedRecordingsByFolder } from '@/services/spotSyncService';
import NewTripModal from '@/components/NewTripModal';
import { useCreateTripModal } from '@/hooks/useCreateTripModal';
import type { RecordingData } from '@/types/recording';
import type { ClipItem } from '@/types/home';
import {
  PlaceDetailModal,
  fetchKakaoPlaceInfo,
  type KakaoPlaceInfo,
  type PlaceDetailView,
} from '@/components/PlaceDetail/PlaceDetailModal';
import { useWebSheetStore } from '@/store/useWebSheetStore';
import {
  rankByLocalScore,
  type KakaoPlace as KakaoScoreInput,
  type TourApiPlace as TourApiScoreInput,
} from '@/services/localScoreService';

/**
 * HomeScreen.tsx(네이티브, 전체화면 지도+바텀시트+AI추천 오버레이)의
 * 웹 버전입니다. 팀 결정에 따라 지도/검색바/알림 아이콘/AI 추천 동선을
 * 전부 빼고, Manus 프로토타입의 Home 디자인(진행 중인 여행 카드 + 추천
 * 장소 그리드 + 오늘의 순간들)으로 완전히 새로 구성했습니다.
 *
 * "진행 중인 여행" 유무는 프로토타입처럼 화면 안의 토글 버튼으로 임의로
 * 바꾸는 게 아니라, 실제 useTripStore.currentTrip 유무로 판단합니다.
 *
 * 추천 장소는 네이티브 HomeScreen.tsx와 동일한 실제 파이프라인(GPS →
 * 카카오 역지오코딩 → 관광공사 두루누비 지역기반 목록 → 거리순 정렬 →
 * 관광사진 API로 사진 보강, 지역별 24시간 캐시)을 그대로 옮겼습니다 —
 * 화면만 새로 그리고 데이터 소스는 동일합니다.
 *
 * 카테고리 칩은 원본 프로토타입엔 고정 5개(전체/골목산책/카페/맛집/전시)가
 * 있는데, 그건 목업 데이터에 맞춰 정한 임의의 값이라 실제 관광공사
 * API가 주는 카테고리(예: "역사관광", "자연관광지")와 안 맞습니다. 그래서
 * 여기서는 실제로 응답에 들어있는 카테고리 값들로 칩을 동적으로 만듭니다.
 */

const TOUR_API_KEY = process.env.EXPO_PUBLIC_TOUR_API_KEY;
const KAKAO_REST_API_KEY = process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY;
const TOUR_API_ERROR = 'TOUR_API_ERROR' as const;
// 이 시간 안이면 API를 다시 안 부르고 캐시를 그대로 씁니다(빠른 경로).
const TOUR_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
// API 호출이 실패(쿼터 초과/네트워크 오류 등)했을 때, 완전히 빈 화면
// 대신 기대는 "최근 성공 결과" 폴백 캐시입니다. 지역별 캐시(위)보다
// 훨씬 오래(7일) 들고 있어서, 오늘 API가 막혀도 최근에 봤던 추천이라도
// 보여줍니다 — 너무 오래된(사진 링크 만료 등) 것까지는 안 씁니다.
const TOUR_STALE_FALLBACK_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TOUR_LAST_GOOD_CACHE_KEY = 'tour_recommend_cache_v1_last_good';
// 이 폴백 캐시가 저장될 당시 위치에서 이 거리(km)보다 멀리 떨어져 있으면
// 안 씁니다 — 안 그러면 예를 들어 어제 전주에서 본 추천이, 오늘 서울에서
// API가 실패했을 때 "서울 추천"인 것처럼 잘못 나올 수 있습니다.
const TOUR_STALE_FALLBACK_MAX_DISTANCE_KM = 50;

// 실제로 쓰기로 정한 8개 카테고리 태그입니다(항상 고정으로 노출, 순서 그대로).
// 관광공사 두루누비 API 카테고리명은 "체험관광", "역사관광지"처럼 접미사가
// 붙어서 정확히 일치하지 않을 수 있어, 태그 선택 시 필터링은 정확히 같은
// 문자열이 아니라 포함 여부(includes)로 매칭합니다.
const ALLOWED_CATEGORY_KEYWORDS = ['음식점', '카페', '쇼핑', '역사', '자연', '문화', '체험', '주차장'];

// "전체" 탭에서 두루누비 추천(최대 10개) + 테마 매칭 카카오 추천을 합칠 때
// 쓰는 총 개수 상한입니다. 테마를 여러 개 고른 여행은 테마 태그 수만큼
// 카카오 결과가 늘어나서 상한이 없으면 20~30개까지도 쏟아지는데, 그러면
// 다른 태그(항상 10개)와의 일관성이 깨지고 훑어보기도 부담스러워집니다.
// 그렇다고 두루누비 10개로만 자르면 테마 매칭 기능 자체가 거의 안 보이게
// 되므로, 두루누비를 우선하고 남는 자리를 테마 매칭으로 채우는 방식으로
// 15개까지만 보여줍니다.
const TOTAL_FEATURED_PLACES_CAP = 15;

// "전체"만 관광공사 두루누비 API(recommendedPlaces)를 쓰고, 나머지 태그는
// 카카오맵(로컬) API로 주변 장소를 직접 검색합니다. 카카오 카테고리
// 그룹코드가 있는 것(음식점/카페/주차장/문화시설)은 category_group_code로,
// 없는 것(쇼핑/역사/자연/체험)은 키워드 검색으로 대체합니다.
const KAKAO_CATEGORY_QUERY: Record<string, { code?: string; keyword?: string }> = {
  음식점: { code: 'FD6' },
  카페: { code: 'CE7' },
  주차장: { code: 'PK6' },
  문화: { code: 'CT1' },
  쇼핑: { keyword: '쇼핑' },
  역사: { keyword: '역사 관광지' },
  자연: { keyword: '자연 관광지' },
  체험: { keyword: '체험 관광' },
  // 아래 둘은 화면에 칩으로 노출되진 않고(ALLOWED_CATEGORY_KEYWORDS에 없음),
  // "전체" 탭에서 여행 테마 기반 추천(THEME_TO_KAKAO_TAG)에서만 씁니다.
  야경: { keyword: '야경 명소' },
  사진촬영: { keyword: '포토스팟' },
};

// 새 여행 만들기에서 고르는 8개 테마(NewTripModal.tsx의 THEMES)를 위
// KAKAO_CATEGORY_QUERY 태그로 매핑합니다. "선택한 테마를 바탕으로 장소
// 추천을 받을 수 있어요"라는 안내 문구를 실제로 구현하는 부분 — 진행 중인
// 여행에 테마가 있으면 "전체" 탭에서 두루누비 추천과 섞어서 보여줍니다.
const THEME_TO_KAKAO_TAG: Record<string, string> = {
  맛집탐방: '음식점',
  카페투어: '카페',
  문화체험: '문화',
  자연힐링: '자연',
  쇼핑: '쇼핑',
  도보여행: '체험',
  야경: '야경',
  사진촬영: '사진촬영',
};

interface RecommendedPlace {
  id: string;
  name: string;
  imageUrl?: string;
  distance?: number;
  lat: number;
  lng: number;
  category?: string;
  // 아래 3개는 localScoreService.calculateLocalScore 계산용 신호입니다.
  // "전체" 탭(두루누비 API)에서 온 장소는 tourApiRank/tourApiTotal이,
  // 카테고리 탭(카카오 API)에서 온 장소는 categoryGroupCode가 채워집니다.
  categoryGroupCode?: string;
  tourApiRank?: number;
  tourApiTotal?: number;
}

type TourCacheEntry = {
  timestamp: number;
  places: RecommendedPlace[];
  // "최근 성공 결과" 폴백(TOUR_LAST_GOOD_CACHE_KEY)에서만 씁니다 — 이
  // 캐시가 어느 위치에서 만들어졌는지 알아야, 완전히 다른 지역으로
  // 이동했을 때 엉뚱한 지역 추천을 폴백으로 잘못 보여주는 걸 막을 수
  // 있습니다. 지역별 캐시(tour_recommend_cache_v1_${areaCd}_${signguCd})는
  // 키 자체에 지역이 박혀있어서 이 필드가 필요 없습니다.
  lat?: number;
  lng?: number;
};

// 네이티브 HomeScreen.tsx의 placeDetailFromRecommended와 동일한 매핑입니다
// (distance는 km 단위라 PlaceDetailView가 기대하는 m 단위로 변환).
function placeDetailFromRecommended(place: RecommendedPlace): PlaceDetailView {
  return {
    id: place.id,
    name: place.name,
    lat: place.lat,
    lng: place.lng,
    imageUrl: place.imageUrl,
    distanceMeters: place.distance !== undefined ? place.distance * 1000 : undefined,
  };
}

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371.0;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// "전체" 탭에서 두루누비 추천과 테마 매칭 추천을 합칠 때, 같은 장소가
// 두 출처 모두에서 나와 중복 카드로 뜨는 걸 막는 용도의 느슨한 이름 비교.
function normalizePlaceNameForDedupe(name: string): string {
  return name.replace(/\s+/g, '').toLowerCase();
}

// localScoreService.rankByLocalScore에 넘길 최소 입력값을 뽑아냅니다.
// "전체" 탭 장소는 두루누비 응답 안 순번(tourApiRank/tourApiTotal)을,
// 카테고리 탭 장소는 카카오 category_group_code를 씁니다. 동네 밀집도
// (nearbyPopularCount)는 장소마다 따로 조회하면 호출이 N배로 늘어나서,
// 현재 위치 기준 한 번만 조회한 값을 모든 장소에 공통으로 적용합니다.
function toLocalScoreInput(
  place: RecommendedPlace,
  nearbyPopularCount: number | undefined,
): TourApiScoreInput | KakaoScoreInput {
  if (place.tourApiRank !== undefined && place.tourApiTotal !== undefined) {
    return {
      name: place.name,
      rankIndex: place.tourApiRank,
      totalCount: place.tourApiTotal,
      nearbyPopularCount,
    };
  }
  return {
    name: place.name,
    categoryGroupCode: place.categoryGroupCode,
    nearbyPopularCount,
  };
}

async function fetchSpotPhoto(keyword: string) {
  if (!TOUR_API_KEY) return null;
  try {
    const url = `https://apis.data.go.kr/B551011/PhotoGalleryService1/gallerySearchList1?serviceKey=${TOUR_API_KEY}&numOfRows=1&pageNo=1&MobileOS=ETC&MobileApp=AppTest&_type=json&keyword=${encodeURIComponent(keyword)}`;
    const response = await fetch(url);
    const data = await response.json();
    if (data?.OpenAPI_ServiceResponse?.cmmMsgHeader) return TOUR_API_ERROR;
    const items = data?.response?.body?.items?.item;
    return Array.isArray(items) && items.length > 0 ? items[0] : items || null;
  } catch {
    return null;
  }
}

// 사진이 없는 카드는 회색 배경에 카테고리에 맞는 아이콘을 대신 보여줍니다.
// 카카오 검색 결과(음식점/카페/쇼핑 등)는 category가 8개 태그 중 하나와
// 정확히 같은 문자열이고, 관광공사 "전체" 목록은 category가 "체험관광지"처럼
// 접미사가 붙은 원문이라 포함 여부(includes)로 매칭합니다.
const CATEGORY_ICON: Record<string, ComponentProps<typeof Ionicons>['name']> = {
  음식점: 'restaurant-outline',
  카페: 'cafe-outline',
  쇼핑: 'bag-outline',
  역사: 'time-outline',
  자연: 'leaf-outline',
  문화: 'color-palette-outline',
  체험: 'footsteps-outline',
  주차장: 'car-outline',
};
const DEFAULT_CATEGORY_ICON: ComponentProps<typeof Ionicons>['name'] = 'image-outline';

function getCategoryIcon(category?: string): ComponentProps<typeof Ionicons>['name'] {
  if (!category) return DEFAULT_CATEGORY_ICON;
  if (CATEGORY_ICON[category]) return CATEGORY_ICON[category];
  const matchedKeyword = ALLOWED_CATEGORY_KEYWORDS.find((keyword) => category.includes(keyword));
  return matchedKeyword ? CATEGORY_ICON[matchedKeyword] : DEFAULT_CATEGORY_ICON;
}

async function fetchKakaoPlaces(
  tag: string,
  lat: number,
  lng: number,
): Promise<RecommendedPlace[]> {
  const query = KAKAO_CATEGORY_QUERY[tag];
  if (!query || !KAKAO_REST_API_KEY) return [];

  try {
    const params = new URLSearchParams({
      x: String(lng),
      y: String(lat),
      radius: '20000',
      sort: 'distance',
      size: '10',
    });
    if (query.code) params.set('category_group_code', query.code);
    else if (query.keyword) params.set('query', query.keyword);

    const endpoint = query.code
      ? 'https://dapi.kakao.com/v2/local/search/category.json'
      : 'https://dapi.kakao.com/v2/local/search/keyword.json';

    const res = await fetch(`${endpoint}?${params.toString()}`, {
      headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` },
    });
    const data = await res.json();
    const documents: any[] = data?.documents || [];

    return await Promise.all(
      documents.map(async (doc, index) => {
        const photoInfo = await fetchSpotPhoto(doc.place_name);
        return {
          id: `${doc.id}_${index}`,
          name: doc.place_name,
          imageUrl: photoInfo && photoInfo !== TOUR_API_ERROR ? photoInfo.galWebImageUrl : undefined,
          distance: doc.distance ? Number(doc.distance) / 1000 : undefined,
          lat: parseFloat(doc.y),
          lng: parseFloat(doc.x),
          category: tag,
          categoryGroupCode: doc.category_group_code || undefined,
        };
      }),
    );
  } catch (error) {
    console.warn('[Home:web] 카카오 장소 검색 실패:', error);
    return [];
  }
}

async function readTourCache(cacheKey: string): Promise<TourCacheEntry | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey);
    return raw ? (JSON.parse(raw) as TourCacheEntry) : null;
  } catch {
    return null;
  }
}

async function writeTourCache(
  cacheKey: string,
  places: RecommendedPlace[],
  location?: { lat: number; lng: number },
) {
  try {
    const entry: TourCacheEntry = { timestamp: Date.now(), places, ...location };
    await AsyncStorage.setItem(cacheKey, JSON.stringify(entry));
  } catch {
    // 캐시 저장 실패는 무시
  }
}

function isToday(isoString: string): boolean {
  const date = new Date(isoString);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function formatClipDuration(durationMs?: number): string {
  const totalSeconds = Math.floor((durationMs ?? 0) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function buildTodayMoments(recordings: RecordingData[]): ClipItem[] {
  return recordings
    .filter((r) => isToday(r.recordedAt))
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
    .map((r, index) => ({
      id: r.id,
      recordedAt: r.recordedAt ?? new Date().toISOString(),
      durationSeconds: Math.floor((r.durationMs ?? 0) / 1000),
      thumbnail: r.thumbnail,
      uri: r.videoUri ?? '',
      durationLabel: formatClipDuration(r.durationMs),
      caption: r.location.placeName ?? '장소 미지정',
      isNew: index === 0,
    }));
}

// expo-font가 웹에 등록하는 폰트 family 이름은 "Pretendard"가 아니라
// "Pretendard-Regular"/"Pretendard-Bold"처럼 굵기별 이름 그대로입니다
// (RN 쪽 AppText가 fontWeight를 fontFamily로 바꿔치기하는 것과 같은 이유).
// 존재하지 않는 "Pretendard" 패밀리를 쓰면 조용히 sans-serif로 대체돼서,
// RN Text로 그려지는 다른 화면들과 글꼴 자체가 달라 보였습니다. 그래서
// 굵은 텍스트(h1/h2/h3/strong, font-weight 지정된 것들)는 전부 명시적으로
// Pretendard-Bold 패밀리 + font-weight:normal(가짜 볼드 방지)로 바꿨습니다.
const HOME_STYLES = `
  .uri-home-inner { padding: 1px 18px 90px; font-family: 'Pretendard-Regular', sans-serif; }
  .uri-travel-banner { position: relative; height: 261px; overflow: hidden; border-radius: 16px; background-position: center; background-size: cover; background-color: #FFFCF7; }
  .uri-banner-motif { position: absolute; inset: 0; }
  .uri-banner-motif svg { width: 100%; height: 100%; }
  .uri-banner-route { fill: none; stroke: #FF7F5C; stroke-width: 2; stroke-linecap: round; opacity: .5; }
  .uri-banner-dot { fill: #FF7F5C; opacity: .65; }
  .uri-banner-motif-icon { position: absolute; }
  .uri-banner-motif-mountain { top: 13%; left: 26%; }
  .uri-banner-motif-cup { bottom: 15%; left: 11%; }
  .uri-banner-motif-camera { bottom: 21%; right: 11%; }
  .uri-banner-scrim { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,.02) 20%, rgba(0,0,0,.55) 100%); }
  /* 사진 대신 일러스트가 깔리는(클립 아직 없음) 상태는 배경이 밝아서, 흰
     글씨용 그림자 대신 어두운 글씨 + 그 밝기에 맞는 진행바 색으로 바꿉니다. */
  .uri-banner-content-light { color: #222; }
  .uri-banner-content-light .uri-banner-kicker,
  .uri-banner-content-light h1,
  .uri-banner-content-light > p { text-shadow: none; }
  .uri-banner-content-light .uri-progress-track { background: rgba(0,0,0,.08); }
  .uri-banner-content-light .uri-progress-track i { background: #FF7F5C; }
  .uri-banner-content { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: flex-start; padding: 19px 18px 16px; color: #fff; box-sizing: border-box; }
  .uri-banner-kicker { font-size: 11px; opacity: .86; text-shadow: 0 1px 4px rgba(0,0,0,.45); }
  .uri-banner-content h1 { margin: 8px 0 2px; font-size: 28px; letter-spacing: -.075em; font-family: 'Pretendard-Bold', sans-serif; font-weight: normal; text-shadow: 0 1px 6px rgba(0,0,0,.45); }
  .uri-banner-content > p { margin: 0; font-size: 12px; opacity: .9; text-shadow: 0 1px 4px rgba(0,0,0,.45); }
  .uri-progress-label { display: flex; justify-content: space-between; width: 100%; margin-top: auto; font-size: 11px; }
  .uri-progress-label b { font-family: 'Pretendard-SemiBold', sans-serif; font-weight: normal; }
  .uri-progress-track { width: 100%; height: 4px; margin: 7px 0 12px; overflow: hidden; border-radius: 10px; background: rgba(255,255,255,.32); }
  .uri-progress-track i { display: block; height: 100%; border-radius: 10px; background: #fff; }
  .uri-banner-button { display: inline-flex; align-items: center; gap: 6px; min-height: 35px; padding: 0 12px; border-radius: 10px; background: #fff; color: #222; font-size: 11px; font-family: 'Pretendard-Bold', sans-serif; font-weight: normal; border: 0; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,.12); }
  .uri-empty-trip { display: flex; align-items: center; gap: 12px; min-height: 118px; padding: 17px; border: 1px solid #eee; border-radius: 16px; background: #F5F5F5; box-sizing: border-box; }
  .uri-empty-symbol { display: grid; place-items: center; flex: none; width: 43px; height: 43px; border-radius: 50%; background: #FFF3DF; color: #6a5845; }
  .uri-empty-trip p { margin: 0 0 4px; font-size: 13px; font-family: 'Pretendard-Bold', sans-serif; font-weight: normal; color: #222; }
  .uri-empty-trip span { color: #767676; font-size: 11px; }
  .uri-small-cta { margin-left: auto; min-height: 37px; padding: 0 13px; border-radius: 10px; font-size: 12px; flex: none; display: inline-flex; align-items: center; justify-content: center; background: #FF7F5C; color: #fff; border: 0; font-family: 'Pretendard-Bold', sans-serif; font-weight: normal; cursor: pointer; }
  .uri-recommend-section { margin-top: 34px; }
  .uri-section-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px; }
  .uri-section-head h2 { margin: 0; font-size: 18px; letter-spacing: -.06em; color: #222; font-family: 'Pretendard-Bold', sans-serif; font-weight: normal; }
  .uri-chips { display: flex; gap: 6px; overflow: auto; padding-bottom: 4px; }
  .uri-chips::-webkit-scrollbar { display: none; }
  .uri-chip { flex: none; padding: 8px 11px; border: 1px solid #e5e5e5; border-radius: 999px; background: #fff; color: #767676; font-size: 11px; cursor: pointer; }
  .uri-chip.uri-chip-active { border-color: #222; background: #222; color: #fff; }
  .uri-place-grid { display: flex; gap: 12px; overflow-x: auto; margin-top: 15px; padding-bottom: 4px; }
  .uri-place-grid::-webkit-scrollbar { display: none; }
  .uri-place-card { position: relative; flex: none; width: 150px; overflow: hidden; border: 1px solid #eee; border-radius: 12px; background: #fff; text-align: left; cursor: pointer; }
  .uri-visited-badge { position: absolute; top: 6px; right: 6px; z-index: 1; width: 22px; height: 22px; border-radius: 11px; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.45); }
  .uri-place-card img { display: block; width: 100%; height: 116px; object-fit: cover; background: #F5F5F5; }
  .uri-place-card-body { padding: 9px 9px 11px; }
  .uri-badge-row { display: flex; align-items: center; gap: 4px; margin-bottom: 5px; }
  .uri-info-badge { display: inline-block; padding: 3px 6px; border-radius: 999px; background: #FFF3DF; color: #473f35; font-size: 9px; font-family: 'Pretendard-Bold', sans-serif; font-weight: normal; }
  .uri-local-badge { display: inline-block; padding: 3px 6px; border-radius: 999px; font-size: 9px; white-space: nowrap; font-family: 'Pretendard-Bold', sans-serif; font-weight: normal; background: #FFF3DF; color: #6a5845; }
  .uri-place-card h3 { overflow: hidden; margin: 0; font-size: 13px; font-family: 'Pretendard-Bold', sans-serif; font-weight: normal; letter-spacing: -.05em; text-overflow: ellipsis; white-space: nowrap; color: #222; }
  .uri-place-card-distance { display: flex; align-items: center; gap: 2px; overflow: hidden; margin: 5px 0 0; color: #767676; font-size: 9px; white-space: nowrap; }
  .uri-skeleton-card { flex: none; width: 150px; overflow: hidden; border: 1px solid #eee; border-radius: 12px; background: #fff; }
  .uri-skeleton-image { display: block; width: 100%; height: 116px; flex-shrink: 0; background: #eee; animation: uri-pulse 1.1s ease-in-out infinite; }
  .uri-skeleton-body { display: flex; flex-direction: column; gap: 7px; padding: 9px 9px 11px; }
  .uri-skeleton-line { height: 9px; border-radius: 4px; background: #eee; animation: uri-pulse 1.1s ease-in-out infinite; }
  .uri-skeleton-line.short { width: 55%; }
  @keyframes uri-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .45; } }
  .uri-place-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; width: 100%; min-height: 150px; padding: 20px 0; }
  .uri-place-empty .uri-empty-symbol { background: #fff; }
  .uri-place-empty p { margin: 0; color: #767676; font-size: 12px; }
  .uri-moments-section { margin-top: 35px; }
  .uri-more-link { display: flex; align-items: center; gap: 3px; color: #767676; font-size: 11px; background: none; border: 0; cursor: pointer; }
  .uri-clips-row { display: flex; gap: 11px; overflow: auto; padding-bottom: 6px; }
  .uri-clips-row::-webkit-scrollbar { display: none; }
  .uri-moment-card { position: relative; flex: none; width: 157px; height: 126px; overflow: hidden; border-radius: 12px; text-align: left; color: #fff; border: 0; cursor: pointer; padding: 0; }
  .uri-moment-card img { width: 100%; height: 100%; object-fit: cover; }
  .uri-moment-card:after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, transparent 35%, rgba(0,0,0,.62)); }
  .uri-moment-time { position: absolute; z-index: 1; top: 8px; right: 8px; padding: 3px 5px; border-radius: 5px; background: rgba(0,0,0,.47); font-size: 9px; }
  .uri-moment-caption { position: absolute; z-index: 1; bottom: 10px; left: 10px; font-size: 11px; font-family: 'Pretendard-Bold', sans-serif; font-weight: normal; }
  .uri-empty-moments { min-height: 125px; display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius: 12px; background: #fafafa; text-align: center; }
  .uri-empty-moments p { margin: 7px 0 3px; font-size: 12px; font-family: 'Pretendard-Bold', sans-serif; font-weight: normal; color: #222; }
  .uri-empty-moments span { color: #767676; font-size: 10px; }
`;

// "진행 중인 여행" 카드에서 아직 클립을 하나도 안 찍어서 보여줄 사진이 없을
// 때, 밋밋한 배경색 대신 보여주는 장식용 일러스트입니다. 온보딩 화면의
// RouteMotif(경로 곡선 + 여행 아이콘들)와 같은 스타일을 이 카드 크기에
// 맞춰 옮겼습니다.
function TripBannerMotif() {
  return (
    <div className="uri-banner-motif" aria-hidden="true">
      <svg viewBox="0 0 350 261" preserveAspectRatio="none">
        <path
          className="uri-banner-route"
          d="M40 55 C88 82 92 132 58 158 C34 176 52 198 92 193 C148 186 178 160 228 170 C268 178 288 190 304 206"
        />
        <circle className="uri-banner-dot" cx={40} cy={55} r={4.5} />
        <circle className="uri-banner-dot" cx={58} cy={158} r={4.5} />
        <circle className="uri-banner-dot" cx={228} cy={170} r={4.5} />
        <circle className="uri-banner-dot" cx={304} cy={206} r={4.5} />
      </svg>
      <div className="uri-banner-motif-icon uri-banner-motif-mountain">
        <MaterialCommunityIcons name="image-filter-hdr-outline" size={26} color="#d8d8d8" />
      </div>
      <div className="uri-banner-motif-icon uri-banner-motif-cup">
        <Feather name="coffee" size={18} color="#d8d8d8" />
      </div>
      <div className="uri-banner-motif-icon uri-banner-motif-camera">
        <Feather name="camera" size={18} color="#d8d8d8" />
      </div>
    </div>
  );
}

export default function HomeScreenWeb() {
  const router = useRouter();
  const currentTrip = useTripStore((state) => state.currentTrip);
  const { visible: createModalVisible, openCreateModal, closeCreateModal, handleCreatedTrip } =
    useCreateTripModal();
  const { height: windowHeight } = useWindowDimensions();

  const [recommendedPlaces, setRecommendedPlaces] = useState<RecommendedPlace[]>([]);
  const [category, setCategory] = useState<string>('전체');
  const [todayMoments, setTodayMoments] = useState<ClipItem[]>([]);
  // getMergedRecordingsByFolder는 서버에도 요청을 보내서 로컬 전용이던 예전보다
  // 로딩이 느려질 수 있어, 로딩 중과 "진짜 오늘 클립 없음"을 구분해야 합니다.
  const [isLoadingTodayMoments, setIsLoadingTodayMoments] = useState(true);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [kakaoPlaces, setKakaoPlaces] = useState<RecommendedPlace[]>([]);
  const [isLoadingKakaoPlaces, setIsLoadingKakaoPlaces] = useState(false);
  const [themeMatchedPlaces, setThemeMatchedPlaces] = useState<RecommendedPlace[]>([]);

  // 장소 카드를 누르면 뜨는 정보 팝업 — 네이티브 HomeScreen.tsx와 같은
  // PlaceDetailModal을 그대로 재사용합니다.
  const [viewingPlace, setViewingPlace] = useState<PlaceDetailView | null>(null);
  const [placeExtraInfo, setPlaceExtraInfo] = useState<KakaoPlaceInfo | null>(null);
  const [isLoadingPlaceInfo, setIsLoadingPlaceInfo] = useState(false);

  // 이 팝업이 열려있는 동안은 전역 촬영 버튼(WebCameraFab)이 그 위에 겹쳐
  // 보이지 않도록 전역 상태에 알립니다.
  useEffect(() => {
    if (viewingPlace) {
      useWebSheetStore.getState().open();
    } else {
      useWebSheetStore.getState().close();
    }
  }, [viewingPlace]);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      if (!viewingPlace) {
        setPlaceExtraInfo(null);
        return;
      }
      setIsLoadingPlaceInfo(true);
      setPlaceExtraInfo(null);
      const info = await fetchKakaoPlaceInfo(viewingPlace.name, viewingPlace.lat, viewingPlace.lng);
      if (isMounted) {
        setPlaceExtraInfo(info);
        setIsLoadingPlaceInfo(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [viewingPlace]);

  const loadTodayMoments = useCallback(async () => {
    if (!currentTrip) {
      setTodayMoments([]);
      setIsLoadingTodayMoments(false);
      return;
    }
    setIsLoadingTodayMoments(true);
    try {
      const recordings = await getMergedRecordingsByFolder(currentTrip.id);
      setTodayMoments(buildTodayMoments(recordings));
    } catch (error) {
      console.warn('[Home:web] 오늘의 클립 로딩 실패:', error);
    } finally {
      setIsLoadingTodayMoments(false);
    }
  }, [currentTrip]);

  useFocusEffect(
    useCallback(() => {
      void loadTodayMoments();
    }, [loadTodayMoments]),
  );

  // 추천 장소 카드에 "이미 방문한 곳"(별 배지)을 표시하기 위해, 지금까지
  // 찍어둔 모든 클립의 좌표 + 촬영 당시 입력한 장소명을 한 번 불러옵니다.
  // 좌표 거리만으로 판단하면 한옥마을처럼 가게가 다닥다닥 붙은 곳에서는
  // 30m 반경 안에도 전혀 다른 가게가 들어와 버려서, 장소명이 있는
  // 클립이면 이름도 같이 대조합니다 — 거리 조건을 통과해도 이름이 다르면
  // "방문함" 처리하지 않습니다. 다만 장소명을 안 남긴 클립(건너뛰기)도
  // 있어서, 그런 경우엔 아주 가까운 거리(15m)일 때만 이름 없이도 인정합니다.
  const [visitedLocations, setVisitedLocations] = useState<
    { lat: number; lng: number; placeName?: string }[]
  >([]);
  const VISITED_RADIUS_KM = 0.03;
  // 장소명이 없는 클립(건너뛰기)에 한해서만 적용하는, 이름 대조 없이도
  // "확실히 같은 자리"로 볼 수 있는 좁은 반경입니다.
  const VISITED_RADIUS_NO_NAME_KM = 0.015;

  const loadVisitedLocations = useCallback(async () => {
    try {
      const recordings = await getAllRecordings();
      setVisitedLocations(
        recordings.map((r) => ({
          lat: r.location.latitude,
          lng: r.location.longitude,
          placeName: r.location.placeName,
        })),
      );
    } catch (error) {
      console.warn('[Home:web] 방문 기록 로딩 실패:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadVisitedLocations();
    }, [loadVisitedLocations]),
  );

  // 공백 제거 + 소문자 변환 후 한쪽이 다른 쪽을 포함하면 같은 장소로 봅니다
  // ("스타벅스" ⊂ "스타벅스 전주고사동점"처럼 표기가 조금 달라도 통과하도록).
  const isSamePlaceName = (a?: string, b?: string) => {
    if (!a || !b) return false;
    const normalize = (value: string) => value.replace(/\s+/g, '').toLowerCase();
    const na = normalize(a);
    const nb = normalize(b);
    if (!na || !nb) return false;
    return na.includes(nb) || nb.includes(na);
  };

  const isPlaceVisited = useCallback(
    (place: { lat: number; lng: number; name: string }) =>
      visitedLocations.some((loc) => {
        const distanceKm = getDistance(loc.lat, loc.lng, place.lat, place.lng);
        if (distanceKm > VISITED_RADIUS_KM) return false;
        if (loc.placeName) return isSamePlaceName(loc.placeName, place.name);
        return distanceKm <= VISITED_RADIUS_NO_NAME_KM;
      }),
    [visitedLocations],
  );

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const { coords } = await Location.getCurrentPositionAsync({});
        setCurrentLocation({ lat: coords.latitude, lng: coords.longitude });
      } catch (error) {
        console.warn('[Home:web] 현재 위치를 가져오지 못했습니다:', error);
      }
    })();
  }, []);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      if (!currentLocation) return;

      // API 호출이 실패(쿼터 초과/네트워크 오류 등)할 때 기댈 "가장 최근
      // 성공 결과" 폴백입니다. 지역별 캐시와 달리 지역 무관 단일 슬롯이라,
      // (1) 7일 넘은 건 너무 오래돼(사진 링크 만료 등) 안 쓰고, (2) 그
      // 캐시가 만들어진 위치가 지금 위치에서 너무 멀면(다른 동네로
      // 이동한 경우) 엉뚱한 지역 추천이 나올 수 있어서 역시 안 씁니다.
      // 빈 화면보다 낫다는 정도의 최후 수단입니다.
      const staleCache = await readTourCache(TOUR_LAST_GOOD_CACHE_KEY);
      const isStaleCacheUsable =
        !!staleCache &&
        Date.now() - staleCache.timestamp < TOUR_STALE_FALLBACK_TTL_MS &&
        typeof staleCache.lat === 'number' &&
        typeof staleCache.lng === 'number' &&
        getDistance(staleCache.lat, staleCache.lng, currentLocation.lat, currentLocation.lng) <=
          TOUR_STALE_FALLBACK_MAX_DISTANCE_KM;
      const staleFallback = isStaleCacheUsable ? staleCache!.places : [];

      // API 키가 아예 설정 안 돼 있으면 이 파이프라인 전체를 못 씁니다.
      if (!KAKAO_REST_API_KEY || !TOUR_API_KEY) {
        setRecommendedPlaces(staleFallback);
        return;
      }

      try {
        const { lat, lng } = currentLocation;
        const kakaoRes = await fetch(
          `https://dapi.kakao.com/v2/local/geo/coord2regioncode.json?x=${lng}&y=${lat}`,
          { headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` } },
        );
        const kakaoData = await kakaoRes.json();
        const doc = kakaoData.documents?.find((item: any) => item.region_type === 'B') || kakaoData.documents?.[0];
        if (!doc) {
          if (isMounted) setRecommendedPlaces(staleFallback);
          return;
        }

        const areaCd = doc.code.substring(0, 2);
        const signguCd = doc.code.substring(0, 5);
        const cacheKey = `tour_recommend_cache_v1_${areaCd}_${signguCd}`;
        const cached = await readTourCache(cacheKey);
        if (cached && Date.now() - cached.timestamp < TOUR_CACHE_TTL_MS) {
          if (isMounted) setRecommendedPlaces(cached.places);
          return;
        }

        let items: any[] = [];
        let hadApiError = false;
        const date = new Date();
        let year = date.getFullYear();
        let month = date.getMonth() + 1;

        for (let i = 0; i < 12; i++) {
          const baseYm = `${year}${String(month).padStart(2, '0')}`;
          const tourRes = await fetch(
            `https://apis.data.go.kr/B551011/LocgoHubTarService1/areaBasedList1?serviceKey=${TOUR_API_KEY}&numOfRows=100&pageNo=1&MobileOS=ETC&MobileApp=AppTest&baseYm=${baseYm}&areaCd=${areaCd}&signguCd=${signguCd}&_type=json`,
          );
          const tourData = await tourRes.json();

          if (tourData?.OpenAPI_ServiceResponse?.cmmMsgHeader) {
            hadApiError = true;
            break;
          }

          let fetchedItems = tourData?.response?.body?.items?.item || [];
          if (!Array.isArray(fetchedItems)) fetchedItems = [fetchedItems];

          if (fetchedItems.length > 0) {
            items = fetchedItems;
            break;
          }
          month -= 1;
          if (month === 0) {
            month = 12;
            year -= 1;
          }
        }

        if (hadApiError) {
          if (isMounted) setRecommendedPlaces(cached ? cached.places : staleFallback);
          return;
        }

        const sortedSpots = items
          .filter((item: any) => item.mapY && item.mapX)
          .map((item: any) => ({ ...item, distance: getDistance(lat, lng, parseFloat(item.mapY), parseFloat(item.mapX)) }))
          .sort((a: any, b: any) => a.distance - b.distance)
          .slice(0, 10);

        let hadPhotoApiError = false;
        const placesWithPhotos = await Promise.all(
          sortedSpots.map(async (spot: any, index: number) => {
            const photoInfo = await fetchSpotPhoto(spot.hubTatsNm);
            if (photoInfo === TOUR_API_ERROR) hadPhotoApiError = true;

            // 로컬 점수 계산용 — 두루누비 응답에 이미 hubRank(1위부터의 순위)가
            // 들어있어서 그걸 그대로 씁니다. (예전엔 여기서 거리순으로 다시
            // 정렬한 sortedSpots의 배열 인덱스를 썼는데, 그건 "얼마나 가까운가"지
            // "얼마나 유명한가"가 아니라서 신호가 잘못됐던 버그였습니다.)
            // totalCount는 거리로 추려낸 10곳이 아니라 이번 달 원본 응답
            // 전체 개수(items.length, 보통 최대 100)를 써야 순위 비율이 맞습니다.
            const hubRankNum = Number(spot.hubRank);
            const tourApiRank =
              Number.isFinite(hubRankNum) && hubRankNum > 0
                ? hubRankNum - 1
                : Math.floor(items.length / 2);

            return {
              id: `${spot.hubTatsNm}_${index}`,
              name: spot.hubTatsNm,
              imageUrl: photoInfo && photoInfo !== TOUR_API_ERROR ? photoInfo.galWebImageUrl : undefined,
              distance: spot.distance,
              lat: parseFloat(spot.mapY),
              lng: parseFloat(spot.mapX),
              category: spot.hubCtgryMclsNm || spot.hubCtgryLclsNm || undefined,
              tourApiRank,
              tourApiTotal: items.length,
            };
          }),
        );

        if (isMounted) {
          setRecommendedPlaces(placesWithPhotos.length > 0 ? placesWithPhotos : staleFallback);
        }
        if (placesWithPhotos.length > 0 && !hadPhotoApiError) {
          void writeTourCache(cacheKey, placesWithPhotos);
          // "가장 최근 성공 결과" 폴백 슬롯도 같이 갱신해둡니다 — 다음에
          // 실패했을 때 거리 비교를 할 수 있도록 지금 위치도 같이 저장합니다.
          void writeTourCache(TOUR_LAST_GOOD_CACHE_KEY, placesWithPhotos, currentLocation);
        }
      } catch (error) {
        console.warn('[Home:web] 관광지 추천 실패:', error);
        if (isMounted) setRecommendedPlaces(staleFallback);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [currentLocation]);

  // 로컬 점수 계산용 "동네 밀집도" 신호 — 장소 하나하나마다 주변을
  // 검색하면 호출이 N배로 늘어나서, 현재 위치 기준으로 한 번만 조회해
  // 추천 목록 전체에 공통으로 적용합니다(추천 목록은 어차피 같은 동네
  // 반경 안이라 이 정도 근사로 충분합니다). 결과 개수만 필요해서
  // size=1로 요청해 응답 용량을 줄입니다.
  const [areaPopularDensity, setAreaPopularDensity] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!currentLocation || !KAKAO_REST_API_KEY) return;
    let isMounted = true;
    (async () => {
      try {
        const params = new URLSearchParams({
          query: '맛집 카페',
          x: String(currentLocation.lng),
          y: String(currentLocation.lat),
          radius: '2000',
          size: '1',
        });
        const res = await fetch(
          `https://dapi.kakao.com/v2/local/search/keyword.json?${params.toString()}`,
          { headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` } },
        );
        const data = await res.json();
        const count = data?.meta?.pageable_count;
        if (isMounted && typeof count === 'number') setAreaPopularDensity(count);
      } catch (error) {
        console.warn('[Home:web] 동네 밀집도 조회 실패:', error);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [currentLocation]);

  // "전체"만 관광공사 두루누비 데이터(recommendedPlaces)를 쓰고, 나머지
  // 태그를 고르면 그 태그로 카카오맵 API를 새로 호출해서 주변 실제 장소를
  // 보여줍니다 — 관광지 10곳 안에서만 필터링하면 대부분 빈 목록이었습니다.
  useEffect(() => {
    if (category === '전체' || !currentLocation) return;
    let isMounted = true;
    setIsLoadingKakaoPlaces(true);
    (async () => {
      const places = await fetchKakaoPlaces(category, currentLocation.lat, currentLocation.lng);
      if (isMounted) {
        setKakaoPlaces(places);
        setIsLoadingKakaoPlaces(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [category, currentLocation]);

  // 새 여행 만들기에서 고른 테마 → 카카오 태그로 바꾼 목록입니다. 여러
  // 테마가 같은 태그로 매핑될 수 있어 중복은 제거합니다. currentTrip?.themes를
  // 변수로 먼저 뽑아두는 건 React Compiler가 의존성 배열 안의 옵셔널
  // 체이닝을 본문의 접근과 다른 의존성으로 추론해서 메모이제이션을
  // 못 지키는 문제를 피하기 위해서입니다.
  const currentTripThemes = currentTrip?.themes;
  const themeTags = useMemo(() => {
    if (!currentTripThemes?.length) return [];
    const tags = currentTripThemes
      .map((theme) => THEME_TO_KAKAO_TAG[theme])
      .filter((tag): tag is string => !!tag);
    return Array.from(new Set(tags));
  }, [currentTripThemes]);

  // "선택한 테마를 바탕으로 장소 추천을 받을 수 있어요"(NewTripModal 안내
  // 문구)를 실제로 구현하는 부분입니다. "전체" 탭에서, 진행 중인 여행에
  // 테마가 있으면 그 테마에 맞는 카카오 결과를 태그별로 병렬 조회해서
  // 아래 filteredPlaces에서 두루누비 추천과 섞습니다(대체하지 않음 —
  // 테마가 좁아도 추천이 텅 비지 않게).
  useEffect(() => {
    let isMounted = true;
    (async () => {
      if (category !== '전체' || !currentLocation || themeTags.length === 0) {
        if (isMounted) setThemeMatchedPlaces([]);
        return;
      }
      const results = await Promise.all(
        themeTags.map((tag) => fetchKakaoPlaces(tag, currentLocation.lat, currentLocation.lng)),
      );
      if (isMounted) setThemeMatchedPlaces(results.flat());
    })();
    return () => {
      isMounted = false;
    };
  }, [category, currentLocation, themeTags]);

  // 네이티브 CATEGORY_TAGS처럼 8개 태그를 항상 고정으로 보여줍니다.
  const categories = ['전체', ...ALLOWED_CATEGORY_KEYWORDS];

  const filteredPlaces = useMemo(() => {
    if (category !== '전체') return kakaoPlaces;
    if (themeMatchedPlaces.length === 0) return recommendedPlaces;
    // 두루누비 추천 + 테마 매칭 추천을 합치되, 사실상 같은 이름의 장소는
    // 두루누비 쪽(이미 사진/카테고리가 보강됨)을 우선하고 중복 제거합니다.
    const seen = new Set(recommendedPlaces.map((place) => normalizePlaceNameForDedupe(place.name)));
    const merged = [...recommendedPlaces];
    for (const place of themeMatchedPlaces) {
      if (merged.length >= TOTAL_FEATURED_PLACES_CAP) break;
      const key = normalizePlaceNameForDedupe(place.name);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(place);
    }
    return merged;
  }, [category, recommendedPlaces, kakaoPlaces, themeMatchedPlaces]);

  // 로컬 점수 기준 오름차순(로컬 스팟이 앞, 잘 알려진 곳이 뒤) 정렬 +
  // 배지. 배지는 이 정렬 결과를 기준으로만 붙으므로 화면에 보이는 순서와
  // 항상 일치합니다.
  const rankedPlaces = useMemo(
    () =>
      rankByLocalScore(filteredPlaces, (place) => toLocalScoreInput(place, areaPopularDensity)),
    [filteredPlaces, areaPopularDensity],
  );

  const bannerImage = todayMoments.find((m) => m.thumbnail)?.thumbnail;
  const totalStopsHint = currentTrip ? '기록을 이어가볼까요?' : '';

  return (
    <main style={{ height: windowHeight, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <style>{HOME_STYLES}</style>
      <AppHeader />

      <div className="uri-home-inner">
        {currentTrip ? (
          <article
            className="uri-travel-banner"
            style={bannerImage ? { backgroundImage: `url(${bannerImage})` } : undefined}
          >
            {bannerImage ? <div className="uri-banner-scrim" /> : <TripBannerMotif />}
            <div className={`uri-banner-content${bannerImage ? '' : ' uri-banner-content-light'}`}>
              <span className="uri-banner-kicker">진행 중인 여행</span>
              <h1>{currentTrip.title}</h1>
              <p>{totalStopsHint}</p>
              <div className="uri-progress-label">
                <span>오늘의 순간 {todayMoments.length}개 기록했어요</span>
              </div>
              <div className="uri-progress-track">
                <i style={{ width: `${Math.min(todayMoments.length * 20, 100)}%` }} />
              </div>
              <button className="uri-banner-button" onClick={() => router.push('/(tabs)/my-route')}>
                여행 계속하기 <Feather name="arrow-right" size={16} color="#222" />
              </button>
            </div>
          </article>
        ) : (
          <article className="uri-empty-trip">
            <div className="uri-empty-symbol">
              <Feather name="map-pin" size={22} color="#6a5845" />
            </div>
            <div>
              <p>아직 시작한 여행이 없어요</p>
              <span>첫 번째 길을 기록해볼까요?</span>
            </div>
            <button className="uri-small-cta" onClick={openCreateModal}>
              여행 시작
            </button>
          </article>
        )}

        <section className="uri-recommend-section">
          <div className="uri-section-head">
            <h2>추천 장소</h2>
          </div>
          <div className="uri-chips">
            {categories.map((item) => (
              <button
                key={item}
                onClick={() => setCategory(item)}
                className={`uri-chip${category === item ? ' uri-chip-active' : ''}`}
              >
                {item}
              </button>
            ))}
          </div>
          {category !== '전체' && isLoadingKakaoPlaces ? (
            <div className="uri-place-grid">
              {[0, 1, 2].map((i) => (
                <div key={i} className="uri-skeleton-card">
                  <div className="uri-skeleton-image" style={{ height: 116 }} />
                  <div className="uri-skeleton-body">
                    <div className="uri-skeleton-line short" />
                    <div className="uri-skeleton-line" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredPlaces.length === 0 ? (
            <div className="uri-place-empty">
              <div className="uri-empty-symbol">
                <Feather name="map-pin" size={22} color="#6a5845" />
              </div>
              <p>{category === '전체' ? '근처에 추천할 장소가 없어요' : `근처에 ${category} 장소가 없어요`}</p>
            </div>
          ) : (
            <div className="uri-place-grid">
              {rankedPlaces.map(({ place, badge }) => (
                <div
                  key={place.id}
                  className="uri-place-card"
                  onClick={() => setViewingPlace(placeDetailFromRecommended(place))}
                >
                  {place.imageUrl ? (
                    <RNImage source={{ uri: place.imageUrl }} style={styles.placeCardImage} />
                  ) : (
                    <View style={styles.placeCardImagePlaceholder}>
                      <Ionicons name={getCategoryIcon(place.category)} size={28} color="#B8B0A6" />
                    </View>
                  )}
                  {isPlaceVisited(place) && (
                    <div className="uri-visited-badge">
                      <Ionicons name="star" size={12} color="#FFD166" />
                    </div>
                  )}
                  <div className="uri-place-card-body">
                    {(place.category || badge) && (
                      <div className="uri-badge-row">
                        {place.category && <span className="uri-info-badge">{place.category}</span>}
                        {badge && <span className="uri-local-badge">{badge}</span>}
                      </div>
                    )}
                    <h3>{place.name}</h3>
                    {place.distance !== undefined && (
                      <span className="uri-place-card-distance">
                        <Feather name="map-pin" size={10} color="#767676" /> {place.distance.toFixed(1)}km
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="uri-moments-section">
          <div className="uri-section-head">
            <h2>오늘의 순간들</h2>
            <button className="uri-more-link" onClick={() => router.push('/(tabs)/clip-manage')}>
              전체보기 <Feather name="chevron-right" size={14} color="#767676" />
            </button>
          </div>
          {isLoadingTodayMoments ? (
            <div className="uri-empty-moments">
              <ActivityIndicator size="small" color="#FF7F5C" />
            </div>
          ) : todayMoments.length === 0 ? (
            <div className="uri-empty-moments">
              <p>오늘 촬영한 클립이 없어요</p>
              <span>지나는 순간을 짧게 남겨보세요</span>
            </div>
          ) : (
            <div className="uri-clips-row">
              {todayMoments.slice(0, 6).map((clip) => (
                <button
                  key={clip.id}
                  onClick={() => router.push('/(tabs)/clip-manage')}
                  className="uri-moment-card"
                >
                  {clip.thumbnail ? (
                    <RNImage source={{ uri: clip.thumbnail }} style={styles.momentImage} />
                  ) : (
                    <View style={[styles.momentImage, styles.momentPlaceholder]} />
                  )}
                  <span className="uri-moment-time">{clip.durationLabel}</span>
                  <strong className="uri-moment-caption">{clip.caption}</strong>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      <NewTripModal visible={createModalVisible} onClose={closeCreateModal} onCreated={handleCreatedTrip} />

      <PlaceDetailModal
        place={viewingPlace}
        extraInfo={placeExtraInfo}
        isLoadingExtraInfo={isLoadingPlaceInfo}
        onClose={() => setViewingPlace(null)}
      />
    </main>
  );
}

const styles = StyleSheet.create({
  placeCardImage: {
    width: '100%',
    height: 116,
    backgroundColor: '#F5F5F5',
  },
  placeCardImagePlaceholder: {
    width: '100%',
    height: 116,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  momentImage: {
    width: '100%',
    height: '100%',
  },
  momentPlaceholder: {
    backgroundColor: '#F5F5F5',
  },
});
