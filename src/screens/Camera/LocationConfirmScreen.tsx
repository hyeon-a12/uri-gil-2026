import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LocationOptionCard } from '@/components/location-confirm/LocationOptionCard';
import { VideoPreview } from '@/components/location-confirm/VideoPreview';
import { COLORS } from '@/constants/color';
import { MOCK_LOCATION_SUGGESTIONS } from '@/constants/mockLocations';

/** 촬영 후 "여기가 맞나요?" 장소 확인 화면 */
export default function LocationConfirmScreen() {
  const { videoUri } = useLocalSearchParams<{ videoUri?: string }>();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const hasSelection = selectedId !== null;

  const handleRetake = () => {
    router.back();
  };

  const handleNext = () => {
    if (!hasSelection) return;
    // TODO: 다음 단계(클립 저장 등)로 연결
  };

  const handleManualInput = () => {
    // TODO: 직접 입력 바텀시트
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.topSection}>
          <Pressable onPress={handleRetake} style={styles.backButton} hitSlop={8}>
            <Text style={styles.backArrow}>←</Text>
            <Text style={styles.backLabel}>다시 촬영하기</Text>
          </Pressable>

          <View style={styles.videoContainer}>
            <VideoPreview videoUri={videoUri ?? null} />
          </View>
        </View>

        <View style={styles.sheet}>
          <View style={styles.dragHandle} />

          <Text style={styles.sheetTitle}>여기가 맞나요?</Text>

          <ScrollView
            style={styles.listScroll}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}>
            {MOCK_LOCATION_SUGGESTIONS.map((location) => (
              <LocationOptionCard
                key={location.id}
                location={location}
                selected={selectedId === location.id}
                onPress={() => setSelectedId(location.id)}
              />
            ))}

            <Pressable
              onPress={handleManualInput}
              style={({ pressed }) => [styles.manualInput, pressed && styles.manualInputPressed]}>
              <Text style={styles.manualInputText}>직접 입력하기...</Text>
            </Pressable>
          </ScrollView>

          <Pressable
            onPress={handleNext}
            disabled={!hasSelection}
            style={({ pressed }) => [
              styles.nextButton,
              hasSelection ? styles.nextButtonActive : styles.nextButtonDisabled,
              pressed && hasSelection && styles.nextButtonPressed,
            ]}>
            <Text
              style={[
                styles.nextButtonText,
                hasSelection ? styles.nextButtonTextActive : styles.nextButtonTextDisabled,
              ]}>
              다음
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  container: {
    flex: 1,
  },
  topSection: {
    flex: 0.46,
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  backArrow: {
    fontSize: 20,
    color: COLORS.text,
    lineHeight: 22,
  },
  backLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  videoContainer: {
    flex: 1,
    minHeight: 180,
  },
  sheet: {
    flex: 0.54,
    backgroundColor: COLORS.locationSheet,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
  },
  dragHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.locationDragHandle,
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 16,
  },
  listScroll: {
    flex: 1,
  },
  listContent: {
    gap: 10,
    paddingBottom: 16,
  },
  manualInput: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  manualInputPressed: {
    opacity: 0.9,
  },
  manualInputText: {
    fontSize: 15,
    color: COLORS.textTertiary,
  },
  nextButton: {
    marginTop: 8,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  nextButtonActive: {
    backgroundColor: COLORS.locationSelect,
  },
  nextButtonDisabled: {
    backgroundColor: COLORS.locationButtonDisabled,
  },
  nextButtonPressed: {
    opacity: 0.9,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  nextButtonTextActive: {
    color: COLORS.white,
  },
  nextButtonTextDisabled: {
    color: COLORS.white,
  },
});
