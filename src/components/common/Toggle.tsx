import React from 'react';
import { Switch } from 'react-native';
import { colors } from '@/constants/menu-theme';

// 알림 설정 등에서 쓰는 온/오프 스위치입니다. 켜졌을 때 브랜드 오렌지 색을 씁니다.
export function Toggle({ value, onValueChange }: { value: boolean; onValueChange: (next: boolean) => void }) {
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: colors.border, true: colors.accentSoft }}
      thumbColor={value ? colors.accent : '#FFFFFF'}
      ios_backgroundColor={colors.border}
    />
  );
}
