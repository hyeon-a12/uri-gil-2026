import { create } from 'zustand';

/**
 * 웹 전용 햄버거 메뉴(사이드 메뉴)의 열림/닫힘 상태입니다.
 *
 * 메뉴를 여는 버튼(AppHeader, 각 화면 상단)과 메뉴 패널(SideMenu, 탭
 * 레이아웃 최상단에 한 번만 렌더)이 서로 다른 컴포넌트 트리에 있어서,
 * 전역 상태로 공유합니다. 네이티브에는 이 메뉴 자체가 없어서 이 파일도
 * 웹에서만 쓰이지만, 네이티브 전용 API를 쓰지 않는 순수 상태 저장소라
 * .web. 접미사 없이도 안전합니다.
 */
interface WebMenuState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export const useWebMenuStore = create<WebMenuState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
