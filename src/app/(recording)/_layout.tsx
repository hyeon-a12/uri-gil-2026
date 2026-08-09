import { Stack } from 'expo-router';

/**
 * 촬영 → 장소/여행 선택으로 이어지는 흐름을 하나의 모달 안에 묶는 레이아웃.
 *
 * camera, location-confirm이 각각 루트 Stack에 fullScreenModal로 따로 등록돼 있으면,
 * 모달(camera) 안에서 router.push로 다른 화면(location-confirm)으로 넘어갈 때
 * 상태는 바뀌는데 화면이 시각적으로 전환되지 않는 Expo Router 버그가 있음
 * (https://github.com/expo/expo/issues/26922).
 *
 * 그래서 이 그룹 전체를 하나의 fullScreenModal로 감싸고, 그 안에서는 camera → location-confirm이
 * 평범한 push/back으로 동작하게 함. 그룹 이름 (recording)은 URL 경로에는 나타나지 않으므로
 * router.push('/camera'), router.push('/location-confirm') 호출부는 그대로 둬도 됨.
 */
export default function RecordingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="camera" />
      <Stack.Screen name="location-confirm" />
    </Stack>
  );
}
