import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { LocationOptionCard } from '@/components/location-confirm/LocationOptionCard';
import { VideoPreview } from '@/components/location-confirm/VideoPreview';
import { COLORS } from '@/constants/color';
import { MOCK_LOCATION_SUGGESTIONS } from '@/constants/mockLocations';
import { LocationSuggestion } from '@/types/recording';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const SHEET_HEIGHT = SCREEN_HEIGHT;
//const MIN_Y = SHEET_HEIGHT - (SCREEN_HEIGHT * 0.5);
const MIN_Y = (SCREEN_HEIGHT * 0.45);
const MAX_Y = 0;

/** 촬영 후 "여기가 맞나요?" 장소 확인 화면 */
export default function LocationConfirmScreen() {
  const { videoUri } = useLocalSearchParams<{ videoUri?: string }>();

  const [locationList, setLocationList] = useState(MOCK_LOCATION_SUGGESTIONS);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [inputText, setInputText] = useState('');

  const translateY = useSharedValue(MIN_Y);
  const context = useSharedValue({y: 0});

  const hasSelection = selectedId !== null;

  const gesture = Gesture.Pan()
    .onStart(() => {
      context.value = { y: translateY.value };
    })
    .onUpdate((event) => {
      const nextY = context.value.y + event.translationY;
      translateY.value = Math.min(Math.max(nextY, MAX_Y), MIN_Y);
    })
    .onEnd(() => {
      const middlePoint = MIN_Y / 2;
      if (translateY.value < middlePoint) {
        translateY.value = withSpring(MAX_Y, {
          damping: 15,
          stiffness: 100,
          mass: 1,
        });
      } else {
        translateY.value = withSpring(MIN_Y);
      }
    });
  
  const animatedSheetStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
    };
  });

  const animatedScrollStyle = useAnimatedStyle(() => {
    const currentVisibleHeight = SHEET_HEIGHT - translateY.value;
    const maxScrollHeight = currentVisibleHeight - 110;

    return {
      maxHeight: maxScrollHeight,
    };
  });

  const handleRetake = () => {
    router.back();
  };

  const handleNext = () => {
    if (!hasSelection) return;
    // TODO: 다음 단계(클립 저장 등)로 연결
  };

  const handleManualInput = () => {
    setIsEditing(true);
  };

  const handleRegisterManualInput = () => {
    if (!inputText.trim()) return;

    const newLocationId = `manual_${Date.now()}`;
    const newLocation: LocationSuggestion = {
      id: newLocationId,
      name: inputText.trim(),
      category: 'API 연결한 카테고리',
      distanceMeters: 0,
      address: '직접 입력한 장소',
    };

    setLocationList([newLocation, ...locationList]);
    setSelectedId(newLocationId);

    setInputText('');
    setIsEditing(false);
  };

  return (
    <GestureHandlerRootView style={{ flex: 1}}>
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

          <Animated.View style={[styles.sheet, animatedSheetStyle]}>
            <GestureDetector gesture={gesture}>
              <View style={styles.dragHandleWrapper}>
                <View style={styles.dragHandle} />
              </View>
            </GestureDetector>

            <View style={styles.titleContainer}>
              <Text style={styles.sheetTitle}>여기가 맞나요?</Text>

                <Pressable
                  onPress={handleNext}
                  disabled={!hasSelection}
                  style={({ pressed }) => [
                    styles.nextButton,
                    hasSelection ? styles.nextButtonActive : styles.nextButtonDisabled,
                    pressed && hasSelection && styles.nextButtonPressed,
                  ]}>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.nextButtonText,
                      hasSelection ? styles.nextButtonTextActive : styles.nextButtonTextDisabled,
                    ]}>
                    다음
                  </Text>
                </Pressable>
              </View>

            <Animated.ScrollView
              style={[styles.listScroll, animatedScrollStyle]}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}>

              {isEditing ? (
                <View style={styles.manualInputContainer}>
                  <TextInput
                    style={styles.textInput}
                    placeholder="장소 이름을 입력해주세요"
                    placeholderTextColor={COLORS.textTertiary}
                    value={inputText}
                    onChangeText={setInputText}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={handleRegisterManualInput}
                  />
                  <View style={styles.inputButtonGroup}>
                    <Pressable
                      onPress={handleRegisterManualInput}
                      style={styles.inputActionButton}>
                      <Text style={styles.registerText}>등록</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setIsEditing(false)}
                      style={styles.inputActionButton}>
                      <Text style={styles.cancelText}>취소</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable
                  onPress={handleManualInput}
                  style={({ pressed }) => [styles.manualInput, pressed && styles.manualInputPressed]}>
                  <Text style={styles.manualInputText}>직접 입력하기...</Text>
                </Pressable>
              )}

              {locationList.map((location) => (
                <LocationOptionCard
                  key={location.id}
                  location={location}
                  selected={selectedId === location.id}
                  onPress={() => setSelectedId(location.id)}
                />
              ))}
            </Animated.ScrollView>
          </Animated.View>
        </View>
      </SafeAreaView>
    </GestureHandlerRootView>
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
    backgroundColor: COLORS.locationSheet,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
  },
  dragHandleWrapper: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: 'transparent',
  },
  dragHandle: {
    alignSelf: 'center',
    width: 50,
    height: 4,
    borderRadius: 5,
    backgroundColor: COLORS.locationDragHandle,
  },
  titleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 5,
  },
  sheetTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 5,
  },
  listScroll: {
    flex: 1,
    marginTop: 4,
  },
  listContent: {
    gap: 10,
    paddingBottom: 40,
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
  manualInputContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  textInput: {
    fontSize: 15,
    color: COLORS.text,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.locationDragHandle,
  },
  inputButtonGroup: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
  },
  inputActionButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  registerText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.locationSelect,
  },
  cancelText: {
    fontSize: 14,
    color: COLORS.textTertiary,
  },
  nextButton: {
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 15,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 50,
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
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  nextButtonTextActive: {
    color: COLORS.white,
  },
  nextButtonTextDisabled: {
    color: COLORS.white,
  },
});
