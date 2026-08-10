import { create } from 'zustand';

import type { FolderItem } from '@/services/folderService';
import { getAllFolders } from '@/services/folderService';

import {
  getActiveFolder,
  setActiveFolder,
  clearActiveFolder,
} from '@/services/activeFolderService';

/**
 * 현재 활성 여행을 여러 화면에서 바로 구독하기 위한 메모리 캐시입니다.
 *
 * 실제 여행 데이터:
 * folderService.ts / AsyncStorage
 *
 * 활성 여행 ID:
 * activeFolderService.ts / AsyncStorage
 *
 * Zustand는 화면 반영을 빠르게 하기 위한 메모리 상태로만 사용합니다.
 */
interface TripStoreState {
  currentTrip: FolderItem | null;

  setCurrentTrip: (trip: FolderItem | null) => void;

  clearCurrentTrip: () => void;
}

export const useTripStore = create<TripStoreState>((set) => ({
  currentTrip: null,

  setCurrentTrip: (trip) => {
    set({ currentTrip: trip });
  },

  clearCurrentTrip: () => {
    set({ currentTrip: null });
  },
}));

/**
 * 여행을 현재 활성 여행으로 변경합니다.
 *
 * AsyncStorage와 Zustand를 동시에 갱신합니다.
 */
export async function selectCurrentTrip(
  trip: FolderItem
): Promise<void> {
  await setActiveFolder(trip.id);

  useTripStore.getState().setCurrentTrip(trip);
}

/**
 * 현재 활성 여행을 해제합니다.
 */
export async function clearCurrentTrip():
  Promise<void> {
  await clearActiveFolder();

  useTripStore.getState().clearCurrentTrip();
}

/**
 * 앱 시작 시 AsyncStorage에 저장된 활성 여행을
 * Zustand 메모리 상태로 복원합니다.
 */
export async function hydrateCurrentTrip():
  Promise<void> {
  const activeFolderId = await getActiveFolder();

  if (!activeFolderId) {
    useTripStore.getState().clearCurrentTrip();
    return;
  }

  const folders = await getAllFolders();

  const folder = folders.find(
    (item) => item.id === activeFolderId
  );

  if (folder) {
    useTripStore.getState().setCurrentTrip(folder);
  } else {
    // 저장되어 있던 ID에 해당하는 여행이 없어진 경우
    await clearActiveFolder();

    useTripStore.getState().clearCurrentTrip();
  }
}