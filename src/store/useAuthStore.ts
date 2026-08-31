import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

/**
 * "로그인 유지" 기능을 위한 메모리 상태입니다.
 * 실제 로그인 여부는 SecureStore의 access_token 존재 여부로 판단하고,
 * Zustand는 앱 전체에서 이 값을 빠르게 구독하기 위한 캐시로만 씁니다.
 *
 * checked가 true가 되기 전까지는 앱 시작 시 토큰 확인이 끝나지 않은
 * 상태이므로, 이 값을 보고 온보딩/로그인 화면으로 보낼지 홈으로 바로
 * 보낼지 결정합니다. (src/app/_layout.tsx, src/app/index.tsx 참고)
 */
interface AuthStoreState {
  isLoggedIn: boolean;
  checked: boolean;
  setLoggedIn: (value: boolean) => void;
}

export const useAuthStore = create<AuthStoreState>((set) => ({
  isLoggedIn: false,
  checked: false,
  setLoggedIn: (value) => set({ isLoggedIn: value }),
}));

/** 앱 시작 시 SecureStore에 저장된 로그인 토큰이 있는지 확인합니다. */
export async function hydrateAuth(): Promise<void> {
  const token = await SecureStore.getItemAsync('access_token');
  useAuthStore.setState({ isLoggedIn: !!token, checked: true });
}
