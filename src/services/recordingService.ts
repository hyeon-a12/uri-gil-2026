import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

import type { RecordingData } from '@/types/recording';

const STORAGE_KEY = 'recordings';
const VIDEO_DIR = FileSystem.documentDirectory + 'recordings/';

async function ensureVideoDir(): Promise<void> {
    const info = await FileSystem.getInfoAsync(VIDEO_DIR);
    if (!info.exists) {
        await FileSystem.makeDirectoryAsync(VIDEO_DIR, { intermediates: true });
    }
}

async function persistVideoFile(tempUri: string, id: string): Promise<string> {
    await ensureVideoDir();
    const newPath = `${VIDEO_DIR}${id}.mp4`;
    await FileSystem.copyAsync({ from: tempUri, to: newPath });
    return newPath;
}

export async function saveRecording(
    data: Omit<RecordingData, 'id' | 'videoUri'> & { videoUri: string },
): Promise<RecordingData> {
    const id = `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const persistedUri = await persistVideoFile(data.videoUri, id);

    const record: RecordingData = {
        ...data,
        id,
        videoUri: persistedUri,
        durationMs: data.durationMs ?? 0,
    };

    const existing = await getAllRecordings();
    const updated = [...existing, record];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    console.log('[saveRecording] 저장 완료:', record.id);
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
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
        return JSON.parse(raw) as RecordingData[];
    } catch (error) {
        console.error('[getAllRecordings] 파싱 실패:', error);
        return [];
    }
}

export async function deleteRecording(id: string): Promise<void> {
    const all = await getAllRecordings();
    const target = all.find((r) => r.id === id);

    if (target) {
        const info = await FileSystem.getInfoAsync(target.videoUri);
        if (info.exists) {
            await FileSystem.deleteAsync(target.videoUri);
        }
    }

    const filtered = all.filter((r) => r.id != id);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

export async function clearAllRecordings(): Promise<void> {
    const all = await getAllRecordings();
    for (const r of all) {
        const info = await FileSystem.getInfoAsync(r.videoUri);
        if (info.exists) {
            await FileSystem.deleteAsync(r.videoUri);
        }
    }
    await AsyncStorage.removeItem(STORAGE_KEY);
}
