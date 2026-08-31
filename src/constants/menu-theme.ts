import { COLORS as SHARED_COLORS } from '@/constants/color';

// 마이페이지에서 진입하는 메뉴 화면들(내 루트, 촬영한 클립, 나의 정보 관리 ...)이
// 공통으로 쓰는 색상 팔레트입니다. 팔레트 v1(color.js) 토큰을 그대로 가져다 씁니다.
export const colors = {
  bg: SHARED_COLORS.background,
  card: SHARED_COLORS.background,

  accent: SHARED_COLORS.accent,
  accentDark: SHARED_COLORS.accentPressed,
  accentSoft: SHARED_COLORS.main,

  text: SHARED_COLORS.textPrimary,
  textSub: SHARED_COLORS.textSecondary,
  textTertiary: SHARED_COLORS.textSecondary,

  border: SHARED_COLORS.border,
  shadow: SHARED_COLORS.shadow,
  success: SHARED_COLORS.success,
  surface: SHARED_COLORS.surface,
  danger: SHARED_COLORS.danger,
};

// 여행 상태(예정/여행중/완료) 뱃지 색상. 클립 관리 화면(clip-manage.tsx)의
// statusBadge 색상과 맞춰뒀습니다.
export const statusColors = {
  before: { bg: colors.bg, text: colors.textSub },
  ing: { bg: '#FFF1E4', text: colors.accent },
  done: { bg: '#E7F5EA', text: colors.success },
};
