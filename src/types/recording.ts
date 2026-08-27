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
  };
  /**
   * 그리드 촬영(칸별로 나눠 찍어 나중에 분할 화면으로 합칠 클립들)일 때만 채워짐.
   * 같은 그리드 세트의 클립들이 공유하는 묶음 id — 서버에서 합칠 때 이 id로 grouping.
   */
  gridGroupId?: string;
  /** 그리드 세트 안에서 몇 번째 칸이었는지 (0부터 시작). */
  gridSlotIndex?: number;
};
