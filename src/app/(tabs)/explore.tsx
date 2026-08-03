import { router } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppText as Text } from '@/components/AppText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS } from '@/constants/color';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { navigateToCamera, navigateToLocationConfirm } from '@/navigation/recordingNavigation';

const SAMPLE_VIDEO_URI =
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';

export default function DevPreviewScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const insets = {
    ...safeAreaInsets,
    bottom: safeAreaInsets.bottom + BottomTabInset + Spacing.three,
  };

  return (
    <ScrollView
      style={styles.scrollView}
      contentInset={insets}
      contentContainerStyle={styles.contentContainer}>
      <View style={styles.container}>
        <Text style={styles.title}>우리길 UI 미리보기</Text>
        <Text style={styles.description}>
          Figma UI를 실제 기기에서 확인할 수 있습니다.{'\n'}
          카메라 촬영 → 장소 확인까지 한 번에 테스트해 보세요.
        </Text>

        <Pressable
          style={({ pressed }) => [styles.cameraButton, pressed && styles.pressed]}
          onPress={() => navigateToCamera()}>
          <Text style={styles.previewButtonText}>카메라 촬영 화면 열기</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.previewButton, pressed && styles.pressed]}
          onPress={() => navigateToLocationConfirm(SAMPLE_VIDEO_URI)}>
          <Text style={styles.previewButtonText}>장소 확인 화면 (영상 O)</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.previewButtonOutline, pressed && styles.pressed]}
          onPress={() => router.push('/location-confirm')}>
          <Text style={styles.previewButtonOutlineText}>장소 확인 화면 (영상 X)</Text>
        </Pressable>

        <View style={styles.noteBox}>
          <Text style={styles.noteTitle}>카메라 팀 연동 방법</Text>
          <Text style={styles.noteText}>
            촬영 완료 후 {'\n'}navigateToLocationConfirm(videoUri){'\n'}를 호출하면 촬영 영상이 상단에 표시됩니다.
          </Text>
        </View>

        {Platform.OS === 'web' && <Text style={styles.webHint}>웹 미리보기</Text>}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: COLORS.white,
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
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: COLORS.textSecondary,
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
    backgroundColor: COLORS.surface,
  },
  noteTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  noteText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  webHint: {
    fontSize: 12,
    color: COLORS.textTertiary,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
});
