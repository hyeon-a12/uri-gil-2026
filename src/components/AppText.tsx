import React from 'react';
import { Text as RNText, StyleSheet, type TextProps } from 'react-native';

// react-native-native-스타일 기본 폰트(system-ui) 대신 SpoqaHanSansNeo를 앱 전체에 강제 적용하기 위한 공통 Text 컴포넌트입니다.
// 커스텀 트루타입 폰트는 fontWeight 값을 자동으로 반영하지 못하므로,
// 기존 스타일의 fontWeight 값을 읽어서 그에 맞는 폰트 파일(fontFamily)로 바꿔치기 합니다.
const FONT_BY_WEIGHT: Record<string, string> = {
  '100': 'SpoqaHanSansNeo-Thin',
  '200': 'SpoqaHanSansNeo-Thin',
  '300': 'SpoqaHanSansNeo-Light',
  '400': 'SpoqaHanSansNeo-Regular',
  normal: 'SpoqaHanSansNeo-Regular',
  '500': 'SpoqaHanSansNeo-Medium',
  '600': 'SpoqaHanSansNeo-Medium',
  '700': 'SpoqaHanSansNeo-Bold',
  bold: 'SpoqaHanSansNeo-Bold',
  '800': 'SpoqaHanSansNeo-Bold',
  '900': 'SpoqaHanSansNeo-Bold',
};

export function AppText({ style, ...props }: TextProps) {
  // style이 배열이거나 StyleSheet.create로 만든 참조여도 실제 값을 읽을 수 있게 flatten 합니다.
  const flatStyle = StyleSheet.flatten(style) ?? {};
  const weightKey = String(flatStyle.fontWeight ?? '400');
  const fontFamily = FONT_BY_WEIGHT[weightKey] ?? FONT_BY_WEIGHT['400'];

  return (
    <RNText
      {...props}
      style={[{ fontFamily }, style, { fontWeight: 'normal' }]}
      // fontWeight는 이미 fontFamily 선택에 반영했으므로, 폰트가 두 번 굵어지는(가짜 볼드) 걸 막기 위해 마지막에 초기화합니다.
    />
  );
}
