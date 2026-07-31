import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = 'activeFolderId';

export async function setActiveFolder(folderId: string): Promise<void> {
    await AsyncStorage.setItem(KEY, folderId);
}

export async function getActiveFolder(): Promise<string | null> {
    return await AsyncStorage.getItem(KEY);
}

export async function clearActiveFolder(): Promise<void> {
    await AsyncStorage.removeItem(KEY);
}
