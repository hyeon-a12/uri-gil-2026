import { router } from 'expo-router';

/**
 * router.back()은 이 브라우저 세션에 실제로 쌓인 이동 기록이 있을 때만 동작합니다.
 * 모바일 브라우저가 메모리 확보를 위해 백그라운드 탭을 내렸다가 같은 주소로
 * 다시 불러오는 경우, 주소는 그대로인데 이동 기록은 비어있는 상태가 되어
 * router.back()이 아무 반응도 없이 조용히 실패합니다("뒤로가기 버튼이 안
 * 눌린다"는 증상의 원인). 이동 기록이 없을 때 대신 갈 곳(fallbackHref)을
 * 정해두면, 그런 경우에도 항상 어딘가로는 이동합니다.
 */
export function safeBack(fallbackHref: Parameters<typeof router.replace>[0]) {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallbackHref);
  }
}
