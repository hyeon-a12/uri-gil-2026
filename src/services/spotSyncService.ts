// 다른 기기에서 촬영된 장소를 "영상 없이 이름만이라도" 보여주기 위한 조회 전용 서비스.
//
// 클립을 저장할 때(LocationConfirmScreen.tsx) 서버가 RouteSpot을 자동으로 만들어주기
// 때문에(uri_gil_backend/routers/clips.py), 영상 파일 자체가 아직 기기 간에 동기화되지
// 않아도 "어떤 장소를 방문했는지"는 이 엔드포인트로 이미 가져올 수 있습니다.

import { apiFetch } from './api';

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
