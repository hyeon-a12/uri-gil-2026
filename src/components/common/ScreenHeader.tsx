import React from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText as Text } from '@/components/AppText';
import { colors } from '@/constants/menu-theme';

// 마이페이지 메뉴 화면들(내 루트, 나의 정보 관리 ...)이 공통으로 쓰는 뒤로가기 + 제목 헤더입니다.
export function ScreenHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <Pressable
        hitSlop={12}
        onPress={() => router.back()}
        style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
      >
        <Ionicons name="chevron-back" size={25} color={colors.text} />
      </Pressable>

      <Text numberOfLines={1} style={styles.title}>
        {title}
      </Text>

      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    backgroundColor: colors.bg,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonPressed: {
    opacity: 0.5,
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
    // backButton(36)과 right(최소 36)이 이미 좌우 대칭이라 marginRight로
    // 추가 보정하면 오히려 제목이 왼쪽으로 치우칩니다(더는 넣지 마세요).
  },
  right: {
    minWidth: 36,
    alignItems: 'flex-end',
  },
});
