import AsyncStorage from "@react-native-async-storage/async-storage";

const FOLDERS_KEY = '@folders/all';

// NewTripModal의 촬영 스타일 선택지와 그대로 맞춰둔 타입 (원래 NewTripModal.tsx 안에서만
// 쓰던 로컬 타입이었는데, 저장 스키마(FolderItem)에도 필요해져서 여기로 옮겼습니다).
export type ShootingStyleId = 'basic' | 'grid' | 'doll' | 'mirror';
export type GridTemplateId = 'rows3' | 'rows2' | 'cols2' | 'grid4';

// NewTripModal의 GRID_TEMPLATES 선택지와 슬롯 개수를 맞춰둔 값입니다. FolderItem엔
// gridTemplateId만 저장되고 슬롯 개수는 안 저장되니, 필요한 곳(CameraScreen 등)에서
// 이 매핑으로 개수를 구합니다.
export const GRID_TEMPLATE_SLOT_COUNTS: Record<GridTemplateId, number> = {
    rows3: 3,
    rows2: 2,
    cols2: 2,
    grid4: 4,
};

export interface FolderItem {
    id: string;
    title: string;
    dateRange: string;
    thumbnail: string;

    // 여행 만들기 모달에서 입력받지만 예전에는 저장 안 되고 버려지던 필드들.
    // 기존에 이미 저장된 폴더에는 없을 수 있어서 전부 optional로 둡니다.
    region?: string | null;
    memo?: string;
    partySize?: number;
    themes?: string[];
    clipLengthSeconds?: number;
    shootingStyle?: ShootingStyleId;
    gridTemplateId?: GridTemplateId | null;
    isCurrentActive?: boolean;
    isMerged?: boolean;
}

interface StoredFolder extends FolderItem {
    createdAt: number;
}

export type FolderStatus = 'before' | 'ing' | 'done';

// dateRange는 항상 "YYYY.MM.DD. ~ YYYY.MM.DD." 형태로 저장됨 (clip-manage.tsx에서 생성).
// 여기서 다시 Date로 파싱해서 상태를 계산 — 별도로 startDate/endDate를 저장할 필요가 없음.
// getFolderStatus 밖에서도(예: my-route.tsx의 박수 계산) 필요해져서 export합니다.
export function parseDateRange(dateRange: string): { start: Date; end: Date } | null {
    const match = dateRange.match(
        /^(\d{4})\.(\d{2})\.(\d{2})\.\s*~\s*(\d{4})\.(\d{2})\.(\d{2})\.?$/,
    );
    if (!match) return null;

    const [, sy, sm, sd, ey, em, ed] = match;
    return {
        start: new Date(Number(sy), Number(sm) - 1, Number(sd)),
        end: new Date(Number(ey), Number(em) - 1, Number(ed), 23, 59, 59),
    };
}

/** 여행 진행 상태(예정/여행중/완료). dateRange를 못 읽으면 null. */
export function getFolderStatus(
    folder: FolderItem,
    now: Date = new Date(),
): FolderStatus | null {
    const range = parseDateRange(folder.dateRange);
    if (!range) return null;
    if (now < range.start) return 'before';
    if (now > range.end) return 'done';
    return 'ing';
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
