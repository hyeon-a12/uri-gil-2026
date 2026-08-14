import React, { useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { View, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { AppText as Text } from '@/components/AppText';
import { colors } from '@/constants/menu-theme';
import { cardShadow, ScreenHeader } from '@/components/common';

export default function ProfileEditScreen() {
  const [nickname, setNickname] = useState('');
  const [bio, setBio] = useState('여행은 계획보다 발견'); // TODO: bio는 아직 DB 컬럼이 없음

  useEffect(() => {
    SecureStore.getItemAsync('nickname').then((saved) => {
      if (saved) setNickname(saved);
    });
  }, []);

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
          router.replace('/login');
        },
      },
    ]);
  };

  // TODO: 실제 회원 탈퇴 처리(계정 삭제 API 호출 등)는 인증 플로우가 생기면 연결합니다.
  const handleWithdraw = () => {
    Alert.alert('회원 탈퇴', '탈퇴하면 저장된 여행 기록이 모두 삭제돼요. 계속할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '탈퇴', style: 'destructive', onPress: () => router.back() },
    ]);
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="나의 정보 관리" />

      <View style={styles.body}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Feather name="user" size={28} color={colors.accent} />
            <View style={styles.editDot}>
              <Feather name="edit-2" size={12} color="#fff" />
            </View>
          </View>
          <Text style={styles.name}>{nickname}</Text>
          <Text style={styles.joinDate}>가입일 2026.03.02</Text>
        </View>

        <Field label="닉네임" value={nickname} onChangeText={setNickname} />
        <Field label="한줄 소개" value={bio} onChangeText={setBio} />

        {/* 카카오 연동 계정은 수정 불가 — readonly */}
        <View style={styles.fieldWrap}>
          <Text style={styles.fieldLabel}>연결된 계정</Text>
          <View style={styles.readonlyBox}>
            <Text style={styles.readonlyText}>카카오 계정 연동됨</Text>
          </View>
        </View>

        <Pressable style={styles.outlineBtn} onPress={handleLogout}>
          <Text style={styles.outlineBtnText}>로그아웃</Text>
        </Pressable>

        <Pressable onPress={handleWithdraw}>
          <Text style={styles.footNote}>회원 탈퇴를 원하시나요?</Text>
        </Pressable>
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
  body: { flex: 1, paddingHorizontal: 16 },
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
  joinDate: { fontSize: 12, color: colors.textSub, marginTop: 2 },
  fieldWrap: { marginBottom: 14 },
  fieldLabel: { fontSize: 12, color: colors.textSub, fontWeight: '600', marginBottom: 6 },
  fieldBox: {
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldInput: { flex: 1, fontSize: 14, color: colors.text, paddingVertical: 10 },
  readonlyBox: { backgroundColor: colors.card, borderRadius: 12, padding: 13 },
  readonlyText: { fontSize: 14, color: colors.textSub },
  outlineBtn: {
    marginTop: 6,
    padding: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
  },
  outlineBtnText: { fontSize: 13, fontWeight: '700', color: colors.textSub },
  footNote: { fontSize: 11, color: colors.textTertiary, textAlign: 'center', marginTop: 18 },
});
