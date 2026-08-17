import { router } from 'expo-router';

/** 카메라 촬영 화면으로 이동 */
export function navigateToCamera(folderId?: string) {
  router.push({
    pathname: '/camera',
    params: { folderId },
  });
}

/**
 * 카메라 촬영 완료 후 장소 확인 화면으로 이동.
 *
 * 그리드 촬영(칸을 나눠 순서대로 찍는 모드)은 클립을 여러 개 한 번에 넘겨야 해서
 * videoUri/durationMs에 배열도 받을 수 있게 했습니다. 기존처럼 문자열/숫자 하나만
 * 넘기던 호출부는 그대로 동작해요(내부에서 배열 하나짜리로 감싸줌).
 */
export function navigateToLocationConfirm(
  videoUri: string | string[],
  folderId?: string,
  durationMs?: number | number[],
  gridGroupId?: string,
) {
  const videoUris = Array.isArray(videoUri) ? videoUri : [videoUri];
  const durationsMs = Array.isArray(durationMs)
    ? durationMs
    : durationMs !== undefined
      ? [durationMs]
      : undefined;

  router.push({
    pathname: '/location-confirm',
    params: {
      videoUris: JSON.stringify(videoUris),
      folderId,
      durationsMs: durationsMs ? JSON.stringify(durationsMs) : undefined,
      gridGroupId,
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
