import { create } from 'zustand';

import { DEFAULT_PROFILE, getProfile, saveProfile, type Profile } from '@/services/profileService';

/**
 * 닉네임/한줄소개/프로필 사진을 여러 화면(마이페이지, 나의 정보 관리 등)에서
 * 동시에 구독하기 위한 메모리 캐시입니다. useTripStore와 같은 패턴 —
 * 실제 값은 AsyncStorage(profileService)에 저장하고, Zustand는 화면 반영을
 * 빠르게 하기 위한 메모리 상태로만 씁니다.
 */
interface ProfileStoreState {
  profile: Profile;
  setProfile: (profile: Profile) => void;
}

export const useProfileStore = create<ProfileStoreState>((set) => ({
  profile: DEFAULT_PROFILE,
  setProfile: (profile) => set({ profile }),
}));

/** 프로필을 수정하고 AsyncStorage + Zustand를 동시에 갱신합니다. */
export async function updateProfile(profile: Profile): Promise<void> {
  await saveProfile(profile);
  useProfileStore.getState().setProfile(profile);
}

/** 앱 시작 시 AsyncStorage에 저장된 프로필을 Zustand 메모리 상태로 복원합니다. */
export async function hydrateProfile(): Promise<void> {
  const profile = await getProfile();
  useProfileStore.getState().setProfile(profile);
}
