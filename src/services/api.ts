import * as SecureStore from 'expo-secure-store';

const API_URL = 'https://uri-gil-2026-production.up.railway.app';

/**
 * 서버 에러 응답의 detail을 항상 문자열로 안전하게 뽑아냅니다.
 *
 * FastAPI(Pydantic)는 요청 바디 검증에 실패하면(예: 이메일 형식이 EmailStr
 * 규칙에 안 맞음) 422를 응답하는데, 이때 detail은 문자열이 아니라
 * [{ msg, loc, ... }] 형태의 배열로 내려옵니다. 이 값을 그대로
 * Alert.alert(title, message)의 message 자리에 넘기면 message가
 * 문자열이 아니어서 네이티브 Alert 브릿지에서 크래시가 납니다 —
 * 서버 에러를 화면에 보여줄 땐 반드시 이 함수를 거쳐야 합니다.
 */
export function extractErrorMessage(data: unknown, fallback: string): string {
  const detail = (data as { detail?: unknown } | null)?.detail;

  if (typeof detail === 'string' && detail.trim()) {
    return detail;
  }

  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0];
    if (first && typeof first === 'object' && typeof (first as { msg?: unknown }).msg === 'string') {
      return (first as { msg: string }).msg;
    }
  }

  return fallback;
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = await SecureStore.getItemAsync('access_token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(extractErrorMessage(data, '서버 요청에 실패했습니다.'));
  }

  return data;
}