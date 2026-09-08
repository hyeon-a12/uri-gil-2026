/** GPS 기반 장소 추천 항목 */
export type LocationSuggestion = {
  id: string;
  name: string;
  category: string;
  distanceMeters: number;
  address: string;
};

/**
 * 카메라 촬영 후 장소 확인 화면으로 넘길 파라미터.
 * 팀원 카메라 화면에서 router.push 시 videoUri만 넘기면 됩니다.
 */
export type LocationConfirmParams = {
  videoUri?: string;
};

/**
 * 로컬 저장/DB에 보관되는 최종 클립 데이터.
 * 위치 확정 화면에서 saveRecording() 호출 시 이 형태로 저장됨.
 */
export type RecordingData = {
  id: string;
  recordedAt: string;
  videoUri: string;
  thumbnail: string;
  durationMs?: number;
  folderId: string;
  userId: string;
  location: {
    latitude: number;
    longitude: number;
    placeName?: string;
    /** 이 클립을 "클립 추가" 버튼으로 촬영한 경로 탭 스톱(AI 추천/직접 추가)의
     * id. 있으면 tripPlanService.buildPlanData가 장소 이름이 아니라 이 id로
     * 정확히 그 스톱에만 합칩니다 — 이름이 같다는 이유만으로 다른 스톱과
     * 잘못 합쳐지는 걸 막기 위함입니다. */
    linkedStopId?: string;
  };
};
