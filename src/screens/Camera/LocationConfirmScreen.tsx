import { Ionicons } from '@expo/vector-icons';
import {
  router,
  useLocalSearchParams,
} from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { AppText as Text } from '@/components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LocationOptionCard } from '@/components/location-confirm/LocationOptionCard';
import { VideoPreview } from '@/components/location-confirm/VideoPreview';
import { MOCK_LOCATION_SUGGESTIONS } from '@/constants/mockLocations';
import { COLORS as APP_COLORS } from '@/constants/color';
import { saveRecording } from '@/services/recordingService';
import { useTripStore } from '@/store/useTripStore';

// 이 화면 안에서만 쓰는 색상 별칭. 값 자체는 앱 공통 팔레트(src/constants/color.js)를
// 그대로 가져다 쓰고, 이 화면에서 쓰던 기존 스타일 코드(COLORS.xxx)는 그대로 유지합니다.
const COLORS = {
  background: APP_COLORS.white,
  card: APP_COLORS.white,

  primary: APP_COLORS.primary,
  primaryDark: '#E97B1F', // my-page/my-route 등 다른 화면과 동일하게 쓰는 눌림 상태 색
  primarySoft: APP_COLORS.primaryTint,

  textPrimary: APP_COLORS.text,
  textSecondary: APP_COLORS.textSecondary,
  textTertiary: APP_COLORS.textTertiary,

  border: APP_COLORS.border,
  divider: APP_COLORS.border,

  // 장소 확인 화면 전용으로 Figma에서 정의된 색 — 앱 전역 팔레트에 이미 있던 걸 그대로 씀
  sheet: APP_COLORS.locationSheet,
  disabled: APP_COLORS.locationButtonDisabled,
  dragHandle: APP_COLORS.locationDragHandle,

  shadow: '#443A31', // 다른 화면들과 동일한 톤의 그림자 색
};

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// 시트 높이 범위 (화면 높이 기준)
const MIN_SHEET_HEIGHT = SCREEN_HEIGHT * 0.42;
const MAX_SHEET_HEIGHT = SCREEN_HEIGHT * 0.88;
const DEFAULT_SHEET_HEIGHT = SCREEN_HEIGHT * 0.56;

/**
 * 촬영 후 장소 확인 화면
 *
 * 1. 촬영 장소 선택
 * 2. 홈 화면에서 미리 선택해둔 활성 여행(currentTrip)에 자동 저장 후 클립 관리 화면으로 이동
 */
