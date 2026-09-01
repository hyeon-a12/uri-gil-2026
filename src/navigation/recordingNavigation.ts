import { router } from 'expo-router';

/** 이미 알고 있는 장소로 바로 저장할 때 camera 화면에 넘기는 정보 */
export type QuickAddPlace = {
  name: string;
  latitude: number;
  longitude: number;
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
