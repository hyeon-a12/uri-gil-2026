import AsyncStorage from "@react-native-async-storage/async-storage";

import { getCurrentUserId } from './authService';

// 계정별로 "마지막에 보던 활성 여행"을 분리하기 위해 user_id를 키에 섞습니다.
function activeFolderKey(userId: string) {
    return `activeFolderId:${userId}`;
}

export async function setActiveFolder(folderId: string): Promise<void> {
    const userId = await getCurrentUserId();
    if (!userId) return;

    await AsyncStorage.setItem(activeFolderKey(userId), folderId);
}

export async function getActiveFolder(): Promise<string | null> {
    const userId = await getCurrentUserId();
    if (!userId) return null;

    return await AsyncStorage.getItem(activeFolderKey(userId));
}

export async function clearActiveFolder(): Promise<void> {
    const userId = await getCurrentUserId();
    if (!userId) return;

    await AsyncStorage.removeItem(activeFolderKey(userId));
}
