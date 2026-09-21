import AsyncStorage from "@react-native-async-storage/async-storage";

import { getCurrentUserId } from './authService';
import { apiFetch } from './api';
import { getRecordingsByFolder, deleteRecordings } from './recordingService';

// 계정별로 여행 목록을 분리하기 위해 user_id를 키에 섞습니다.
// (같은 기기에서 계정을 바꿔도 이전 계정의 여행이 보이지 않도록)
function foldersKey(userId: string) {
    return `@folders/${userId}`;
}

// saveFolder/updateFolder/deleteFolder는 전부 "전체 목록을 읽고 → 수정하고 →
// 통째로 다시 쓰는" 패턴이라, 두 호출이 겹치면 나중에 끝난 쪽이 먼저 쓴 걸
// 덮어써서 여행 하나가 통째로 사라질 수 있습니다(recordingService.ts의
// saveRecording에 있던 것과 같은 문제). 이 모듈을 드나드는 모든 쓰기를
// 한 줄로 직렬화해서 막습니다.
let writeQueue: Promise<unknown> = Promise.resolve();

function withWriteLock<T>(task: () => Promise<T>): Promise<T> {
    const result = writeQueue.then(task, task);
    writeQueue = result.then(
        () => undefined,
        () => undefined,
    );
    return result;
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

    await withWriteLock(async () => {
        const all = await getAllFolders();
        const updated = [
            folder, ...all.filter((f) => f.id !== folder.id),
        ];
        await AsyncStorage.setItem(
            foldersKey(userId),
            JSON.stringify(updated),
        );
    });
}

export async function deleteFolder(id: string): Promise<void> {
    const userId = await getCurrentUserId();
    if (!userId) return;

    // 로컬 클립 정리와 서버 route 삭제는 목록 자체를 건드리지 않으니 잠금 밖에서
    // 수행하고, "목록 읽기 → 걸러내기 → 통째로 쓰기" 구간만 직렬화합니다.
    const all = await getAllFolders();
    const target = all.find((f) => f.id === id);

    const recordings = await getRecordingsByFolder(id);
    await deleteRecordings(recordings.map((r) => r.id));

    if (target?.routeId) {
        try {
            await apiFetch(`/routes/${target.routeId}`, { method: 'DELETE' });
        } catch (error) {
            console.error('[deleteFolder] 서버 route 삭제 실패:', error);
        }
    }

    await withWriteLock(async () => {
        const current = await getAllFolders();
        const updated = current.filter((f) => f.id !== id);
        await AsyncStorage.setItem(
            foldersKey(userId), JSON.stringify(updated),
        );
    });
}

interface ServerRoute {
    id: number;
    title: string;
    region: string | null;
    theme: string | null;
    description: string | null;
    start_date: string | null; // "YYYY-MM-DD" (Pydantic date)
    end_date: string | null;
    member_count: number | null;
    created_at: string;
}

// 서버 date("YYYY-MM-DD")를 dateRange 저장 형식("YYYY.MM.DD. ~ YYYY.MM.DD.")으로 변환.
// 둘 중 하나라도 없으면 null(호출하는 쪽에서 기존 dateRange를 그대로 둠).
function toDateRangeString(start: string | null, end: string | null): string | null {
    if (!start || !end) return null;
    const dot = (iso: string) => `${iso.replace(/-/g, '.')}.`;
    return `${dot(start)} ~ ${dot(end)}`;
}

