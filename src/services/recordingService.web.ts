import AsyncStorage from '@react-native-async-storage/async-storage';

import type { RecordingData } from '@/types/recording';
import { getCurrentUserId } from './authService';
import { putVideoBlob, getVideoBlob, deleteVideoBlob, clearVideoBlobs } from './videoBlobStore.web';

/**
 * recordingService.ts의 웹 버전입니다. Metro의 플랫폼 확장자 규칙에 따라
 * 웹 번들에서는 recordingService.ts 대신 이 파일이 자동으로 쓰입니다
 * (호출하는 화면 쪽 코드는 전혀 수정할 필요 없음).
 *
 * expo-file-system이 웹에서 빈 스텁이라 네이티브와 똑같이 파일시스템에
 * mp4를 복사해둘 수 없어서, 영상 원본은 IndexedDB(videoBlobStore.web.ts)에
 * Blob으로 저장하고, 목록/메타데이터만 네이티브와 동일하게 AsyncStorage에
 * JSON으로 저장합니다.
 *
 * videoUri에는 실제 blob: URL 대신 IndexedDB 키(=클립 id)를 저장해둡니다 —
 * blob: URL은 페이지를 새로고침하면 무효화되기 때문에, 재생이 필요한 시점
 * (getAllRecordings 등)마다 저장된 Blob으로 새 blob: URL을 매번 새로 만들어
 * 돌려줍니다.
 */

function storageKey(userId: string) {
  return `recordings/${userId}`;
}

// 네이티브 recordingService.ts와 동일한 이유로 필요한 쓰기 직렬화 큐입니다.
let writeQueue: Promise<unknown> = Promise.resolve();

function withWriteLock<T>(task: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(task, task);
  writeQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

/**
 * 촬영 직후의 blob: URL(브라우저 메모리에만 존재)에서 실제 Blob 데이터를
 * 꺼내옵니다. fetch()로 blob: URL을 읽으면 참조하고 있던 Blob 원본을
 * 그대로 돌려받을 수 있습니다.
 */
async function fetchBlob(blobUri: string): Promise<Blob> {
  const response = await fetch(blobUri);
  return response.blob();
}

/**
 * 영상의 첫 프레임을 캔버스로 캡처해 JPEG data URL로 반환합니다.
 * expo-video-thumbnails는 웹에서 항상 에러를 던지는 스텁이라 직접 구현했습니다.
 * 실패해도(디코딩 불가 등) 빈 문자열을 돌려주면 기존 UI가 placeholder로
 * 대체해서 보여주므로 저장 자체를 막을 필요는 없습니다.
 */
function generateThumbnail(videoUri: string): Promise<string> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = videoUri;

    const cleanup = () => {
      video.onloadeddata = null;
      video.onseeked = null;
      video.onerror = null;
    };

    video.onloadeddata = () => {
      try {
        video.currentTime = 0;
      } catch (error) {
        cleanup();
        console.warn('[recordingService.web] 썸네일 seek 실패:', error);
        resolve('');
      }
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 360;
        canvas.height = video.videoHeight || 640;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('2D canvas context를 만들 수 없습니다.');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        cleanup();
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      } catch (error) {
        cleanup();
        console.warn('[recordingService.web] 썸네일 캡처 실패:', error);
        resolve('');
      }
    };

    video.onerror = () => {
      cleanup();
      console.warn('[recordingService.web] 썸네일용 영상 로드 실패');
      resolve('');
    };
  });
}

export async function saveRecording(
  data: Omit<RecordingData, 'id' | 'videoUri' | 'thumbnail'> & { videoUri: string },
): Promise<RecordingData> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('[saveRecording] 로그인 상태가 아니어서 저장할 수 없습니다.');
  }

  const id = `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const blob = await fetchBlob(data.videoUri);
  await putVideoBlob(id, blob);

  const thumbnail = await generateThumbnail(data.videoUri);

  const record: RecordingData = {
    ...data,
    id,
    videoUri: id,
    thumbnail,
    durationMs: data.durationMs ?? 0,
  };

  await withWriteLock(async () => {
    const existing = await getStoredList(userId);
    const updated = [...existing, record];
    await AsyncStorage.setItem(storageKey(userId), JSON.stringify(updated));
  });

  // 호출한 화면은 저장 직후 바로 재생 가능한 URL이 필요할 수 있으므로,
  // IndexedDB 키 대신 이미 갖고 있던 blob: URL을 그대로 돌려줍니다.
  return { ...record, videoUri: data.videoUri };
}

async function getStoredList(userId: string): Promise<RecordingData[]> {
  const raw = await AsyncStorage.getItem(storageKey(userId));
  if (!raw) return [];
  try {
    return JSON.parse(raw) as RecordingData[];
  } catch (error) {
    console.error('[getStoredList] 파싱 실패:', error);
    return [];
  }
}

/** 저장된 IndexedDB 키(record.videoUri)를 실제로 재생 가능한 blob: URL로 바꿔줍니다. */
async function resolvePlayableUri(record: RecordingData): Promise<RecordingData> {
  const blob = await getVideoBlob(record.videoUri);
  if (!blob) return record;
  return { ...record, videoUri: URL.createObjectURL(blob) };
}

export async function getRecordingsByFolder(
  folderId: string,
): Promise<RecordingData[]> {
  const all = await getAllRecordings();
  return all
    .filter((r) => r.folderId === folderId)
    .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
}

export async function getAllRecordings(): Promise<RecordingData[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const stored = await getStoredList(userId);
  return Promise.all(stored.map(resolvePlayableUri));
}

export async function deleteRecording(id: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;

  await withWriteLock(async () => {
    const all = await getStoredList(userId);
    const target = all.find((r) => r.id === id);

    if (target) {
      await deleteVideoBlob(target.videoUri);
    }

    const filtered = all.filter((r) => r.id !== id);
    await AsyncStorage.setItem(storageKey(userId), JSON.stringify(filtered));
  });
}

export async function deleteRecordings(ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  const userId = await getCurrentUserId();
  if (!userId) return;

  await withWriteLock(async () => {
    const idSet = new Set(ids);
    const all = await getStoredList(userId);
    const targets = all.filter((r) => idSet.has(r.id));

    await Promise.all(targets.map((target) => deleteVideoBlob(target.videoUri)));

    const filtered = all.filter((r) => !idSet.has(r.id));
    await AsyncStorage.setItem(storageKey(userId), JSON.stringify(filtered));
  });
}

export async function clearAllRecordings(): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;

  await withWriteLock(async () => {
    await clearVideoBlobs();
    await AsyncStorage.removeItem(storageKey(userId));
  });
}

export async function updateRecordingServerId(
  localId: string,
  serverId: number,
): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;

  await withWriteLock(async () => {
    const all = await getStoredList(userId);
    const updated = all.map((r) =>
      r.id === localId ? { ...r, serverId } : r,
    );
    await AsyncStorage.setItem(storageKey(userId), JSON.stringify(updated));
  });
}
