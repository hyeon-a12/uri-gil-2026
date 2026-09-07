import AsyncStorage from '@react-native-async-storage/async-storage';

import { getCurrentUserId } from './authService';

// 계정별로 프로필을 분리하기 위해 user_id를 키에 섞습니다.
function nicknameKey(userId: string) {
  return `profile:${userId}:nickname`;
}
function bioKey(userId: string) {
  return `profile:${userId}:bio`;
}
function avatarKey(userId: string) {
  return `profile:${userId}:avatarUri`;
}

export interface Profile {
  nickname: string;
  bio: string;
  avatarUri: string | null;
}

export const DEFAULT_PROFILE: Profile = {
  nickname: '텅굴이',
  bio: '여행은 계획보다 발견',
  avatarUri: null,
};

export async function getProfile(): Promise<Profile> {
  const userId = await getCurrentUserId();
  if (!userId) return DEFAULT_PROFILE;

  const [nickname, bio, avatarUri] = await Promise.all([
    AsyncStorage.getItem(nicknameKey(userId)),
    AsyncStorage.getItem(bioKey(userId)),
    AsyncStorage.getItem(avatarKey(userId)),
  ]);

  return {
    nickname: nickname ?? DEFAULT_PROFILE.nickname,
    bio: bio ?? DEFAULT_PROFILE.bio,
    avatarUri: avatarUri,
  };
}

export async function saveProfile(profile: Profile): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;

  await Promise.all([
    AsyncStorage.setItem(nicknameKey(userId), profile.nickname),
    AsyncStorage.setItem(bioKey(userId), profile.bio),
    profile.avatarUri
      ? AsyncStorage.setItem(avatarKey(userId), profile.avatarUri)
      : AsyncStorage.removeItem(avatarKey(userId)),
  ]);
}
