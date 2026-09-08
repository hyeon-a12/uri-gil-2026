import AsyncStorage from "@react-native-async-storage/async-storage";

import { getCurrentUserId } from './authService';
import { apiFetch } from './api';
import { getRecordingsByFolder, deleteRecordings } from './recordingService';

// 계정별로 여행 목록을 분리하기 위해 user_id를 키에 섞습니다.
// (같은 기기에서 계정을 바꿔도 이전 계정의 여행이 보이지 않도록)
function foldersKey(userId: string) {
    return `@folders/${userId}`;
}

// NewTripModal의 촬영 스타일 선택지와 그대로 맞춰둔 타입 (원래 NewTripModal.tsx 안에서만
// 쓰던 로컬 타입이었는데, 저장 스키마(FolderItem)에도 필요해져서 여기로 옮겼습니다).
export type ShootingStyleId = 'basic' | 'doll' | 'mirror';

export interface FolderItem {
    id: string;
    title: string;
    dateRange: string;
    thumbnail: string;
    routeId?: number;

    // 여행 만들기 모달에서 입력받지만 예전에는 저장 안 되고 버려지던 필드들.
    // 기존에 이미 저장된 폴더에는 없을 수 있어서 전부 optional로 둡니다.
    region?: string | null;
    memo?: string;
    partySize?: number;
    themes?: string[];
    clipLengthSeconds?: number;
    shootingStyle?: ShootingStyleId;
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
    const userId = await getCurrentUserId();
    if (!userId) return [];

    try {
        const raw = await AsyncStorage.getItem(foldersKey(userId));
        if (!raw) return [];
        const parsed = JSON.parse(raw) as StoredFolder[];
        // 여행 목록은 만든 순서가 아니라 실제 여행 날짜(dateRange 시작일) 기준
        // 최신순으로 정렬합니다. 날짜를 못 읽는 오래된 데이터는 생성 시각으로 대체합니다.
        return parsed.sort((a, b) => {
            const aTime = parseDateRange(a.dateRange)?.start.getTime() ?? a.createdAt;
            const bTime = parseDateRange(b.dateRange)?.start.getTime() ?? b.createdAt;
            return bTime - aTime;
        });
    } catch (err) {
        console.warn('[FolderService.getAllFolders] failed:', err);
        return [];
    }
}

export async function saveFolder(folder: FolderItem): Promise<void> {
    const userId = await getCurrentUserId();
    if (!userId) return;

    const all = await getAllFolders();
    const updated = [
        folder, ...all.filter((f) => f.id !== folder.id),
    ];
    await AsyncStorage.setItem(
        foldersKey(userId),
        JSON.stringify(updated),
    );
}

export async function deleteFolder(id: string): Promise<void> {
    const userId = await getCurrentUserId();
    if (!userId) return;

    const all = await getAllFolders();
    const target = all.find((f) => f.id === id);

    // 로컬 클립도 함께 정리
    const recordings = await getRecordingsByFolder(id);
    await deleteRecordings(recordings.map((r) => r.id));

    // 서버에도 route 삭제 반영 (CASCADE로 spots/clips/videos까지 함께 삭제됨)
    if (target?.routeId) {
        try {
            await apiFetch(`/routes/${target.routeId}`, { method: 'DELETE' });
        } catch (error) {
            console.error('[deleteFolder] 서버 route 삭제 실패:', error);
        }
    }

    const updated = all.filter((f) => f.id !== id);
    await AsyncStorage.setItem(
        foldersKey(userId), JSON.stringify(updated),
    );
}

export async function updateFolder(id: string, updates: Partial<FolderItem>,): Promise<void> {
    const userId = await getCurrentUserId();
    if (!userId) return;

    const all = await getAllFolders();
    const updated = all.map((f) => f.id === id ? { ...f, ...updates } : f,);
    await AsyncStorage.setItem(
        foldersKey(userId), JSON.stringify(updated),
    );
}
