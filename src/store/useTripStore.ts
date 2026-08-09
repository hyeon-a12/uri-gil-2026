import { create } from 'zustand';

import type { FolderItem } from '@/services/folderService';
import { getAllFolders } from '@/services/folderService';
import { getActiveFolder } from '@/services/activeFolderService';

/**
 * "카메라와 연결된 여행(활성 폴더)"을 화면들이 재조회 없이 바로 구독할 수 있도록
 * 얹어두는 메모리 캐시입니다.
 *
 * 진실의 원천이 아닙니다 — 실제 여행 데이터는 여전히 folderService.ts(AsyncStorage)가,
 * "어떤 폴더가 활성 상태인지"는 activeFolderService.ts(AsyncStorage)가 담당합니다.
 * 그래서 persist 미들웨어를 쓰지 않습니다 — 여기서 별도의 AsyncStorage 키를 또 만들면
 * 저장 경로가 다시 두 갈래로 갈라지거든요. 대신 activeFolderService를 갱신하는 곳
 * (clip-manage.tsx)에서 이 스토어도 함께 갱신해서 캐시를 최신 상태로 맞춥니다.
 *
 * 앱을 재시작하면 메모리는 비어서 시작하므로, hydrateCurrentTrip()으로 AsyncStorage에
 * 저장돼 있던 값을 다시 채워 넣어야 합니다 (루트 레이아웃에서 앱 시작 시 1회 호출).
 */
interface TripStoreState {
  currentTrip: FolderItem | null;
  setCurrentTrip: (trip: FolderItem | null) => void;
  clearCurrentTrip: () => void;
}

export const useTripStore = create<TripStoreState>((set) => ({
  currentTrip: null,
  setCurrentTrip: (trip) => set({ currentTrip: trip }),
  clearCurrentTrip: () => set({ currentTrip: null }),
}));

/** 앱 시작 시 한 번 호출해서, 저장돼 있던 활성 폴더로 캐시를 채웁니다. */
export async function hydrateCurrentTrip(): Promise<void> {
  const activeFolderId = await getActiveFolder();
  if (!activeFolderId) return;

  const folders = await getAllFolders();
  const folder = folders.find((f) => f.id === activeFolderId);
  if (folder) {
    useTripStore.getState().setCurrentTrip(folder);
  }
}
