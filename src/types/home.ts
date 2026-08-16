export interface ClipItem {
  id: string;
  title?: string;
  recordedAt: string;
  durationSeconds?: number;
  thumbnail: string;
  uri: string;

  durationLabel?: string;
  caption?: string;
  isNew?: boolean;

  /** 그리드 촬영(칸별로 나눠 찍은 클립)일 때만 채워짐 — 같은 값이면 같은 그리드 세트. */
  gridGroupId?: string;
  /** 그리드 세트 안에서 몇 번째 칸이었는지 (0부터 시작). */
  gridSlotIndex?: number;
}

export interface RecentClip {
  id: string;
  location: string;
  duration: string;
  image: string;
}

export interface RecommendedPlace {
  id: string;
  title: string;
  subtitle: string;
  rating: number;
  price: number;
  duration: string;
  image: string;
}

export interface RouteMarker {
  id: string;
  label: number;
  x: string;
  y: string;
}

export interface TripRoute {
  title: string;
  subtitle: string;
  markers: RouteMarker[];
}
