import { useWindowDimensions } from 'react-native';

// 디자인 기준 해상도 (iPhone 13/14 기준 375 x 812)
const BASE_WIDTH = 375;

export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const widthScale = width / BASE_WIDTH;

  // moderateScale: 태블릿처럼 화면이 아주 클 때 폰트가 과하게 커지는 걸 방지
  const moderateScale = (size: number, factor = 0.5): number =>
    Math.round(size + (widthScale * size - size) * factor);

  return { width, height, widthScale, moderateScale };
}
