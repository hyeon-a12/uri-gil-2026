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
};

// 여행 상태(예정/여행중/완료) 뱃지처럼, 팔레트에는 없는 상태 표시용 색상입니다.
// done의 초록색은 v1 팔레트 문서에 없는 값이라 로컬로 유지합니다.
export const statusColors = {
  before: { bg: colors.border, text: colors.textSub },
  ing: { bg: colors.accentSoft, text: colors.accentDark },
  done: { bg: '#E4F1E6', text: '#3E8E5B' },
};
