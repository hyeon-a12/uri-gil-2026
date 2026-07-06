import { router } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WebBadge } from '@/components/web-badge';
import { COLORS } from '@/constants/color';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { navigateToCamera, navigateToLocationConfirm } from '@/navigation/recordingNavigation';
import { useTheme } from '@/hooks/use-theme';

const SAMPLE_VIDEO_URI =
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';

export default function DevPreviewScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const theme = useTheme();
  const insets = {
    ...safeAreaInsets,
    bottom: safeAreaInsets.bottom + BottomTabInset + Spacing.three,
  };

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentInset={insets}
      contentContainerStyle={styles.contentContainer}>
      <ThemedView style={styles.container}>
        <ThemedText type="subtitle">우리길 UI 미리보기</ThemedText>
        <ThemedText style={styles.description} themeColor="textSecondary">
          Figma UI를 실제 기기에서 확인할 수 있습니다.{'\n'}
          카메라 촬영 → 장소 확인까지 한 번에 테스트해 보세요.
        </ThemedText>

        <Pressable
          style={({ pressed }) => [styles.cameraButton, pressed && styles.pressed]}
          onPress={() => navigateToCamera()}>
          <ThemedText style={styles.previewButtonText}>카메라 촬영 화면 열기</ThemedText>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.previewButton, pressed && styles.pressed]}
          onPress={() => navigateToLocationConfirm(SAMPLE_VIDEO_URI)}>
          <ThemedText style={styles.previewButtonText}>장소 확인 화면 (영상 O)</ThemedText>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.previewButtonOutline, pressed && styles.pressed]}
          onPress={() => router.push('/location-confirm')}>
          <ThemedText style={styles.previewButtonOutlineText}>장소 확인 화면 (영상 X)</ThemedText>
        </Pressable>

        <ThemedView type="backgroundElement" style={styles.noteBox}>
          <ThemedText type="smallBold">카메라 팀 연동 방법</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            촬영 완료 후{'\n'}
            <ThemedText type="code">navigateToLocationConfirm(videoUri)</ThemedText>
            {'\n'}를 호출하면 촬영 영상이 상단에 표시됩니다.
          </ThemedText>
        </ThemedView>

        {Platform.OS === 'web' && <WebBadge />}
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    alignItems: 'center',
    paddingTop: Spacing.six,
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.six,
  },
  container: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.three,
    alignItems: 'stretch',
  },
  description: {
    textAlign: 'center',
    lineHeight: 22,
  },
  previewButton: {
    backgroundColor: COLORS.locationSelect,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  cameraButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  previewButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  previewButtonOutline: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  previewButtonOutlineText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
  noteBox: {
    padding: Spacing.three,
    borderRadius: 12,
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  pressed: {
    opacity: 0.85,
  },
});
