// 이 라우트는 실제로 화면에 렌더되지 않습니다. 탭바의 "카메라" 탭은
// (tabs)/_layout.tsx의 CameraTabButton이 탭 전환 대신 /camera로 바로
// 이동시키는 tabBarButton으로 완전히 대체돼 있고, expo-router의 파일 기반
// 라우팅상 Tabs.Screen name="explore"에 대응하는 파일이 존재해야 해서 이
// 빈 컴포넌트만 남겨둡니다.
export default function ExploreTabPlaceholder() {
  return null;
}
