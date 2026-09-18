import { create } from 'zustand';
import * as SecureStore from '@/services/secureStorage';

/**
 * 로그인 상태를 위한 메모리 상태입니다.
 *
 * [개인정보 보호 임시 방어책] 앱을 완전히 종료했다가 다시 켤 때
 * (cold start) 다른 계정의 정보가 잘못 표시되는 문제가 발견되어,
 * SecureStore에 로그인 토큰이 남아있어도 더 이상 자동 로그인하지
 * 않습니다. isLoggedIn은 오직 로그인 화면(login.tsx)에서 실제로
 * 로그인에 성공했을 때만 true가 됩니다. 근본 원인(Zustand persist /
 * 캐시 hydration 타이밍 문제로 추정)은 별도로 조사해서 고칠 예정이고,
 * 지금은 "재로그인 강제"로 노출을 막는 것이 목적입니다.
 *
 * 단, 이 컴포넌트 트리는 앱을 백그라운드로 보냈다가 포그라운드로
 * 가져오는 정도로는 다시 마운트되지 않으므로(=useEffect가 재실행되지
 * 않으므로), isLoggedIn은 세션 내내(완전 종료 전까지) 그대로 유지되어
 * 매번 재로그인을 요구하지는 않습니다.
 *
 * checked가 true가 되기 전까지는 앱 시작 시 확인이 끝나지 않은
 * 상태이므로, 이 값을 보고 첫 화면을 정합니다.
 * (src/app/_layout.tsx, src/app/index.tsx 참고)
 */
interface AuthStoreState {
  isLoggedIn: boolean;
  checked: boolean;
  /**
   * 이 기기에 로그인 토큰이 저장된 적이 있는지 여부입니다.
   * 절대 홈 화면 접근 권한으로 쓰지 않습니다 — 오직 "재설치 후 첫
   * 실행"과 "재실행"을 구분해 온보딩 캐러셀을 건너뛸지 판단하는
   * 용도로만 사용합니다 (src/app/index.tsx 참고).
   */
  hasStoredSession: boolean;
  setLoggedIn: (value: boolean) => void;
}

export const useAuthStore = create<AuthStoreState>((set) => ({
  isLoggedIn: false,
  checked: false,
  hasStoredSession: false,
  setLoggedIn: (value) => set({ isLoggedIn: value }),
}));

/**
 * 앱 시작(cold start) 시 한 번 호출됩니다.
 * SecureStore에 저장된 토큰이 있는지는 확인하지만, 그 값으로
 * isLoggedIn을 true로 만들지는 않습니다 — 반드시 로그인 화면에서
 * 다시 로그인해야만 isLoggedIn이 true가 됩니다.
 */
export async function hydrateAuth(): Promise<void> {
  const token = await SecureStore.getItemAsync('access_token');
  useAuthStore.setState({
    isLoggedIn: false,
    hasStoredSession: !!token,
    checked: true,
  });
}
