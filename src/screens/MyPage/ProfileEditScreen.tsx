import React, { useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { View, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { AppText as Text } from '@/components/AppText';
import { colors } from '@/constants/menu-theme';
import { cardShadow, ScreenHeader, PrimaryButton } from '@/components/common';
import { useProfileStore, updateProfile } from '@/store/useProfileStore';
import { useAuthStore } from '@/store/useAuthStore';
import { apiFetch } from '@/services/api';

export default function ProfileEditScreen() {
  const profile = useProfileStore((state) => state.profile);

  const [nickname, setNickname] = useState(profile.nickname);
  const [bio, setBio] = useState(profile.bio);
  const [avatarUri, setAvatarUri] = useState(profile.avatarUri);

  // 시스템 사진 선택 도구(Android Photo Picker/iOS PHPicker)는 앱에 갤러리
  // 읽기 권한을 주지 않고도 동작해서, 프로필 사진처럼 가끔 한 번 고르는
  // 용도로는 권한 요청 없이 바로 열면 됩니다.
  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    const trimmedNickname = nickname.trim();
    if (!trimmedNickname) {
      Alert.alert('닉네임을 입력해주세요');
      return;
    }

    await updateProfile({ nickname: trimmedNickname, bio: bio.trim(), avatarUri });
    router.back();
  };

  const handleLogout = () => {
    Alert.alert('로그아웃', '로그아웃 하시겠어요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: async () => {
          await SecureStore.deleteItemAsync('access_token');
          await SecureStore.deleteItemAsync('user_id');
          await SecureStore.deleteItemAsync('nickname');
          useAuthStore.getState().setLoggedIn(false);
          router.replace('/onboarding');
        },
      },
    ]);
  };

  const handleWithdraw = () => {
    Alert.alert('회원 탈퇴', '탈퇴하면 저장된 여행 기록이 모두 삭제돼요. 계속할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '탈퇴',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiFetch('/auth/me', { method: 'DELETE' });
            await SecureStore.deleteItemAsync('access_token');
            await SecureStore.deleteItemAsync('user_id');
            await SecureStore.deleteItemAsync('nickname');
            useAuthStore.getState().setLoggedIn(false);
            router.replace('/onboarding');
          } catch (error) {
            console.error('[handleWithdraw] 탈퇴 실패:', error);
            Alert.alert('탈퇴 실패', '잠시 후 다시 시도해주세요.');
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="나의 정보 관리" />

      <View style={styles.body}>
        <View>
          <View style={styles.profileCard}>
            <Pressable style={styles.avatar} onPress={pickAvatar}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              ) : (
                <Feather name="user" size={28} color={colors.accent} />
              )}
              <View style={styles.editDot}>
                <Feather name="edit-2" size={12} color="#fff" />
              </View>
            </Pressable>
            <Text style={styles.name}>{nickname}</Text>
          </View>

          <Field label="닉네임" value={nickname} onChangeText={setNickname} />
          <Field label="한줄 소개" value={bio} onChangeText={setBio} />

          <PrimaryButton label="저장" onPress={handleSave} style={styles.saveButton} />
        </View>

        <View style={styles.bottomButtons}>
          <Pressable style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutButtonText}>로그아웃</Text>
          </Pressable>
          <Pressable style={styles.withdrawButton} onPress={handleWithdraw}>
            <Text style={styles.withdrawButtonText}>회원 탈퇴</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (next: string) => void;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldBox}>
        <TextInput value={value} onChangeText={onChangeText} style={styles.fieldInput} />
        <Feather name="edit-2" size={15} color={colors.textTertiary} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 24,
    justifyContent: 'space-between',
  },
  profileCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    paddingVertical: 24,
    alignItems: 'center',
    marginBottom: 16,
    ...cardShadow,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  editDot: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.card,
  },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  fieldWrap: { marginBottom: 14 },
  fieldLabel: { fontSize: 13, color: colors.text, fontWeight: '600', marginBottom: 6 },
  fieldBox: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldInput: { flex: 1, fontSize: 12, fontFamily: 'Pretendard-Regular', color: colors.text, paddingVertical: 10 },
  saveButton: { marginTop: 6, marginBottom: 12 },
  bottomButtons: { flexDirection: 'row', gap: 10, marginBottom: 32 },
  logoutButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  logoutButtonText: { fontSize: 14, fontWeight: '700', color: colors.text },
  withdrawButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.danger,
    alignItems: 'center',
  },
  withdrawButtonText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});
