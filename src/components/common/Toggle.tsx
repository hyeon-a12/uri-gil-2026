import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '@/constants/menu-theme';

// 알림 설정 등에서 쓰는 온/오프 스위치입니다. 켜졌을 때 브랜드 오렌지 색을 씁니다.
// 네이티브 Switch는 안드로이드에서 트랙이 완전한 알약(pill) 모양이 아니라서,
// 트랙/손잡이를 직접 그려서 두 플랫폼 모두 동일하게 알약 모양이 나오게 했습니다.
// scale은 필요하면 transform으로 전체 크기를 키우거나 줄일 때 씁니다(기본값 1).
const TRACK_WIDTH = 40;
const TRACK_HEIGHT = 21;
const THUMB_SIZE = 18;
const THUMB_PADDING = (TRACK_HEIGHT - THUMB_SIZE) / 2;
const THUMB_TRAVEL = TRACK_WIDTH - THUMB_SIZE - THUMB_PADDING * 2;

export function Toggle({
  value,
  onValueChange,
  scale = 1,
  style,
}: {
  value: boolean;
  onValueChange: (next: boolean) => void;
  scale?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: value ? 1 : 0,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, [value, anim]);

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, THUMB_TRAVEL],
  });

  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      hitSlop={8}
      style={[scale !== 1 && { transform: [{ scale }] }, style]}
    >
      <Animated.View
        style={[styles.track, { backgroundColor: value ? colors.accent : colors.border }]}
      >
        <Animated.View style={[styles.thumb, { transform: [{ translateX }] }]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    padding: THUMB_PADDING,
    justifyContent: 'center',
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
});
