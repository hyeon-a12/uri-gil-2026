import React, { useRef } from 'react';
import {
  Animated,
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';

type HapticPressableProps = {
  onPress?: (event: GestureResponderEvent) => void;
  disabled?: boolean;
  hapticStyle?: Haptics.ImpactFeedbackStyle;
  /** 눌렀을 때 줄어드는 비율. 1에 가까울수록 덜 눌리는 느낌. */
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  hitSlop?: PressableProps['hitSlop'];
};

/**
 * TouchableOpacity를 대체하는 공용 Pressable. 탭할 때 살짝 눌리는 스케일
 * 애니메이션 + 햅틱 피드백을 같이 줘서, 매 화면마다 이 둘을 따로 구현하지
 * 않아도 되게 합니다. disabled일 때는 스케일/햅틱 둘 다 울리지 않습니다.
 */
export function HapticPressable({
  onPress,
  disabled,
  hapticStyle = Haptics.ImpactFeedbackStyle.Light,
  scaleTo = 0.96,
  style,
  children,
  hitSlop,
}: HapticPressableProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (toValue: number, bounciness: number) => {
    Animated.spring(scale, {
      toValue,
      useNativeDriver: true,
      speed: 40,
      bounciness,
    }).start();
  };

  return (
    <Pressable
      disabled={disabled}
      hitSlop={hitSlop}
      onPressIn={() => !disabled && animateTo(scaleTo, 0)}
      onPressOut={() => !disabled && animateTo(1, 6)}
      onPress={(event) => {
        if (!disabled) Haptics.impactAsync(hapticStyle);
        onPress?.(event);
      }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
