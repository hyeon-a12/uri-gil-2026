import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * 카카오 장소 검색 로직을 화면 두 곳(촬영 후 장소 확인, 일정에 장소 추가)에서
 * 그대로 재사용하기 위해 뽑아낸 훅입니다. 검색 반경, 디바운스,
 * 직접 입력 장소 결합 규칙이 두 화면에서 절대 어긋나지 않도록 여기 한 곳에서만 관리합니다.
 */

export type PlaceCoordinates = {
  latitude: number;
  longitude: number;
};

export type KakaoPlace = {
  id: string;
  name: string;
  category: string;
  address: string;
  distance?: number;
  latitude: number;
  longitude: number;
};

type KakaoPlaceResponse = {
  id?: string;
  place_name?: string;
  category_name?: string;
  category_group_name?: string;
  road_address_name?: string;
  address_name?: string;
  distance?: string;
  x?: string;
  y?: string;
};

function mapKakaoPlace(place: KakaoPlaceResponse): KakaoPlace | null {
  const latitude = Number(place.y);
  const longitude = Number(place.x);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return {
    id: String(place.id ?? `${latitude}-${longitude}`),
    name: place.place_name ?? '이름 없는 장소',
    category: place.category_group_name || place.category_name || '장소',
    address: place.road_address_name || place.address_name || '주소 정보 없음',
    distance: place.distance ? Number(place.distance) : undefined,
    latitude,
    longitude,
  };
}

export function formatDistance(distance?: number): string {
  if (distance === undefined || !Number.isFinite(distance)) return '주변';
  if (distance < 1000) return `${distance}m`;
  return `${(distance / 1000).toFixed(1)}km`;
}

// "내 주변 장소" 자동 추천에 쓰는 카카오 카테고리 코드 — 관광명소/음식점/카페를 섞어서 보여줍니다.
const NEARBY_CATEGORY_CODES = ['AT4', 'FD6', 'CE7'] as const;
const NEARBY_RADIUS_METERS = 3000;
const NEARBY_RESULT_LIMIT = 5;

async function fetchCategoryPlaces(
  categoryCode: string,
  center: PlaceCoordinates,
  apiKey: string,
): Promise<KakaoPlace[]> {
  const params = new URLSearchParams({
    category_group_code: categoryCode,
    x: String(center.longitude),
    y: String(center.latitude),
    radius: String(NEARBY_RADIUS_METERS),
    sort: 'distance',
    size: '5',
  });

  const response = await fetch(
    `https://dapi.kakao.com/v2/local/search/category.json?${params.toString()}`,
    { headers: { Authorization: `KakaoAK ${apiKey}` } },
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[usePlaceSearch] Kakao 카테고리 검색 실패:', categoryCode, response.status, errorText);
    throw new Error('주변 장소를 불러오지 못했어요.');
  }

  const data = (await response.json()) as { documents?: KakaoPlaceResponse[] };
  return (data.documents ?? [])
    .map(mapKakaoPlace)
    .filter((place): place is KakaoPlace => place !== null);
}

/** 카테고리별 검색 결과를 하나로 합쳐 중복을 제거하고 거리순 상위 N개만 남깁니다. */
function mergeNearbyResults(resultsByCategory: KakaoPlace[][]): KakaoPlace[] {
  const seen = new Set<string>();
  const merged: KakaoPlace[] = [];

  for (const list of resultsByCategory) {
    for (const place of list) {
      if (seen.has(place.id)) continue;
      seen.add(place.id);
      merged.push(place);
    }
  }

  return merged
    .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))
    .slice(0, NEARBY_RESULT_LIMIT);
}

type UsePlaceSearchOptions = {
  /**
   * true면 근처 장소 중 가장 가까운 곳을 기본값으로 자동 선택합니다(촬영 직후
   * "여기서 촬영하셨나요?"처럼 제안이 필요한 화면용). 한 번만 자동 선택하고,
   * 그 뒤로 사용자가 직접 고르거나 검색하면 더 이상 끼어들지 않습니다.
   */
  autoSelectNearest?: boolean;
};

