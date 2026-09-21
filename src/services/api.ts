import { Platform } from 'react-native';
import * as SecureStore from './secureStorage';

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

// 전역 fetch()는 (New Architecture 환경에서) FormData의 파일 파트({ uri, name,
// type })를 아직 처리하지 못해 "Unsupported FormDataPart implementation" 에러를
// 던집니다(video-edit.tsx의 renderVideo와 동일한 이슈) — XHR로 우회합니다.
function uploadFormData(
  url: string,
  formData: FormData,
  token: string | null,
): Promise<{ status: number; ok: boolean; text: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }
    xhr.onload = () => {
      resolve({
        status: xhr.status,
        ok: xhr.status >= 200 && xhr.status < 300,
        text: xhr.responseText,
      });
    };
    xhr.onerror = () => reject(new Error('네트워크 요청에 실패했습니다.'));
    xhr.send(formData as any);
  });
}

/**
 * 로컬 파일(RN이면 file://..., 웹이면 blob:.../data:...)을 /clips/upload로
 * 올리고 서버(Supabase Storage)의 실제 URL을 돌려줍니다. 이 엔드포인트는
 * 파일 종류를 가리지 않아서(영상/이미지 공용) 촬영 클립 영상과 썸네일 둘 다
 * 이 함수를 거칩니다.
 */
async function uploadClipFile(
  uri: string,
  filename: string,
  webMimeType: string,
): Promise<string> {
  const formData = new FormData();

  if (Platform.OS === 'web') {
    // 웹의 FormData는 { uri, name, type } 같은 RN 전용 형태를 이해하지 못해서,
    // blob:/data: URL을 실제 Blob으로 변환해 붙여야 진짜 바이트가 전송됩니다.
    const blob = await fetch(uri).then((res) => res.blob());
    formData.append('file', blob, filename);
  } else {
    formData.append('file', {
      uri,
      name: filename,
      type: webMimeType,
    } as any);
  }

  const token = await SecureStore.getItemAsync('access_token');
  const response = await uploadFormData(`${API_URL}/clips/upload`, formData, token);

  if (!response.ok) {
    const data = await Promise.resolve(response.text)
      .then((text) => JSON.parse(text))
      .catch(() => null);
    throw new Error(extractErrorMessage(data, '파일 업로드에 실패했습니다.'));
  }

  const data = JSON.parse(response.text);
  return data.url as string;
}

/**
 * 촬영 직후의 로컬 영상 파일을 서버(Supabase Storage)에 업로드하고, 다른
 * 기기/브라우저에서도 접근 가능한 실제 URL을 돌려줍니다. 로컬 경로를 그대로
 * clip_url로 저장하면 그 경로는 촬영한 기기에만 존재해서 다른 기기에서는
 * 재생할 수 없습니다 — 반드시 이 함수가 돌려주는 URL을 clip_url로 저장해야 합니다.
 */
export async function uploadClipVideo(videoUri: string): Promise<string> {
  return Platform.OS === 'web'
    ? uploadClipFile(videoUri, `clip_${Date.now()}.webm`, 'video/webm')
    : uploadClipFile(videoUri, `clip_${Date.now()}.mp4`, 'video/mp4');
}

/**
 * 로컬에서만 생성되던 썸네일(네이티브는 jpg 파일 경로, 웹은 canvas로 만든
 * data:image/jpeg URL)을 서버에 업로드합니다. 클립 영상과 마찬가지로, 이
 * URL을 thumbnail_url로 저장해야 다른 기기에서도 미리보기 이미지가 보입니다.
 */
export async function uploadClipThumbnail(thumbnailUri: string): Promise<string> {
  return uploadClipFile(thumbnailUri, `thumb_${Date.now()}.jpg`, 'image/jpeg');
}