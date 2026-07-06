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
