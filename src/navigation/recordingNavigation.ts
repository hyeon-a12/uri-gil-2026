import { router } from 'expo-router';

/** 카메라 촬영 화면으로 이동 */
export function navigateToCamera() {
  router.push('/camera');
}

/** 카메라 촬영 완료 후 장소 확인 화면으로 이동 */
export function navigateToLocationConfirm(videoUri: string) {
  router.push({
    pathname: '/location-confirm',
    params: { videoUri },
  });
}
