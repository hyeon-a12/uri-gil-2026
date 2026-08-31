// src/constants/colors.js
//
// 앱 전체에서 쓰는 색상을 한 곳에 모아놓은 파일 (팔레트 v1 — 2026-08-14 정리)
//
// 12개 화면에 흩어져 있던 색상값을 감사(audit)한 뒤 하나로 통일했습니다.
// 화면마다 자기 이름의 로컬 COLORS 객체를 쓰더라도, 그 안의 "값"은 전부
// 여기 있는 토큰을 그대로 참조하게 되어 있습니다 — 색을 바꿀 땐 이 파일만
// 고치면 앱 전체에 반영됩니다.

export const COLORS = {
  // ── 1. 브랜드 · 포인트 (60/30/10) ───────────────────────────
  accent: '#FF7F5C',          // 10% — CTA·핵심 강조에만 좁게 사용
  main: '#FFF3DF',            // 30% — 배지·카드·태그 등 넓게 사용
  background: '#FFFFFF',      // 60% — 베이스
  accentPressed: '#E8613D',   // accent 눌림 상태

  // 그라데이션(자유 사용 허용, 필수 아님): linear-gradient(135deg, gradientStart, accent)
  gradientStart: '#FFC364',

  // ── 2. 배경 ──────────────────────────────────────────────────
  backgroundIvory: '#FAF8F1', // 카메라·영상편집 화면 전용 아이보리 톤
  surface: '#F5F5F5',
  sheetBackground: '#FFFBF4', // 바텀시트

  // ── 3. 텍스트 ────────────────────────────────────────────────
  textPrimary: '#222222',
  textSecondary: '#8A8A8A',

  // ── 4. 테두리 · 구분선 ───────────────────────────────────────
  border: '#DDDDDD',          // #EEEEEE는 폐기 — 전부 이 값으로 통일
  borderIvory: '#E4E0D2',     // backgroundIvory 위에서 쓰는 테두리

  // ── 5. 상태 · 확장 색상 ──────────────────────────────────────
  success: '#4CAF50',
  cameraRecord: '#FF4444',    // 녹화 중 표시 — danger와 별도로 유지
  danger: '#E14D3F',          // 삭제·경고 (기존에 갈려있던 delete 색 통일)
  statusTag: '#3182F6',       // 상태 태그(예: "진행중")
  shadow: '#443A31',          // 전 화면 카드 그림자 통일

  // ── 장소 확인 화면 전용 (v1 문서에 없음 — 기존 값 그대로 유지) ──
  locationButtonDisabled: '#D8D3CE',
  locationDragHandle: '#C8CDD8',
};

// my-route.tsx 지도 화면 전용 확장 토큰. 다른 화면에서 쓰지 않도록 의도적으로
// COLORS와 분리해서 export합니다.
export const MAP_COLORS = {
  mapBlue: '#DDF3F2',
  mapGreen: '#E6F2D8',
  mapCream: '#F7F0DA',
};

// 화면마다 제각각이던 borderRadius/padding/margin/gap 값을 통일하기 위한 토큰.
export const RADIUS = {
  badge: 8,
  card: 12,
  banner: 16,
  sheet: 24,
  full: 999,
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  screenH: 20,
};
