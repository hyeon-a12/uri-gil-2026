import React from 'react';
import { StyleSheet } from 'react-native';
import { AppText as Text } from '@/components/AppText';
import { colors } from '@/constants/menu-theme';

// 리스트/그리드 위에 붙는 작은 안내 텍스트입니다. (예: "2026.07 · 전주 한옥마을 힐링 여행")
export function SectionLabel({ text }: { text: string }) {
  return <Text style={styles.label}>{text}</Text>;
}

const styles = StyleSheet.create({
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
});
