import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { hydrateCurrentTrip } from '@/store/useTripStore';
import { hydrateProfile } from '@/store/useProfileStore';
import { hydrateAuth, useAuthStore } from '@/store/useAuthStore';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const authChecked = useAuthStore((state) => state.checked);
  // hydrateAuth()는 SecureStore를 한 번만 읽어서 금방 끝나는데, hydrateProfile/
  // hydrateCurrentTrip은 AsyncStorage를 여러 번 읽어서 상대적으로 느립니다.
  // 예전엔 authChecked만 기다리고 화면을 풀어줘서, 홈 화면이 이 둘이 끝나기
  // 전의 기본값(프로필 기본 닉네임 "텅굴이", 빈 여행)으로 잠깐 렌더됐다가
  // 뒤늦게 실제 데이터로 다시 그려지는 순간이 있었습니다 — 이게 "다른 계정
  // 정보가 잘못 표시된다"는 버그 리포트의 실제 원인으로 보입니다. 이 값도
  // 함께 기다려서 홈 화면이 항상 올바른 데이터로만 렌더되게 합니다.
  const [dataHydrated, setDataHydrated] = useState(false);

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
    if (fontsLoaded && authChecked && dataHydrated) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, authChecked, dataHydrated]);

  // useTripStore/useProfileStore는 메모리 캐시라 앱을 새로 켜면 비어있는
  // 상태로 시작합니다. AsyncStorage에 저장돼 있던 값으로 한 번 채워두되,
  // 이 두 개가 끝나기 전엔 아래 렌더 게이트가 안 풀리도록 완료를 기다립니다.
  useEffect(() => {
    (async () => {
      // 하이드레이션이 실패해도(손상된 저장값 등) 스플래시 화면에 영원히
      // 멈춰있으면 안 되므로, 실패 시에도 반드시 게이트를 풀어줍니다 —
      // 이 경우엔 기본값으로라도 화면을 띄우는 게 무한 로딩보다 낫습니다.
      try {
        await Promise.all([hydrateCurrentTrip(), hydrateProfile()]);
      } catch (error) {
        console.warn('[RootLayout] 프로필/여행 하이드레이션 실패:', error);
      } finally {
        setDataHydrated(true);
      }
    })();

    // "로그인 유지": SecureStore에 토큰이 남아있는지 앱 시작 시 한 번
    // 확인해둡니다. index.tsx가 이 값을 보고 첫 화면을 정합니다. 이건
    // 위 하이드레이션과 별개로 자체 checked 상태를 갱신하므로 따로 둡니다.
    void hydrateAuth();
  }, []);

  if (!fontsLoaded || !authChecked || !dataHydrated) {
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
