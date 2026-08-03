import React from 'react';
import { Pressable, View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppText as Text } from '@/components/AppText';
import { colors } from '@/constants/menu-theme';

type ListRowProps = {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  isLast?: boolean; // true면 아래쪽 구분선을 그리지 않습니다 (카드의 마지막 행).
  onPress?: () => void;
  showChevron?: boolean;
  style?: StyleProp<ViewStyle>;
};

// 마이페이지 메뉴 화면들의 리스트 한 줄(제목 + 부제목 + 오른쪽 내용)을 그리는 공통 컴포넌트입니다.
export function ListRow({ title, subtitle, right, isLast = false, onPress, showChevron = false, style }: ListRowProps) {
  const Wrapper = onPress ? Pressable : View;

  return (
    <Wrapper
      style={({ pressed }: { pressed?: boolean }) => [
        styles.row,
        !isLast && styles.rowBorder,
        style,
        pressed && onPress ? styles.rowPressed : null,
      ] as StyleProp<ViewStyle>}
      onPress={onPress}
    >
      <View style={styles.textGroup}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.right}>
        {right}
        {showChevron ? <Feather name="chevron-right" size={20} color={colors.textTertiary} /> : null}
      </View>
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowPressed: {
    opacity: 0.6,
  },
  textGroup: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSub,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
