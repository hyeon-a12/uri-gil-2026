import { router } from 'expo-router';

/** 이미 알고 있는 장소로 바로 저장할 때 camera 화면에 넘기는 정보 */
export type QuickAddPlace = {
  name: string;
  latitude: number;
  longitude: number;
  /** 스톱 카드의 "클립 추가" 버튼으로 들어온 경우, 그 스톱의 id. 이 값이
   * 있어야 buildPlanData가 이름이 아니라 이 id로 정확히 그 스톱에만 클립을
   * 합칩니다(장소 검색으로 직접 새로 추가한 동명의 스톱과 안 섞이도록). */
  stopId?: string;
};

/**
 * 카메라 촬영 화면으로 이동합니다.
 *
 * quickAddPlace를 넘기면(내 루트의 스톱 카드 "클립 추가" 버튼처럼 장소가 이미
 * 정해져 있는 경우), 촬영 완료 후 location-confirm 화면을 거치지 않고
 * 바로 그 장소로 클립을 저장합니다.
 */
export function navigateToCamera(options?: {
  folderId?: string;
  quickAddPlace?: QuickAddPlace;
}) {
  const quickAddPlace = options?.quickAddPlace;

  router.push({
    pathname: '/camera',
    params: {
      folderId: options?.folderId,
      quickAddPlaceName: quickAddPlace?.name,
      quickAddLatitude: quickAddPlace ? String(quickAddPlace.latitude) : undefined,
      quickAddLongitude: quickAddPlace ? String(quickAddPlace.longitude) : undefined,
      quickAddStopId: quickAddPlace?.stopId,
    },
  });
}

/** 카메라 촬영 완료 후 장소 확인 화면으로 이동 */
export function navigateToLocationConfirm(
  videoUri: string,
  folderId?: string,
  durationMs?: number,
) {
  router.push({
    pathname: '/location-confirm',
    params: {
      videoUri,
      folderId,
      durationMs: durationMs !== undefined ? String(durationMs) : undefined,
    },
  });
}

/** 장소 확인 후 클립 화면으로 이동 */
export function navigateToClip(folderId?: string, folderTitle?: string) {
  if (!folderId) {
    router.push('/clip-select');
    return;
  }

  router.push({
    pathname: '/clip-select',
    params: { id: folderId, title: folderTitle },
  });
}