export function usePlaceSearch(
  coordinates: PlaceCoordinates | null,
  options?: UsePlaceSearchOptions,
) {
  const autoSelectNearest = options?.autoSelectNearest ?? false;

  const [query, setQuery] = useState('');
  const [places, setPlaces] = useState<KakaoPlace[]>([]);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<KakaoPlace | null>(null);
  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);
  const [manualPlaceName, setManualPlaceName] = useState('');
  const [manualAddress, setManualAddress] = useState('');

  // 검색어를 아직 입력하지 않았을 때 화면 상단에 먼저 보여줄 "내 주변 장소" 5곳.
  const [nearbyPlaces, setNearbyPlaces] = useState<KakaoPlace[]>([]);
  const [isLoadingNearby, setIsLoadingNearby] = useState(false);
  // autoSelectNearest로 자동 선택된 장소의 id. 화면에서 "추천했어요" 안내를
  // 보여줄지 판단하는 용도 — 사용자가 다른 곳을 직접 고르면 selectedPlace만
  // 바뀌고 이 값은 그대로라 더 이상 추천 문구를 보여주지 않게 됩니다.
  const [autoSuggestedPlaceId, setAutoSuggestedPlaceId] = useState<string | null>(null);

  const searchRequestIdRef = useRef(0);
  const nearbyRequestIdRef = useRef(0);
  const hasAutoSelectedRef = useRef(false);

  const searchPlacesAroundCoordinates = useCallback(
    async (keyword: string, center: PlaceCoordinates) => {
      const apiKey = process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY;

      if (!apiKey) {
        setIsLoadingPlaces(false);
        setSearchError('카카오 장소 검색을 사용할 수 없어요.');
        setPlaces([]);
        return;
      }

      const requestId = ++searchRequestIdRef.current;
      setIsLoadingPlaces(true);
      setSearchError(null);

      try {
        const params = new URLSearchParams({
          query: keyword,
          x: String(center.longitude),
          y: String(center.latitude),
          sort: 'distance',
          size: '15',
        });

        const response = await fetch(
          `https://dapi.kakao.com/v2/local/search/keyword.json?${params.toString()}`,
          {
            headers: {
              Authorization: `KakaoAK ${apiKey}`,
            },
          },
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[usePlaceSearch] Kakao 장소 검색 실패:', response.status, errorText);
          throw new Error('주변 장소를 불러오지 못했어요.');
        }

        const data = (await response.json()) as { documents?: KakaoPlaceResponse[] };
        const mappedPlaces = (data.documents ?? [])
          .map(mapKakaoPlace)
          .filter((place): place is KakaoPlace => place !== null);

        if (requestId === searchRequestIdRef.current) {
          setPlaces(mappedPlaces);
        }
      } catch (error) {
        console.warn('[usePlaceSearch] 검색 실패:', error);
        if (requestId === searchRequestIdRef.current) {
          setSearchError('주변 장소를 불러오지 못했어요.');
          setPlaces([]);
        }
      } finally {
        if (requestId === searchRequestIdRef.current) {
          setIsLoadingPlaces(false);
        }
      }
    },
    [],
  );

  const applyNearbyResult = useCallback(
    (result: KakaoPlace[]) => {
      setNearbyPlaces(result);

      if (autoSelectNearest && !hasAutoSelectedRef.current && result[0]) {
        hasAutoSelectedRef.current = true;
        setSelectedPlace(result[0]);
        setAutoSuggestedPlaceId(result[0].id);
      }
    },
    [autoSelectNearest],
  );

  const fetchNearbyPlaces = useCallback(
    async (center: PlaceCoordinates) => {
      const apiKey = process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY;
      const requestId = ++nearbyRequestIdRef.current;

      if (!apiKey) {
        applyNearbyResult([]);
        return;
      }

      setIsLoadingNearby(true);

      try {
        const resultsByCategory = await Promise.all(
          NEARBY_CATEGORY_CODES.map((code) =>
            fetchCategoryPlaces(code, center, apiKey).catch((error) => {
              console.warn('[usePlaceSearch] 카테고리 검색 실패:', code, error);
              return [] as KakaoPlace[];
            }),
          ),
        );

        if (requestId !== nearbyRequestIdRef.current) return;

        applyNearbyResult(mergeNearbyResults(resultsByCategory));
      } finally {
        if (requestId === nearbyRequestIdRef.current) {
          setIsLoadingNearby(false);
        }
      }
    },
    [applyNearbyResult],
  );

  useEffect(() => {
    if (!coordinates) return;
    void fetchNearbyPlaces(coordinates);
  }, [coordinates, fetchNearbyPlaces]);

  // 350ms 디바운스 — 검색어가 없으면 목록을 비웁니다(자동으로 주변 추천을 띄우지 않음).
  useEffect(() => {
    const trimmed = query.trim();

    if (!coordinates || !trimmed) {
      setPlaces([]);
      setSearchError(null);
      setIsLoadingPlaces(false);
      return;
    }

    const timer = setTimeout(() => {
      void searchPlacesAroundCoordinates(trimmed, coordinates);
    }, 350);

    return () => clearTimeout(timer);
  }, [query, searchPlacesAroundCoordinates, coordinates]);

  const manuallyAddedPlace = useMemo<KakaoPlace | null>(() => {
    const name = manualPlaceName.trim();
    if (!name || !coordinates) return null;

    return {
      id: 'manual-place',
      name,
      category: '직접 추가한 장소',
      address: manualAddress.trim() || '주소 직접 입력 없음',
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
    };
  }, [manualAddress, manualPlaceName, coordinates]);

  const placeToSave = selectedPlace ?? manuallyAddedPlace;

  function selectPlace(place: KakaoPlace) {
    setSelectedPlace(place);
    setIsManualEntryOpen(false);
  }

  function changeQuery(value: string) {
    setQuery(value);
    setSelectedPlace(null);
    setIsManualEntryOpen(false);
  }

  function toggleManualEntry() {
    setIsManualEntryOpen((opened) => !opened);
    setSelectedPlace(null);
  }

  function changeManualPlaceName(value: string) {
    setManualPlaceName(value);
    setSelectedPlace(null);
  }

  function changeManualAddress(value: string) {
    setManualAddress(value);
    setSelectedPlace(null);
  }

  // 검색어가 없으면 "내 주변 장소" 5곳을, 있으면 검색 결과를 보여줍니다 — 화면
  // 쪽에서 매번 이 분기를 반복하지 않도록 훅에서 미리 계산해서 내려줍니다.
  const isBrowsingNearby = query.trim().length === 0;
  const displayedPlaces = isBrowsingNearby ? nearbyPlaces : places;
  const isLoadingDisplayed = isBrowsingNearby ? isLoadingNearby : isLoadingPlaces;

  return {
    query,
    changeQuery,
    clearQuery: () => setQuery(''),
    places,
    isLoadingPlaces,
    searchError,
    nearbyPlaces,
    isLoadingNearby,
    autoSuggestedPlaceId,
    isBrowsingNearby,
    displayedPlaces,
    isLoadingDisplayed,
    selectedPlace,
    selectPlace,
    isManualEntryOpen,
    toggleManualEntry,
    manualPlaceName,
    changeManualPlaceName,
    manualAddress,
    changeManualAddress,
    manuallyAddedPlace,
    placeToSave,
  };
}