export default function LocationConfirmScreen() {
  const { videoUri, durationMs } =
    useLocalSearchParams<{
      videoUri?: string;
      durationMs?: string;
    }>();

  const [selectedLocationId, setSelectedLocationId] =
    useState<string | null>(null);

  const [manualInputFocused, setManualInputFocused] =
    useState(false);

  const [manualLocation, setManualLocation] =
    useState('');

  // ─── 드래그 가능한 시트 ────────────────────────
  const sheetHeight = useRef(
    new Animated.Value(DEFAULT_SHEET_HEIGHT),
  ).current;
  const lastHeightRef = useRef(DEFAULT_SHEET_HEIGHT);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dy) > 2,
      onPanResponderMove: (_, gestureState) => {
        // 위로 드래그(dy < 0) → 시트 높이 증가
        const newHeight =
          lastHeightRef.current - gestureState.dy;
        const clamped = Math.max(
          MIN_SHEET_HEIGHT,
          Math.min(MAX_SHEET_HEIGHT, newHeight),
        );
        sheetHeight.setValue(clamped);
      },
      onPanResponderRelease: (_, gestureState) => {
        const newHeight =
          lastHeightRef.current - gestureState.dy;
        lastHeightRef.current = Math.max(
          MIN_SHEET_HEIGHT,
          Math.min(MAX_SHEET_HEIGHT, newHeight),
        );
      },
    }),
  ).current;
  // ─────────────────────────────────────────────

  const hasManualLocation =
    manualLocation.trim().length > 0;
  const isManualActive =
    manualInputFocused || hasManualLocation;

  const selectedLocation = useMemo(() => {
    if (hasManualLocation) {
      return {
        id: 'manual',
        name: manualLocation.trim(),
      };
    }

    return MOCK_LOCATION_SUGGESTIONS.find(
      (location) =>
        location.id === selectedLocationId,
    );
  }, [
    hasManualLocation,
    manualLocation,
    selectedLocationId,
  ]);

  const hasLocationSelection =
    selectedLocationId !== null || hasManualLocation;

  const handleBackStep = () => {
    router.back();
  };

  const handleLocationSelect = (
    locationId: string,
  ) => {
    setManualLocation('');
    setManualInputFocused(false);
    setSelectedLocationId(locationId);
  };

  const handleComplete = async () => {
    if (!hasLocationSelection) return;

    if (!videoUri) {
      Alert.alert(
        '영상이 없습니다.',
        '촬영을 먼저 완료해주세요.',
      )
      return;
    }

    // 홈 화면에서 미리 골라둔 활성 여행에 자동으로 저장합니다. 카메라 진입 자체를
    // 활성 여행이 있을 때만 허용하므로(CameraScreen, (tabs)/_layout.tsx) 정상 흐름에서는
    // 항상 값이 있지만, 그 사이 활성 여행이 삭제되는 등의 예외 상황을 대비해 방어적으로 확인합니다.
    const currentTrip = useTripStore.getState().currentTrip;
    if (!currentTrip) {
      Alert.alert(
        '진행 중인 여행이 없습니다',
        '홈 화면에서 여행을 다시 선택해주세요.',
      );
      return;
    }
    const targetFolderId = currentTrip.id;

    try {
      await saveRecording({
        recordedAt: new Date().toISOString(),
        videoUri,
        // TODO: expo-video-thumbnails 등으로 실제 썸네일을 만들기 전까지는 영상 자체를 썸네일로 재사용합니다.
        thumbnail: videoUri,
        durationMs: durationMs ? Number(durationMs) : 0,
        folderId: targetFolderId,
        // TODO: 로그인 연동 전까지 쓰는 임시 사용자 ID입니다.
        userId: 'guest',
        location: {
          // TODO: expo-location 연동 전까지 쓰는 임시 좌표입니다.
          latitude: 0,
          longitude: 0,
          placeName: selectedLocation?.name,
        },
      });

      Alert.alert(
        '클립이 저장되었습니다',
        '선택한 여행에 클립을 추가했어요.',
        [
          {
            text: '확인',
            onPress: () => {
              router.replace('/clip-manage');
            },
          },
        ],
      );
    } catch (error) {
      console.error('[handleComplete] 클립 저장 실패:', error);
      Alert.alert(
        '저장에 실패했습니다',
        '잠시 후 다시 시도해주세요.',
      );
    }
  };

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={['top']}
    >
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
      >
        <View style={styles.container}>
          <View style={styles.topSection}>
            <Pressable
              onPress={handleBackStep}
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.backButtonPressed,
              ]}
              hitSlop={10}
            >
              <Ionicons
                name="chevron-back"
                size={23}
                color={COLORS.textPrimary}
              />

              <Text
                allowFontScaling={false}
                style={styles.backLabel}
              >
                다시 촬영하기
              </Text>
            </Pressable>

            <View style={styles.videoContainer}>
              <VideoPreview
                videoUri={videoUri ?? null}
              />
            </View>
          </View>

          {/* 드래그로 높이 조절 가능한 시트 */}
          <Animated.View
            style={[
              styles.sheet,
              { height: sheetHeight },
            ]}
          >
            {/* 드래그 핸들 영역 (터치 영역 확장) */}
            <View
              style={styles.dragHandleArea}
              {...panResponder.panHandlers}
            >
              <View style={styles.dragHandle} />
            </View>

            {/* 장소 확인 영역 */}
            <View style={styles.sheetHeader}>
              <View style={styles.titleRow}>
                <View
                  style={
                    styles.titleIconContainer
                  }
                >
                  <Ionicons
                    name="location-outline"
                    size={20}
                    color={COLORS.primary}
                  />
                </View>

                <Text
                  allowFontScaling={false}
                  numberOfLines={1}
                  style={styles.sheetTitle}
                >
                  여기가 맞나요?
                </Text>

                {/* 인라인 "다음" 버튼 - 제목 오른쪽 */}
                <Pressable
                  onPress={handleComplete}
                  disabled={!hasLocationSelection}
                  style={({ pressed }) => [
                    styles.inlineNextButton,
                    !hasLocationSelection &&
                      styles.inlineNextButtonDisabled,
                    pressed &&
                      hasLocationSelection &&
                      styles.inlineNextButtonPressed,
                  ]}
                >
                  <Text
                    allowFontScaling={false}
                    style={
                      styles.inlineNextButtonText
                    }
                  >
                    다음
                  </Text>

                  <Ionicons
                    name="arrow-forward"
                    size={15}
                    color="#FFFFFF"
                  />
                </Pressable>
              </View>

              <Text
                allowFontScaling={false}
                style={styles.sheetDescription}
              >
                촬영한 장소와 가장 가까운 위치를
                선택해주세요.
              </Text>
            </View>

            <ScrollView
              style={styles.listScroll}
              contentContainerStyle={
                styles.listContent
              }
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* 직접 입력 필드 - 항상 최상단 */}
              <View
                style={[
                  styles.manualInputField,
                  isManualActive &&
                    styles.manualInputFieldActive,
                ]}
              >
                <Ionicons
                  name="create-outline"
                  size={19}
                  color={
                    isManualActive
                      ? COLORS.primary
                      : COLORS.textSecondary
                  }
                />

                <TextInput
                  value={manualLocation}
                  onChangeText={(text) => {
                    setSelectedLocationId(null);
                    setManualLocation(text);
                  }}
                  onFocus={() => {
                    setSelectedLocationId(null);
                    setManualInputFocused(true);
                  }}
                  onBlur={() => {
                    setManualInputFocused(false);
                  }}
                  placeholder="직접 입력하기"
                  placeholderTextColor={
                    COLORS.textSecondary
                  }
                  returnKeyType="done"
                  allowFontScaling={false}
                  style={[
                    styles.manualInputInline,
                    isManualActive &&
                      styles.manualInputInlineActive,
                  ]}
                />

                {manualLocation.length > 0 ? (
                  <Pressable
                    hitSlop={10}
                    onPress={() =>
                      setManualLocation('')
                    }
                  >
                    <Ionicons
                      name="close-circle"
                      size={20}
                      color={
                        COLORS.textTertiary
                      }
                    />
                  </Pressable>
                ) : null}
              </View>

              {MOCK_LOCATION_SUGGESTIONS.map(
                (location) => (
                  <LocationOptionCard
                    key={location.id}
                    location={location}
                    selected={
                      selectedLocationId ===
                      location.id
                    }
                    onPress={() =>
                      handleLocationSelect(
                        location.id,
                      )
                    }
                  />
                ),
              )}
            </ScrollView>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  keyboardAvoidingView: {
    flex: 1,
  },

  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // 시트 높이가 애니메이션되면서 이 영역이 자동으로 늘어남/줄어듦
  topSection: {
    flex: 1,

    paddingHorizontal: 18,
    paddingBottom: 12,
  },

  backButton: {
    minHeight: 48,

    flexDirection: 'row',
    alignItems: 'center',

    gap: 3,
  },

  backButtonPressed: {
    opacity: 0.6,
  },

  backLabel: {
    color: COLORS.textPrimary,

    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
  },

  videoContainer: {
    flex: 1,
    minHeight: 100,

    overflow: 'hidden',

    borderRadius: 22,

    backgroundColor: '#E8E5DF',

    shadowColor: COLORS.shadow,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.08,
    shadowRadius: 12,

    elevation: 3,
  },

  // flex 제거: Animated로 height를 직접 제어
  sheet: {
    paddingHorizontal: 20,
    paddingBottom: 18,

    backgroundColor: COLORS.sheet,

    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,

    borderTopWidth: 1,
    borderColor: COLORS.border,

    shadowColor: COLORS.shadow,
    shadowOffset: {
      width: 0,
      height: -5,
    },
    shadowOpacity: 0.08,
    shadowRadius: 14,

    elevation: 12,
  },

  // 드래그 핸들 터치 영역 (넉넉하게 확보해서 잡기 쉽게)
  dragHandleArea: {
    width: '100%',

    paddingTop: 12,
    paddingBottom: 14,

    alignItems: 'center',
    justifyContent: 'center',
  },

  dragHandle: {
    width: 42,
    height: 5,

    borderRadius: 3,

    backgroundColor: COLORS.dragHandle,
  },

  sheetHeader: {
    marginBottom: 16,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',

    gap: 10,
  },

  titleIconContainer: {
    width: 38,
    height: 38,

    borderRadius: 19,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: COLORS.primarySoft,
  },

  sheetTitle: {
    flex: 1,

    color: COLORS.textPrimary,

    fontSize: 22,
    lineHeight: 29,
    fontWeight: '800',

    letterSpacing: -0.5,
  },

  // 인라인 "다음" 버튼 스타일
  inlineNextButton: {
    height: 38,

    paddingHorizontal: 14,

    flexDirection: 'row',
    alignItems: 'center',

    gap: 4,

    borderRadius: 12,

    backgroundColor: COLORS.primary,

    shadowColor: COLORS.primary,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.22,
    shadowRadius: 6,

    elevation: 3,
  },

  inlineNextButtonPressed: {
    backgroundColor: COLORS.primaryDark,

    transform: [{ scale: 0.97 }],
  },

  inlineNextButtonDisabled: {
    backgroundColor: COLORS.disabled,

    shadowOpacity: 0,
    elevation: 0,
  },

  inlineNextButtonText: {
    color: '#FFFFFF',

    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },

  sheetDescription: {
    marginTop: 8,
    marginLeft: 48,

    color: COLORS.textSecondary,

    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },

  listScroll: {
    flex: 1,
  },

  listContent: {
    gap: 10,
    paddingBottom: 16,
  },

  cardPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.995 }],
  },

  // 직접 입력 필드 (버튼 모양이면서 그 자체가 TextInput)
  manualInputField: {
    minHeight: 58,

    paddingHorizontal: 16,

    flexDirection: 'row',
    alignItems: 'center',

    gap: 10,

    borderRadius: 16,

    backgroundColor: COLORS.card,

    borderWidth: 1,
    borderColor: COLORS.border,
  },

  manualInputFieldActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.card,
  },

  manualInputInline: {
    flex: 1,

    color: COLORS.textSecondary,

    fontSize: 14,
    fontWeight: '600',

    padding: 0,
  },

  manualInputInlineActive: {
    color: COLORS.textPrimary,
    fontWeight: '700',
  },

  primaryButton: {
    height: 54,

    marginTop: 8,

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',

    gap: 7,

    borderRadius: 17,

    backgroundColor: COLORS.primary,

    shadowColor: COLORS.primary,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.22,
    shadowRadius: 9,

    elevation: 5,
  },

  primaryButtonPressed: {
    backgroundColor: COLORS.primaryDark,

    transform: [{ scale: 0.985 }],
  },

  primaryButtonDisabled: {
    backgroundColor: COLORS.disabled,

    shadowOpacity: 0,
    elevation: 0,
  },

  primaryButtonText: {
    color: '#FFFFFF',

    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },

});
