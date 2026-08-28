import { router } from 'expo-router';

/** 카메라 촬영 화면으로 이동 */
export function navigateToCamera(folderId?: string) {
  router.push({
    pathname: '/camera',
    params: { folderId },
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
