import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { AppText as Text } from '@/components/AppText';
import { COLORS } from '@/constants/color';
import { HapticPressable } from './HapticPressable';

type PrimaryButtonProps = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * accent(코랄)를 면 전체에 채운 solid CTA 버튼. 지금까지 accent는 테두리나
 * 작은 배지 정도로만 좁게 썼는데, 화면당 핵심 액션 1개 정도는 이렇게 꽉 채운
 * 컬러로 시선을 확실히 끌기 위한 용도입니다. 화면마다 새로 만들지 말고 이걸
 * 재사용해주세요.
 */
export function PrimaryButton({ label, onPress, disabled, style }: PrimaryButtonProps) {
  return (
    <HapticPressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, disabled && styles.buttonDisabled, style]}
    >
      <Text style={styles.label}>{label}</Text>
    </HapticPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: COLORS.accent,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    backgroundColor: COLORS.locationButtonDisabled,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.background,
  },
});
