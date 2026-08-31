import { Redirect } from 'expo-router';
import { useAuthStore } from '@/store/useAuthStore';

export default function Index() {
  // _layout.tsx가 hydrateAuth를 먼저 끝내고 나서야 이 화면이 렌더되므로,
  // 여기서는 결과값(isLoggedIn)만 보고 바로 첫 화면을 정하면 됩니다.
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);

  return <Redirect href={isLoggedIn ? '/(tabs)/home' : '/onboarding'} />;
}
