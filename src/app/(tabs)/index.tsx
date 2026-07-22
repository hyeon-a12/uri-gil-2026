export { default } from '@/screens/Home/HomeScreen';

/*
import { Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS } from '@/constants/color';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.heroSection}>
          <Text style={styles.title}>우리길</Text>
          <Text style={styles.subtitle}>카메라 촬영과 위치 확인 흐름을 바로 확인해 보세요.</Text>
        </View>

        <View style={styles.stepContainer}>
          <Text style={styles.stepTitle}>현재 진행 중</Text>
          <Text style={styles.stepText}>- 카메라 화면</Text>
          <Text style={styles.stepText}>- 장소 확인 화면</Text>
          <Text style={styles.stepText}>- 영상 미리보기</Text>
        </View>

        {Platform.OS === 'web' && <Text style={styles.webHint}>웹 미리보기 모드</Text>}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
    maxWidth: MaxContentWidth,
  },
  heroSection: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.primary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  stepContainer: {
    alignSelf: 'stretch',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.four,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    gap: Spacing.two,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  stepText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  webHint: {
    fontSize: 12,
    color: COLORS.textTertiary,
  },
});
*/
