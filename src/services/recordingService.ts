import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as VideoThumbnails from 'expo-video-thumbnails';

import type { RecordingData } from '@/types/recording';
import { getCurrentUserId } from './authService';

// 계정별로 촬영 클립 목록을 분리하기 위해 user_id를 키에 섞습니다.
function storageKey(userId: string) {
    return `recordings/${userId}`;
}
const VIDEO_DIR = FileSystem.documentDirectory + 'recordings/';

async function ensureVideoDir(): Promise<void> {
    const info = await FileSystem.getInfoAsync(VIDEO_DIR);
    if (!info.exists) {
        await FileSystem.makeDirectoryAsync(VIDEO_DIR, { intermediates: true });
    }
}

function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// saveRecording/deleteRecording류는 전부 "목록 전체를 읽고 → 수정하고 →
// 통째로 다시 쓰는" 패턴이라, 두 호출이 동시에 겹치면 나중에 끝난 쪽이
// 먼저 쓴 결과를 덮어써서 클립 하나가 통째로 사라질 수 있습니다(파일은
// 디스크에 남지만 목록엔 안 보임). 화면 쪽에서 중복 호출을 막는 가드를
// 둬도, 서로 다른 화면에서 동시에 저장/삭제가 일어날 가능성까지 막으려면
// 이 모듈을 드나드는 모든 읽기-수정-쓰기 구간을 한 줄로 직렬화해야 합니다.
let writeQueue: Promise<unknown> = Promise.resolve();

function withWriteLock<T>(task: () => Promise<T>): Promise<T> {
    const result = writeQueue.then(task, task);
    writeQueue = result.then(
        () => undefined,
        () => undefined,
    );
    return result;
}

// recordAsync()가 resolve된 직후에도, (특히 Expo Go 안드로이드에서) 실제
// 임시 영상 파일이 디스크에 완전히 flush되기 전이라 곧바로 copyAsync를
// 하면 "isn't readable" IOException이 나는 경우가 있습니다. 짧게 재시도해서
// 그 타이밍 창을 넘깁니다.
async function persistVideoFile(tempUri: string, id: string): Promise<string> {
    await ensureVideoDir();
    const newPath = `${VIDEO_DIR}${id}.mp4`;

    const RETRY_DELAYS_MS = [200, 400, 800];
    for (let attempt = 0; ; attempt += 1) {
        try {
            await FileSystem.copyAsync({ from: tempUri, to: newPath });
            return newPath;
        } catch (error) {
            if (attempt >= RETRY_DELAYS_MS.length) {
                throw error;
            }
            console.warn(
                `[persistVideoFile] copyAsync 실패, ${RETRY_DELAYS_MS[attempt]}ms 뒤 재시도 (${attempt + 1}/${RETRY_DELAYS_MS.length}):`,
                error,
            );
            await wait(RETRY_DELAYS_MS[attempt]);
        }
    }
}

// 영상 파일 경로를 그대로 thumbnail로 저장하면(과거 방식) <Image>가 mp4를
// 디코드하지 못해 홈/클립 목록 어디서도 실제 그림이 안 뜨고 빈 배경만
// 보입니다. 실제 프레임을 뽑아 별도 jpg로 저장해서 이 문제를 없앱니다.
// 실패해도(코덱 미지원 등) 빈 문자열을 돌려주면 기존 UI가 이미 placeholder로
// 대체해서 보여주므로 저장 자체를 막을 필요는 없습니다.
async function persistThumbnail(videoUri: string, id: string): Promise<string> {
    try {
        const { uri: cacheUri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
            time: 0,
        });
        await ensureVideoDir();
        const newPath = `${VIDEO_DIR}${id}_thumb.jpg`;
        await FileSystem.copyAsync({ from: cacheUri, to: newPath });
        return newPath;
    } catch (error) {
        console.warn('[persistThumbnail] 썸네일 생성 실패:', error);
        return '';
    }
}

export async function saveRecording(
    data: Omit<RecordingData, 'id' | 'videoUri' | 'thumbnail'> & { videoUri: string },
): Promise<RecordingData> {
    const userId = await getCurrentUserId();
    if (!userId) {
        throw new Error('[saveRecording] 로그인 상태가 아니어서 저장할 수 없습니다.');
    }

    const id = `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const persistedUri = await persistVideoFile(data.videoUri, id);
    const thumbnail = await persistThumbnail(persistedUri, id);

    const record: RecordingData = {
        ...data,
        id,
        videoUri: persistedUri,
        thumbnail,
        durationMs: data.durationMs ?? 0,
    };

    await withWriteLock(async () => {
        const existing = await getAllRecordings();
        const updated = [...existing, record];
        await AsyncStorage.setItem(storageKey(userId), JSON.stringify(updated));
    });

    return record;
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

    const raw = await AsyncStorage.getItem(storageKey(userId));
    if (!raw) return [];
    try {
        return JSON.parse(raw) as RecordingData[];
    } catch (error) {
        console.error('[getAllRecordings] 파싱 실패:', error);
        return [];
    }
}

async function deleteFileIfExists(uri: string): Promise<void> {
    if (!uri) return;
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) {
        await FileSystem.deleteAsync(uri);
    }
}

export async function deleteRecording(id: string): Promise<void> {
    const userId = await getCurrentUserId();
    if (!userId) return;

    await withWriteLock(async () => {
        const all = await getAllRecordings();
        const target = all.find((r) => r.id === id);

        if (target) {
            await deleteFileIfExists(target.videoUri);
            await deleteFileIfExists(target.thumbnail);
        }

        const filtered = all.filter((r) => r.id != id);
        await AsyncStorage.setItem(storageKey(userId), JSON.stringify(filtered));
    });
}

/**
 * 클립 여러 개를 한 번에 지웁니다. deleteRecording()을 Promise.all로 여러 번
 * 동시에 부르면 각 호출이 "삭제 전" 목록을 따로 읽어서 자기 것만 뺀 걸 저장하다가
 * 서로 덮어써서 결국 1개만 지워진 것처럼 남는 경쟁 상태(race condition)가
 * 생깁니다. 여기서는 목록을 한 번만 읽고, 한 번만 써서 그 문제를 피합니다.
 */
export async function deleteRecordings(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    const userId = await getCurrentUserId();
    if (!userId) return;

    await withWriteLock(async () => {
        const idSet = new Set(ids);
        const all = await getAllRecordings();
        const targets = all.filter((r) => idSet.has(r.id));

        await Promise.all(
            targets.map(async (target) => {
                await deleteFileIfExists(target.videoUri);
                await deleteFileIfExists(target.thumbnail);
            }),
        );

        const filtered = all.filter((r) => !idSet.has(r.id));
        await AsyncStorage.setItem(storageKey(userId), JSON.stringify(filtered));
    });
}

export async function clearAllRecordings(): Promise<void> {
    const userId = await getCurrentUserId();
    if (!userId) return;

    await withWriteLock(async () => {
        const all = await getAllRecordings();
        for (const r of all) {
            await deleteFileIfExists(r.videoUri);
            await deleteFileIfExists(r.thumbnail);
        }
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
    const all = await getAllRecordings();
    const updated = all.map((r) =>
      r.id === localId ? { ...r, serverId } : r,
    );
    await AsyncStorage.setItem(storageKey(userId), JSON.stringify(updated));
  });
}
