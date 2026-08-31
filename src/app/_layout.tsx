import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { hydrateCurrentTrip } from '@/store/useTripStore';
import { hydrateProfile } from '@/store/useProfileStore';
import { hydrateAuth, useAuthStore } from '@/store/useAuthStore';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const authChecked = useAuthStore((state) => state.checked);

  const [fontsLoaded] = useFonts({
    'Pretendard-Thin': require('../../assets/fonts/Pretendard-Thin.ttf'),
    'Pretendard-ExtraLight': require('../../assets/fonts/Pretendard-ExtraLight.ttf'),
    'Pretendard-Light': require('../../assets/fonts/Pretendard-Light.ttf'),
    'Pretendard-Regular': require('../../assets/fonts/Pretendard-Regular.ttf'),
    'Pretendard-Medium': require('../../assets/fonts/Pretendard-Medium.ttf'),
    'Pretendard-SemiBold': require('../../assets/fonts/Pretendard-SemiBold.ttf'),
    'Pretendard-Bold': require('../../assets/fonts/Pretendard-Bold.ttf'),
    'Pretendard-ExtraBold': require('../../assets/fonts/Pretendard-ExtraBold.ttf'),
    'Pretendard-Black': require('../../assets/fonts/Pretendard-Black.ttf'),
    'MaruBuri-Regular': require('../../assets/fonts/MaruBuri-Regular.ttf'),
    'MaruBuri-Bold': require('../../assets/fonts/MaruBuri-Bold.ttf'),
    'KERISKEDU-Regular': require('../../assets/fonts/KERISKEDU_R.ttf'),
    'KERISKEDU-Bold': require('../../assets/fonts/KERISKEDU_B.ttf'),
    'HakgyoansimNadeuri-Light': require('../../assets/fonts/HakgyoansimNadeuri-Light.ttf'),
    'HakgyoansimNadeuri-Bold': require('../../assets/fonts/HakgyoansimNadeuri-Bold.ttf'),
    'HakgyoansimByeolbichhaneul-Light': require('../../assets/fonts/HakgyoansimByeolbichhaneul-Light.ttf'),
    'HakgyoansimByeolbichhaneul-Bold': require('../../assets/fonts/HakgyoansimByeolbichhaneul-Bold.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded && authChecked) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, authChecked]);

  // useTripStore는 메모리 캐시라 앱을 새로 켜면 비어있는 상태로 시작합니다.
  // AsyncStorage에 저장돼 있던 활성 폴더로 한 번 채워둡니다.
  useEffect(() => {
    void hydrateCurrentTrip();
    void hydrateProfile();
    // "로그인 유지": SecureStore에 토큰이 남아있으면 로그인 화면을 건너뛸 수 있도록
    // 앱 시작 시 한 번 확인해둡니다. index.tsx가 이 값을 보고 첫 화면을 정합니다.
    void hydrateAuth();
  }, []);

  if (!fontsLoaded || !authChecked) {
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
