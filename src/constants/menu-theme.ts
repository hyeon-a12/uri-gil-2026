// 마이페이지에서 진입하는 메뉴 화면들(내 루트, 촬영한 클립, 나의 정보 관리 ...)이
// 공통으로 쓰는 색상 팔레트입니다. my-page.tsx의 오렌지 팔레트와 통일했습니다.
export const colors = {
  bg: '#FFFFFF',
  card: '#FFFFFF',

  accent: '#FF7F5C',
  accentDark: '#E97B1F',
  accentSoft: '#FFF3DF',

  text: '#222222',
  textSub: '#8A8A8A',
  textTertiary: '#8A8A8A',

  border: '#DDDDDD',
  shadow: '#443A31',
};

// 여행 상태(예정/여행중/완료) 뱃지처럼, 팔레트에는 없는 상태 표시용 색상입니다.
export const statusColors = {
  before: { bg: colors.border, text: colors.textSub },
  ing: { bg: colors.accentSoft, text: colors.accentDark },
  done: { bg: '#E4F1E6', text: '#3E8E5B' },
};
