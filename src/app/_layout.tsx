import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { hydrateCurrentTrip } from '@/store/useTripStore';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'SpoqaHanSansNeo-Thin': require('../../assets/fonts/SpoqaHanSansNeo-Thin.ttf'),
    'SpoqaHanSansNeo-Light': require('../../assets/fonts/SpoqaHanSansNeo-Light.ttf'),
    'SpoqaHanSansNeo-Regular': require('../../assets/fonts/SpoqaHanSansNeo-Regular.ttf'),
    'SpoqaHanSansNeo-Medium': require('../../assets/fonts/SpoqaHanSansNeo-Medium.ttf'),
    'SpoqaHanSansNeo-Bold': require('../../assets/fonts/SpoqaHanSansNeo-Bold.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  // useTripStore는 메모리 캐시라 앱을 새로 켜면 비어있는 상태로 시작합니다.
  // AsyncStorage에 저장돼 있던 활성 폴더로 한 번 채워둡니다.
  useEffect(() => {
    void hydrateCurrentTrip();
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
       <Stack.Screen name="onboarding" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      {/* 촬영 → 장소/여행 선택 흐름 전체를 하나의 모달로 묶음 (자세한 이유는 (recording)/_layout.tsx 참고) */}
      <Stack.Screen
        name="(recording)"
        options={{
          presentation: 'fullScreenModal',
          animation: 'slide_from_bottom',
        }}
      />
    </Stack>
  );
}
