import type { LocationSuggestion } from '@/types/recording';

/** GPS 추천 장소 목업 — 추후 expo-location + API 연동으로 교체 */
export const MOCK_LOCATION_SUGGESTIONS: LocationSuggestion[] = [
  {
    id: '1',
    name: '직접 입력 ver.',
    category: '카테고리',
    distanceMeters: 0,
    address: '주소',
  },
  {
    id: '2',
    name: 'API 연동 ver.',
    category: '카테고리',
    distanceMeters: 0,
    address: '아래는 예시',
  },
  {
    id: '3',
    name: '전동성당',
    category: '성당',
    distanceMeters: 23,
    address: '전북특별자치도 전주시 완산구 태조로 51',
  },
  {
    id: '4',
    name: '전동성당 사제관',
    category: '성당',
    distanceMeters: 45,
    address: '전북특별자치도 전주시 완산구 태조로 51',
  },
  {
    id: '5',
    name: '전동성당 수녀원',
    category: '성당',
    distanceMeters: 67,
    address: '전북특별자치도 전주시 완산구 태조로 51',
  },
];
