import React from 'react';
import { Platform, Pressable, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText as Text } from '@/components/AppText';
import { colors } from '@/constants/menu-theme';
import { useWebMenuStore } from '@/store/useWebMenuStore';

// 마이페이지 메뉴 화면들(내 루트, 나의 정보 관리 ...)이 공통으로 쓰는 뒤로가기 + 제목 헤더입니다.
// 웹에서는 이 헤더를 쓰는 화면 전부(내 여행, 여행 상세, 나의 정보 관리, 약관
// 화면들)에 햄버거 메뉴 버튼도 자동으로 같이 떠서, 화면마다 따로 추가할
// 필요가 없습니다.
//
// align/hideBack은 기본값(center 정렬 + 뒤로가기 버튼)을 그대로 두는 옵션
// props입니다 — 대부분의 화면은 안 넘겨도 기존과 똑같이 동작하고, 홈/내
// 루트처럼 좌측 정렬 헤더로 맞추고 싶은 화면(내 여행 등)에서만 씁니다.
export function ScreenHeader({
  title,
  right,
  align = 'center',
  hideBack = false,
  hideMenu = false,
}: {
  title: string;
  right?: React.ReactNode;
  align?: 'center' | 'left';
  hideBack?: boolean;
  /** 뒤로가기 버튼이 이미 있어서 웹 햄버거 메뉴가 굳이 필요 없는 화면(예: 여행
   * 상세 - 편집 아이콘 자리에 햄버거까지 같이 뜨면 중복)에서 true로 넘깁니다. */
  hideMenu?: boolean;
}) {
  const insets = useSafeAreaInsets();
  // 홈 화면 헤더(AppHeader.web.tsx의 .uri-app-header)와 정확히 같은 높이/
  // 좌우 여백(68px, 18px)을 씁니다 — 웹은 insets.top이 항상 0이라 이 헤더도
  // 웹에서 좌측 정렬로 쓸 땐 굳이 insets.top을 더할 필요가 없습니다.
  const isWebLeft = Platform.OS === 'web' && align === 'left';

  return (
    <View
      style={[
        styles.header,
        isWebLeft ? styles.headerWebLeft : { paddingTop: insets.top + 8 },
      ]}
    >
      {!hideBack && (
        <Pressable
          hitSlop={12}
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
        >
          <Ionicons name="chevron-back" size={25} color={colors.text} />
        </Pressable>
      )}

      <Text
        numberOfLines={1}
        style={[styles.title, align === 'left' && styles.titleLeft]}
      >
        {title}
      </Text>

      <View style={styles.right}>
        {right}
        {Platform.OS === 'web' && !hideMenu && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="메뉴"
            hitSlop={12}
            onPress={() => useWebMenuStore.getState().open()}
            style={styles.menuButton}
          >
            <Ionicons name="menu-outline" size={23} color={colors.text} />
          </Pressable>
        )}
      </View>
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
  headerWebLeft: {
    height: 68,
    paddingHorizontal: 18,
    paddingBottom: 0,
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
  titleLeft: {
    textAlign: 'left',
    fontSize: 18,
  },
  right: {
    minWidth: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  menuButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
