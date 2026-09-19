import { useCallback, useEffect, useState, type ComponentProps } from 'react';
import { Image as RNImage, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import { AppText as Text } from '@/components/AppText';
import { AppHeader } from '@/components/web/AppHeader.web';
import { useTripStore } from '@/store/useTripStore';
import { getRecordingsByFolder, getAllRecordings } from '@/services/recordingService';
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
const TOUR_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// 실제로 쓰기로 정한 8개 카테고리 태그입니다(항상 고정으로 노출, 순서 그대로).
// 관광공사 두루누비 API 카테고리명은 "체험관광", "역사관광지"처럼 접미사가
// 붙어서 정확히 일치하지 않을 수 있어, 태그 선택 시 필터링은 정확히 같은
// 문자열이 아니라 포함 여부(includes)로 매칭합니다.
const ALLOWED_CATEGORY_KEYWORDS = ['음식점', '카페', '쇼핑', '역사', '자연', '문화', '체험', '주차장'];

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
};

interface RecommendedPlace {
  id: string;
  name: string;
  imageUrl?: string;
  distance?: number;
  lat: number;
  lng: number;
  category?: string;
}

type TourCacheEntry = { timestamp: number; places: RecommendedPlace[] };

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

async function writeTourCache(cacheKey: string, places: RecommendedPlace[]) {
  try {
    await AsyncStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), places }));
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
  .uri-travel-banner { position: relative; height: 261px; overflow: hidden; border-radius: 16px; background-position: center; background-size: cover; background-color: #FFF3DF; }
  .uri-banner-scrim { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,.02) 20%, rgba(0,0,0,.55) 100%); }
  .uri-banner-content { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: flex-start; padding: 19px 18px 16px; color: #fff; box-sizing: border-box; }
  .uri-banner-kicker { font-size: 11px; opacity: .86; }
  .uri-banner-content h1 { margin: 8px 0 2px; font-size: 28px; letter-spacing: -.075em; font-family: 'Pretendard-Bold', sans-serif; font-weight: normal; }
  .uri-banner-content > p { margin: 0; font-size: 12px; opacity: .9; }
  .uri-progress-label { display: flex; justify-content: space-between; width: 100%; margin-top: auto; font-size: 11px; }
  .uri-progress-label b { font-family: 'Pretendard-SemiBold', sans-serif; font-weight: normal; }
  .uri-progress-track { width: 100%; height: 4px; margin: 7px 0 12px; overflow: hidden; border-radius: 10px; background: rgba(255,255,255,.32); }
  .uri-progress-track i { display: block; height: 100%; border-radius: 10px; background: #fff; }
  .uri-banner-button { display: inline-flex; align-items: center; gap: 6px; min-height: 35px; padding: 0 12px; border-radius: 10px; background: #fff; color: #222; font-size: 11px; font-family: 'Pretendard-Bold', sans-serif; font-weight: normal; border: 0; cursor: pointer; }
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
  .uri-info-badge { display: inline-block; margin-bottom: 5px; padding: 3px 6px; border-radius: 999px; background: #FFF3DF; color: #473f35; font-size: 9px; font-family: 'Pretendard-Bold', sans-serif; font-weight: normal; }
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

export default function HomeScreenWeb() {
  const router = useRouter();
  const currentTrip = useTripStore((state) => state.currentTrip);
  const { visible: createModalVisible, openCreateModal, closeCreateModal, handleCreatedTrip } =
    useCreateTripModal();
  const { height: windowHeight } = useWindowDimensions();

  const [recommendedPlaces, setRecommendedPlaces] = useState<RecommendedPlace[]>([]);
  const [category, setCategory] = useState<string>('전체');
  const [todayMoments, setTodayMoments] = useState<ClipItem[]>([]);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [kakaoPlaces, setKakaoPlaces] = useState<RecommendedPlace[]>([]);
  const [isLoadingKakaoPlaces, setIsLoadingKakaoPlaces] = useState(false);

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
      return;
    }
    try {
      const recordings = await getRecordingsByFolder(currentTrip.id);
      setTodayMoments(buildTodayMoments(recordings));
    } catch (error) {
      console.warn('[Home:web] 오늘의 클립 로딩 실패:', error);
    }
  }, [currentTrip]);

  useFocusEffect(
    useCallback(() => {
      void loadTodayMoments();
    }, [loadTodayMoments]),
  );

  // 추천 장소 카드에 "이미 방문한 곳"(별 배지)을 표시하기 위해, 지금까지
  // 찍어둔 모든 클립의 좌표를 한 번 불러옵니다. 장소명이 아니라 좌표
  // 거리로 비교합니다 — 장소명 표기가 조금 달라도 정확합니다. 반경은 GPS
  // 오차(수 m~10여 m)는 보정하되, 한옥마을처럼 가게가 밀집된 곳에서 안 간
  // 옆 가게까지 같이 별표 처리되지 않도록 30m로 좁게 잡습니다(100m는 너무
  // 넓어서 전혀 다른 장소까지 방문한 것으로 잘못 표시됐음).
  const [visitedLocations, setVisitedLocations] = useState<{ lat: number; lng: number }[]>([]);
  const VISITED_RADIUS_KM = 0.03;

  const loadVisitedLocations = useCallback(async () => {
    try {
      const recordings = await getAllRecordings();
      setVisitedLocations(
        recordings.map((r) => ({ lat: r.location.latitude, lng: r.location.longitude })),
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

  const isPlaceVisited = useCallback(
    (place: { lat: number; lng: number }) =>
      visitedLocations.some(
        (loc) => getDistance(loc.lat, loc.lng, place.lat, place.lng) <= VISITED_RADIUS_KM,
      ),
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
      if (!currentLocation || !KAKAO_REST_API_KEY || !TOUR_API_KEY) return;
      try {
        const { lat, lng } = currentLocation;
        const kakaoRes = await fetch(
          `https://dapi.kakao.com/v2/local/geo/coord2regioncode.json?x=${lng}&y=${lat}`,
          { headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` } },
        );
        const kakaoData = await kakaoRes.json();
        const doc = kakaoData.documents?.find((item: any) => item.region_type === 'B') || kakaoData.documents?.[0];
        if (!doc) return;

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
          if (cached && isMounted) setRecommendedPlaces(cached.places);
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
            return {
              id: `${spot.hubTatsNm}_${index}`,
              name: spot.hubTatsNm,
              imageUrl: photoInfo && photoInfo !== TOUR_API_ERROR ? photoInfo.galWebImageUrl : undefined,
              distance: spot.distance,
              lat: parseFloat(spot.mapY),
              lng: parseFloat(spot.mapX),
              category: spot.hubCtgryMclsNm || spot.hubCtgryLclsNm || undefined,
            };
          }),
        );
        if (isMounted) setRecommendedPlaces(placesWithPhotos);
        if (!hadPhotoApiError) void writeTourCache(cacheKey, placesWithPhotos);
      } catch (error) {
        console.warn('[Home:web] 관광지 추천 실패:', error);
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

  // 네이티브 CATEGORY_TAGS처럼 8개 태그를 항상 고정으로 보여줍니다.
  const categories = ['전체', ...ALLOWED_CATEGORY_KEYWORDS];
  const filteredPlaces = category === '전체' ? recommendedPlaces : kakaoPlaces;

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
            <div className="uri-banner-scrim" />
            <div className="uri-banner-content">
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
          ) : category !== '전체' && filteredPlaces.length === 0 ? (
            <div className="uri-place-empty">
              <div className="uri-empty-symbol">
                <Feather name="map-pin" size={22} color="#6a5845" />
              </div>
              <p>근처에 {category} 장소가 없어요</p>
            </div>
          ) : (
            <div className="uri-place-grid">
              {filteredPlaces.map((place) => (
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
                    {place.category && <span className="uri-info-badge">{place.category}</span>}
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
          {todayMoments.length === 0 ? (
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
