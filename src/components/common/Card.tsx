import React from 'react';
import { View, StyleSheet, type ViewProps } from 'react-native';
import { colors } from '@/constants/menu-theme';

// 마이페이지 메뉴 화면들에서 공통으로 쓰는 흰색 카드입니다.
export const cardShadow = {
  shadowColor: colors.shadow,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.03,
  shadowRadius: 8,
  elevation: 0.5,
};

export function Card({ style, children, ...props }: ViewProps) {
  return (
    <View style={[styles.card, style]} {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 16,
    ...cardShadow,
  },
});
