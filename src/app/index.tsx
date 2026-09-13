import { Redirect } from 'expo-router';
import { useAuthStore } from '@/store/useAuthStore';

export default function Index() {
  // _layout.tsx가 hydrateAuth를 먼저 끝내고 나서야 이 화면이 렌더되므로,
  // 여기서는 결과값만 보고 바로 첫 화면을 정하면 됩니다.
  //
  // [개인정보 보호 임시 방어책] cold start 직후에는 isLoggedIn이 항상
  // false이므로 절대 자동으로 홈 화면을 보여주지 않습니다. isLoggedIn은
  // 오직 로그인 화면에서 이번 세션에 실제로 로그인에 성공했을 때만
  // true가 됩니다 (useAuthStore.ts 참고).
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  // hasStoredSession은 이 기기에 로그인 이력이 있는지만 나타내며, 접근
  // 권한과는 무관합니다 — 재설치 후 첫 실행이 아니라면 온보딩 캐러셀을
  // 건너뛰고 바로 로그인 화면부터 보여주기 위한 용도로만 씁니다.
  const hasStoredSession = useAuthStore((state) => state.hasStoredSession);

  if (isLoggedIn) {
    return <Redirect href="/(tabs)/home" />;
  }

  return <Redirect href={hasStoredSession ? '/login' : '/onboarding'} />;
}
