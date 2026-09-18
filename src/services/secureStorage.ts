import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * expo-secure-store의 웹 구현(ExpoSecureStore.web.ts)은 빈 스텁이라, 웹에서
 * SecureStore.getItemAsync 등을 그대로 호출하면 에러가 납니다. 이 모듈은
 * SecureStore와 동일한 함수 시그니처를 유지하면서, 웹에서만 localStorage로
 * 대체합니다 — 네이티브 Keychain/Keystore만큼 안전하진 않지만 이 프로젝트의
 * 웹 버전(공모전 제출용)에서 로그인 토큰을 유지하는 용도로는 충분합니다.
 * 네이티브(iOS/Android)에서는 기존 SecureStore 동작이 그대로 유지됩니다.
 */
export async function getItemAsync(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return window.localStorage.getItem(key);
    } catch (err) {
      console.warn('[secureStorage.getItemAsync] localStorage 접근 실패:', err);
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    window.localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    window.localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
