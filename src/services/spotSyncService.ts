// 다른 기기에서 촬영된 장소/클립을 조회하기 위한 서비스.
//
// 클립을 저장할 때(LocationConfirmScreen.tsx) 서버가 RouteSpot을 자동으로 만들어주기
// 때문에(uri_gil_backend/routers/clips.py), "어떤 장소를 방문했는지"는 이 엔드포인트로
// 이미 가져올 수 있습니다. 클립 영상 자체도 이제 Supabase Storage에 실제 URL로
// 업로드되므로(api.ts의 uploadClipVideo), 다른 기기에서 찍은 클립도 이 URL로 그대로
// 재생할 수 있습니다 — getMergedRecordingsByFolder()가 로컬 기록과 합쳐줍니다.

import { apiFetch } from './api';
import { getAllFolders } from './folderService';
import { getRecordingsByFolder } from './recordingService';
import type { RecordingData } from '@/types/recording';

export interface ServerSpot {
    id: number;
    route_id: number;
    spot_name: string;
    latitude: number | null;
    longitude: number | null;
    visit_order: number;
    visited_at: string | null; // ISO datetime
}

export interface ServerClip {
    id: number;
    route_id: number;
    user_id: number;
    spot_id: number | null;
    clip_url: string;
    clip_order: number | null;
    recorded_at: string | null; // ISO datetime (타임존 표시 없을 수 있음)
    duration_ms: number | null;
    thumbnail_url: string | null;
}

/** 실패해도(오프라인 등) 화면이 죽지 않도록 빈 배열로 대체합니다 — 읽기 전용 보강 데이터라서. */
export async function fetchServerSpots(routeId: number): Promise<ServerSpot[]> {
    try {
        return await apiFetch(`/spots/route/${routeId}`);
    } catch (err) {
        console.warn('[spotSyncService.fetchServerSpots] 실패:', err);
        return [];
    }
}

/** 실패해도(오프라인 등) 화면이 죽지 않도록 빈 배열로 대체합니다 — 읽기 전용 보강 데이터라서. */
export async function fetchServerClips(routeId: number): Promise<ServerClip[]> {
    try {
        return await apiFetch(`/clips/route/${routeId}`);
    } catch (err) {
        console.warn('[spotSyncService.fetchServerClips] 실패:', err);
        return [];
    }
}

// 백엔드 DateTime 컬럼이 타임존 정보 없이 저장돼 있어서(models.py, timezone=True 아님),
// 서버가 돌려주는 시각 문자열엔 "Z"/오프셋 표시가 없습니다. 실제로는 UTC 값인데 표시가
// 없으면 JS의 new Date()가 기기 로컬 시간으로 잘못 해석해버려서(tripPlanService.ts와
// 동일한 이슈), 명시적으로 UTC로 보정합니다.
function toUtcIsoString(value: string): string {
    return /[Zz]|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`;
}

/**
 * 로컬 recordings에 없는(다른 기기에서 촬영된) 서버 클립을, 실제 재생 가능한
 * videoUri(Supabase Storage URL)를 가진 합성 RecordingData로 만들어 로컬 목록에
 * 합칩니다. 클립 관리/홈/내 루트 화면이 전부 getRecordingsByFolder() 대신 이 함수를
 * 쓰면, 어느 기기에서 찍었든 같은 클립 목록을 보게 됩니다.
 *
 * 서버가 thumbnail_url을 안 갖고 있는(구버전 클립) 경우엔 빈 문자열로 두고,
 * UI는 이미 빈 썸네일을 "재생 아이콘만" 있는 카드로 처리하고 있어 화면이
 * 깨지지 않습니다.
 */
export async function getMergedRecordingsByFolder(
    folderId: string,
): Promise<RecordingData[]> {
    const [localRecordings, folders] = await Promise.all([
        getRecordingsByFolder(folderId),
        getAllFolders(),
    ]);

    const routeId = folders.find((f) => f.id === folderId)?.routeId;
    if (!routeId) return localRecordings;

    const localServerIds = new Set(
        localRecordings.map((r) => r.serverId).filter((id): id is number => id != null),
    );

    const [serverClips, serverSpots] = await Promise.all([
        fetchServerClips(routeId),
        fetchServerSpots(routeId),
    ]);

    const spotById = new Map(serverSpots.map((s) => [s.id, s]));

    const remoteOnly: RecordingData[] = serverClips
        .filter((clip) => !localServerIds.has(clip.id))
        .map((clip) => {
            const spot = clip.spot_id != null ? spotById.get(clip.spot_id) : undefined;
            return {
                id: `server_${clip.id}`,
                serverId: clip.id,
                recordedAt: toUtcIsoString(clip.recorded_at ?? new Date().toISOString()),
                videoUri: clip.clip_url,
                thumbnail: clip.thumbnail_url ?? '',
                durationMs: clip.duration_ms ?? undefined,
                folderId,
                location: {
                    // 좌표를 모르는 스팟(GPS 실패 등)을 0으로 채우면 진짜 (0,0)
                    // 좌표와 구분이 안 돼서 지도에 엉뚱한 위치(적도 부근)에 핀이
                    // 찍힙니다. RecordingData.location.latitude/longitude 타입이
                    // 항상 number라 null을 못 넣으니, "좌표 없음"을 나타내는
                    // 용도로만 NaN을 씁니다 — 소비하는 쪽(RoutePlanView.tsx의
                    // dayMapPins 등)에서 Number.isFinite()로 걸러내야 합니다.
                    latitude: spot?.latitude ?? Number.NaN,
                    longitude: spot?.longitude ?? Number.NaN,
                    placeName: spot?.spot_name,
                },
            };
        });

    return [...localRecordings, ...remoteOnly].sort((a, b) =>
        a.recordedAt.localeCompare(b.recordedAt),
    );
}

export interface FolderVisitStats {
    visitedCount: number;
    clipCount: number;
}

/**
 * 마이페이지 통계("방문한 장소")와 내 경로 리스트("방문 N곳 · 클립 M개")가
 * 로컬 recordings만 보고 계산되면, 다른 기기/브라우저에서 찍은 클립은 전혀
 * 반영되지 않아 화면마다 숫자가 달라 보입니다(지도 화면은 이미 서버 스팟과
 * 병합해서 보여주는데 이 통계만 로컬 전용이었음). routeId가 있으면 서버의
 * 스팟/클립도 함께 합쳐서, 어느 기기에서 봐도 같은 숫자가 나오게 합니다.
 */
export async function getFolderVisitStats(
    folderId: string,
    routeId: number | undefined,
): Promise<FolderVisitStats> {
    const recordings = await getRecordingsByFolder(folderId);
    const localNames = recordings
        .map((r) => r.location.placeName)
        .filter((name): name is string => Boolean(name));

    if (!routeId) {
        return {
            visitedCount: new Set(localNames).size,
            clipCount: recordings.length,
        };
    }

    const [serverSpots, serverClips] = await Promise.all([
        fetchServerSpots(routeId),
        fetchServerClips(routeId),
    ]);

    const visitedNames = new Set(localNames);
    for (const spot of serverSpots) {
        if (spot.visited_at) {
            visitedNames.add(spot.spot_name);
        }
    }

    return {
        visitedCount: visitedNames.size,
        // 이 기기의 저장이 아직 서버에 반영 안 됐을 수도(오프라인), 서버에는
        // 있는데 이 기기엔 없을 수도(다른 기기에서 촬영) 있어서 둘 중 큰 쪽을
        // 씁니다 — 어느 쪽도 놓치지 않는 안전한 하한선입니다.
        clipCount: Math.max(recordings.length, serverClips.length),
    };
}
