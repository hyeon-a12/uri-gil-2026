import * as SecureStore from 'expo-secure-store';

/**
 * 로그인한 사용자의 user_id를 SecureStore에서 가져옵니다.
 * 로그인 화면(src/app/(auth)/login.tsx)에서 로그인 성공 시 SecureStore에
 * 문자열로 저장해두는 값과 짝을 이룹니다.
 *
 * AsyncStorage 기반 로컬 데이터(여행/클립/프로필 등)를 계정별로 분리하는
 * 모든 서비스가 이 값을 키에 섞어 씁니다. 로그인 전이거나 조회 실패 시
 * null을 반환하며, 호출하는 쪽에서 예외를 던지지 않습니다.
 */
export async function getCurrentUserId(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync('user_id');
  } catch (err) {
    console.warn('[authService.getCurrentUserId] failed:', err);
    return null;
  }
}
