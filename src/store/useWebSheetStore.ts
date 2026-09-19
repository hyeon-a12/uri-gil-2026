import { create } from 'zustand';

/**
 * 웹 전용: 화면 하단에서 올라오는 큰 시트(PlaceDetailModal 등)가 지금
 * 열려있는지 여부입니다.
 *
 * 전역 촬영 플로팅 버튼(WebCameraFab, (tabs)/_layout.tsx)은 항상 화면 우측
 * 하단에 떠 있는데, 홈/내 경로 화면에서 장소 카드를 눌러 뜨는
 * PlaceDetailModal도 화면 하단에서 올라오는 자체 오버레이라 서로 다른
 * 컴포넌트 트리에 있습니다. react-navigation의 탭 화면 컨테이너가 자체
 * stacking context를 만드는 경우가 있어서, 시트 쪽 z-index를 아무리 높여도
 * 전역 버튼이 화면 트리상 더 나중에 그려지는 형제 요소라 그 위에 겹쳐 보일
 * 수 있습니다 — 그래서 z-index 싸움 대신, 시트가 열려있는 동안은 버튼을
 * 아예 숨겨서 확실하게 안 겹치도록 전역 상태로 공유합니다.
 */
interface WebSheetState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export const useWebSheetStore = create<WebSheetState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