/**
 * 서버에 저장된 내 여행 목록(GET /routes/user/{id})을 불러와 로컬 목록과 합칩니다.
 * 다른 기기에서 로그인했을 때 그 기기에서 만든 여행이 안 보이는 문제를 해결하기 위한 것으로,
 * 로그인 직후(login.tsx / login.web.tsx)에 호출합니다.
 *
 * - 서버에만 있는 여행(routeId로 매칭 안 됨)은 로컬에 새로 추가
 * - 로컬에도 이미 있는 여행은 서버 필드(title/region/theme/설명/기간/인원)만 갱신하고,
 *   서버에 저장 안 되는 로컬 전용 필드(thumbnail, shootingStyle, clipLengthSeconds 등)는 그대로 둠
 * - routeId가 없는 로컬 여행(오프라인 생성 등 서버 저장 실패분)은 건드리지 않음
 * - routeId가 있는데 서버 목록엔 없는 로컬 여행(다른 기기에서 삭제됨)은 이 기기에서도 지우고,
 *   딸린 클립도 같이 정리함
 *
 * 클립(촬영 영상) 자체는 여기서 다루지 않습니다 — clip_url이 아직 로컬 기기 경로라
 * 서버에서 받아와도 재생할 수 없는 상태라, 별도 작업(실제 파일 업로드)이 필요합니다.
 */
export async function syncFoldersFromServer(): Promise<void> {
    const userId = await getCurrentUserId();
    if (!userId) return;

    let serverRoutes: ServerRoute[];
    try {
        serverRoutes = await apiFetch(`/routes/user/${userId}`);
    } catch (err) {
        console.warn('[FolderService.syncFoldersFromServer] 서버 여행 목록 조회 실패:', err);
        return;
    }

    const serverRouteIds = new Set(serverRoutes.map((r) => r.id));

    // 다른 기기에서 삭제된(서버 목록에 더는 없는) 여행은 이 기기에서도 지웁니다.
    // 목록 자체를 건드리는 게 아니라서(딸린 클립 정리) withWriteLock 밖에서 먼저 처리합니다 —
    // deleteFolder()가 서버 route를 지우는 것과 같은 패턴이되, 서버 삭제는 이미 끝났으니 생략합니다.
    const before = await getAllFolders();
    const removedFolderIds = before
        .filter((f) => f.routeId != null && !serverRouteIds.has(f.routeId))
        .map((f) => f.id);
    for (const folderId of removedFolderIds) {
        const recordings = await getRecordingsByFolder(folderId);
        await deleteRecordings(recordings.map((r) => r.id));
    }

    await withWriteLock(async () => {
        const raw = await AsyncStorage.getItem(foldersKey(userId));
        const stored: StoredFolder[] = raw ? JSON.parse(raw) : [];
        const local = stored.filter(
            (f) => f.routeId == null || serverRouteIds.has(f.routeId),
        );
        const byRouteId = new Map(
            local.filter((f) => f.routeId != null).map((f) => [f.routeId, f] as const),
        );

        for (const route of serverRoutes) {
            const dateRange = toDateRangeString(route.start_date, route.end_date);
            const themes = route.theme ? route.theme.split(',').filter(Boolean) : undefined;
            const existing = byRouteId.get(route.id);

            if (existing) {
                existing.title = route.title;
                existing.region = route.region;
                existing.memo = route.description ?? existing.memo;
                existing.partySize = route.member_count ?? existing.partySize;
                if (themes) existing.themes = themes;
                if (dateRange) existing.dateRange = dateRange;
            } else {
                local.push({
                    id: `folder-server-${route.id}`,
                    routeId: route.id,
                    title: route.title,
                    dateRange: dateRange ?? '',
                    thumbnail: '',
                    region: route.region,
                    memo: route.description ?? undefined,
                    partySize: route.member_count ?? undefined,
                    themes,
                    createdAt: new Date(route.created_at).getTime(),
                });
            }
        }

        await AsyncStorage.setItem(foldersKey(userId), JSON.stringify(local));
    });
}

export async function updateFolder(id: string, updates: Partial<FolderItem>,): Promise<void> {
    const userId = await getCurrentUserId();
    if (!userId) return;

    await withWriteLock(async () => {
        const all = await getAllFolders();
        const updated = all.map((f) => f.id === id ? { ...f, ...updates } : f,);
        await AsyncStorage.setItem(
            foldersKey(userId), JSON.stringify(updated),
        );
    });
}
