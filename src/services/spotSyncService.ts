// 다른 기기에서 촬영된 장소를 "영상 없이 이름만이라도" 보여주기 위한 조회 전용 서비스.
//
// 클립을 저장할 때(LocationConfirmScreen.tsx) 서버가 RouteSpot을 자동으로 만들어주기
// 때문에(uri_gil_backend/routers/clips.py), 영상 파일 자체가 아직 기기 간에 동기화되지
// 않아도 "어떤 장소를 방문했는지"는 이 엔드포인트로 이미 가져올 수 있습니다.

import { apiFetch } from './api';
import { getRecordingsByFolder } from './recordingService';

export interface ServerSpot {
    id: number;
    route_id: number;
    spot_name: string;
    latitude: number | null;
    longitude: number | null;
    visit_order: number;
    visited_at: string | null; // ISO datetime
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
        apiFetch(`/clips/route/${routeId}`).catch(() => []),
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
        clipCount: Math.max(recordings.length, Array.isArray(serverClips) ? serverClips.length : 0),
    };
}
