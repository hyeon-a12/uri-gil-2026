import AsyncStorage from '@react-native-async-storage/async-storage';

const NICKNAME_KEY = 'profile:nickname';
const BIO_KEY = 'profile:bio';
const AVATAR_KEY = 'profile:avatarUri';

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
  const [nickname, bio, avatarUri] = await Promise.all([
    AsyncStorage.getItem(NICKNAME_KEY),
    AsyncStorage.getItem(BIO_KEY),
    AsyncStorage.getItem(AVATAR_KEY),
  ]);

  return {
    nickname: nickname ?? DEFAULT_PROFILE.nickname,
    bio: bio ?? DEFAULT_PROFILE.bio,
    avatarUri: avatarUri,
  };
}

export async function saveProfile(profile: Profile): Promise<void> {
  await Promise.all([
    AsyncStorage.setItem(NICKNAME_KEY, profile.nickname),
    AsyncStorage.setItem(BIO_KEY, profile.bio),
    profile.avatarUri
      ? AsyncStorage.setItem(AVATAR_KEY, profile.avatarUri)
      : AsyncStorage.removeItem(AVATAR_KEY),
  ]);
}
