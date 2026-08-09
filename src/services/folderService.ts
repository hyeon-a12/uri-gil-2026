import AsyncStorage from "@react-native-async-storage/async-storage";

const FOLDERS_KEY = '@folders/all';

export interface FolderItem {
    id: string;
    title: string;
    dateRange: string;
    thumbnail: string;
    isCurrentActive?: boolean;
    isMerged?: boolean;
}

interface StoredFolder extends FolderItem {
    createdAt: number;
}

export async function getAllFolders(): Promise<FolderItem[]> {
    try {
        const raw = await AsyncStorage.getItem(FOLDERS_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as StoredFolder[];
        return parsed.sort((a, b) => b.createdAt - a.createdAt);
    } catch (err) {
        console.warn('[FolderService.getAllFolders] failed:', err);
        return [];
    }
}

export async function saveFolder(folder: FolderItem): Promise<void> {
    const all = await getAllFolders();
    const updated = [
        folder, ...all.filter((f) => f.id !== folder.id),
    ];
    await AsyncStorage.setItem(
        FOLDERS_KEY,
        JSON.stringify(updated),
    );
}

export async function deleteFolder(id: string): Promise<void> {
    const all = await getAllFolders();
    const updated = all.filter((f) => f.id !== id);
    await AsyncStorage.setItem(
        FOLDERS_KEY, JSON.stringify(updated),
    );
}

export async function updateFolder(id: string, updates: Partial<FolderItem>,): Promise<void> {
    const all = await getAllFolders();
    const updated = all.map((f) => f.id === id ? { ...f, ...updates } : f,);
    await AsyncStorage.setItem(
        FOLDERS_KEY, JSON.stringify(updated),
    );
}
