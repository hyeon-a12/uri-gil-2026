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
import { saveRecording } from '@/services/recordingService';
import { getActiveFolder } from '@/services/activeFolderService';

const COLORS = {
  background: '#FAF8F1',
  card: '#FFFFFF',

  primary: '#F99B30',
  primaryDark: '#E9851D',
  primarySoft: '#FFF1E4',

  textPrimary: '#262621',
  textSecondary: '#85857E',
  textTertiary: '#AAA9A2',

  border: '#ECE9E1',
  divider: '#F1EEE8',

  sheet: '#FFF9F3',
  disabled: '#DDDAD4',

  shadow: '#4A4035',
};

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// 시트 높이 범위 (화면 높이 기준)
const MIN_SHEET_HEIGHT = SCREEN_HEIGHT * 0.42;
const MAX_SHEET_HEIGHT = SCREEN_HEIGHT * 0.88;
const DEFAULT_SHEET_HEIGHT = SCREEN_HEIGHT * 0.56;

type ConfirmStep =
  | 'location'
  | 'trip';

interface TripOption {
  id: string;
  title: string;
  date: string;
}

const MOCK_TRIPS: TripOption[] = [
  {
    id: 'trip-1',
    title: '전주 먹으러 왔다',
    date: '2026.06.20.',
  },
  {
    id: 'trip-2',
    title: '가족여행 전주',
    date: '2025.01.23.',
  },
];

function TripOptionCard({
  trip,
  selected,
  onPress,
}: {
  trip: TripOption;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tripCard,
        selected && styles.tripCardSelected,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.tripCardContent}>
        <View style={styles.tripTextArea}>
          <Text
            numberOfLines={1}
            allowFontScaling={false}
            style={[
              styles.tripTitle,
              selected && styles.tripTitleSelected,
            ]}
          >
            {trip.title}
          </Text>

          <Text
            allowFontScaling={false}
            style={[
              styles.tripDate,
              selected && styles.tripDateSelected,
            ]}
          >
            생성일 {trip.date}
          </Text>
        </View>

        <View
          style={[
            styles.radioButton,
            selected && styles.radioButtonSelected,
          ]}
        >
          {selected ? (
            <View style={styles.radioButtonInner} />
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

/**
 * 촬영 후 장소 및 여행 선택 화면
 *
 * 1. 촬영 장소 선택
 * 2. 영상을 추가할 여행 선택
 * 3. 선택 완료 후 클립 관리 화면으로 이동
 */
export default function LocationConfirmScreen() {
  const { videoUri } =
    useLocalSearchParams<{
      videoUri?: string;
    }>();

  const [step, setStep] =
    useState<ConfirmStep>('location');

  const [selectedLocationId, setSelectedLocationId] =
    useState<string | null>(null);

  const [selectedTripId, setSelectedTripId] =
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

  const selectedTrip = useMemo(
    () =>
      MOCK_TRIPS.find(
        (trip) => trip.id === selectedTripId,
      ),
    [selectedTripId],
  );

  const hasLocationSelection =
    selectedLocationId !== null || hasManualLocation;

  const hasTripSelection =
    selectedTripId !== null;

  const handleBackStep = () => {
    if (step === 'trip') {
      setStep('location');
      return;
    }

    router.back();
  };

  const handleLocationSelect = (
    locationId: string,
  ) => {
    setManualLocation('');
    setManualInputFocused(false);
    setSelectedLocationId(locationId);
  };

  const handleNext = () => {
    if (!hasLocationSelection) {
      return;
    }

    setStep('trip');
  };

  const handleCreateNewTrip = () => {
    router.push('/my-route');
  };

  const handleComplete = async () => {
    if (
      !hasLocationSelection ||
      !hasTripSelection
    ) {
      return;
    }

    if (!videoUri) {
      Alert.alert(
        '영상을 찾을 수 없습니다',
        '다시 촬영해주세요.',
      );
      return;
    }

    // 클립 관리 화면에서 "카메라 연결하기"로 미리 지정해둔 여행(폴더)에 저장합니다.
    const folderId = await getActiveFolder();

    if (!folderId) {
      Alert.alert(
        '연결된 여행이 없습니다',
        '클립 관리 화면에서 여행의 "카메라 연결하기"를 먼저 눌러주세요.',
      );
      return;
    }

    try {
      await saveRecording({
        recordedAt: new Date().toISOString(),
        videoUri,
        // TODO: expo-video-thumbnails 등으로 실제 썸네일을 만들기 전까지는 영상 자체를 썸네일로 재사용합니다.
        thumbnail: videoUri,
        folderId,
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
        `${selectedTrip?.title ?? '선택한 여행'}에 클립을 추가했어요.`,
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
                {step === 'location'
                  ? '다시 촬영하기'
                  : '장소 다시 선택'}
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

            {step === 'location' ? (
              <>
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
                      onPress={handleNext}
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
              </>
            ) : (
              <>
                <View style={styles.sheetHeader}>
                  <View style={styles.titleRow}>
                    <View
                      style={
                        styles.titleIconContainer
                      }
                    >
                      <Ionicons
                        name="map-outline"
                        size={20}
                        color={COLORS.primary}
                      />
                    </View>

                    <Text
                      allowFontScaling={false}
                      style={styles.sheetTitle}
                    >
                      어떤 여행에 추가할까요?
                    </Text>
                  </View>

                  <Text
                    allowFontScaling={false}
                    style={styles.sheetDescription}
                  >
                    선택한 여행에 촬영한 클립을
                    저장할게요.
                  </Text>
                </View>

                {selectedLocation ? (
                  <View
                    style={
                      styles.selectedLocationSummary
                    }
                  >
                    <View
                      style={
                        styles.selectedLocationIcon
                      }
                    >
                      <Ionicons
                        name="location"
                        size={18}
                        color={COLORS.primary}
                      />
                    </View>

                    <View
                      style={
                        styles.selectedLocationTextArea
                      }
                    >
                      <Text
                        allowFontScaling={false}
                        style={
                          styles.selectedLocationLabel
                        }
                      >
                        선택한 장소
                      </Text>

                      <Text
                        numberOfLines={1}
                        allowFontScaling={false}
                        style={
                          styles.selectedLocationName
                        }
                      >
                        {selectedLocation?.name ??
                          '선택한 장소'}
                      </Text>
                    </View>

                    <Pressable
                      hitSlop={10}
                      onPress={() =>
                        setStep('location')
                      }
                    >
                      <Text
                        allowFontScaling={false}
                        style={
                          styles.locationChangeText
                        }
                      >
                        변경
                      </Text>
                    </Pressable>
                  </View>
                ) : null}

                <ScrollView
                  style={styles.listScroll}
                  contentContainerStyle={
                    styles.listContent
                  }
                  showsVerticalScrollIndicator={false}
                >
                  {MOCK_TRIPS.map((trip) => (
                    <TripOptionCard
                      key={trip.id}
                      trip={trip}
                      selected={
                        selectedTripId === trip.id
                      }
                      onPress={() =>
                        setSelectedTripId(trip.id)
                      }
                    />
                  ))}

                  <Pressable
                    onPress={handleCreateNewTrip}
                    style={({ pressed }) => [
                      styles.createTripButton,
                      pressed &&
                        styles.cardPressed,
                    ]}
                  >
                    <View
                      style={
                        styles.createTripIconContainer
                      }
                    >
                      <Ionicons
                        name="add"
                        size={22}
                        color={COLORS.primary}
                      />
                    </View>

                    <View
                      style={
                        styles.createTripTextArea
                      }
                    >
                      <Text
                        allowFontScaling={false}
                        style={
                          styles.createTripTitle
                        }
                      >
                        새 여행 만들기
                      </Text>

                      <Text
                        allowFontScaling={false}
                        style={
                          styles.createTripDescription
                        }
                      >
                        새로운 여행을 생성하고
                        클립을 추가해보세요.
                      </Text>
                    </View>

                    <Ionicons
                      name="chevron-forward"
                      size={19}
                      color={COLORS.textTertiary}
                    />
                  </Pressable>
                </ScrollView>

                <Pressable
                  onPress={handleComplete}
                  disabled={!hasTripSelection}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    !hasTripSelection &&
                      styles.primaryButtonDisabled,
                    pressed &&
                      hasTripSelection &&
                      styles.primaryButtonPressed,
                  ]}
                >
                  <Ionicons
                    name="checkmark"
                    size={20}
                    color="#FFFFFF"
                  />

                  <Text
                    allowFontScaling={false}
                    style={styles.primaryButtonText}
                  >
                    완료
                  </Text>
                </Pressable>
              </>
            )}
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

    backgroundColor: '#D5D1C9',
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
    backgroundColor: '#FFFDFC',
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

  tripCard: {
    minHeight: 74,

    paddingHorizontal: 16,
    paddingVertical: 13,

    borderRadius: 16,

    backgroundColor: COLORS.card,

    borderWidth: 1,
    borderColor: COLORS.border,
  },

  tripCardSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,

    shadowColor: COLORS.primary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,

    elevation: 4,
  },

  tripCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  tripTextArea: {
    flex: 1,
  },

  tripTitle: {
    color: COLORS.textPrimary,

    fontSize: 15,
    lineHeight: 21,
    fontWeight: '800',
  },

  tripTitleSelected: {
    color: '#FFFFFF',
  },

  tripDate: {
    marginTop: 4,

    color: COLORS.textSecondary,

    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },

  tripDateSelected: {
    color: 'rgba(255,255,255,0.82)',
  },

  radioButton: {
    width: 22,
    height: 22,

    borderRadius: 11,

    alignItems: 'center',
    justifyContent: 'center',

    borderWidth: 2,
    borderColor: COLORS.textTertiary,
  },

  radioButtonSelected: {
    borderColor: '#FFFFFF',
  },

  radioButtonInner: {
    width: 10,
    height: 10,

    borderRadius: 5,

    backgroundColor: '#FFFFFF',
  },

  selectedLocationSummary: {
    minHeight: 66,

    marginBottom: 14,
    paddingHorizontal: 14,

    flexDirection: 'row',
    alignItems: 'center',

    borderRadius: 16,

    backgroundColor: COLORS.primarySoft,

    borderWidth: 1,
    borderColor: '#FFD9B6',
  },

  selectedLocationIcon: {
    width: 38,
    height: 38,

    borderRadius: 19,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: '#FFFFFF',
  },

  selectedLocationTextArea: {
    flex: 1,

    marginLeft: 11,
  },

  selectedLocationLabel: {
    color: COLORS.textSecondary,

    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },

  selectedLocationName: {
    marginTop: 2,

    color: COLORS.textPrimary,

    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
  },

  locationChangeText: {
    color: COLORS.primary,

    fontSize: 12,
    lineHeight: 17,
    fontWeight: '800',
  },

  createTripButton: {
    minHeight: 72,

    paddingHorizontal: 15,
    paddingVertical: 12,

    flexDirection: 'row',
    alignItems: 'center',

    borderRadius: 16,

    backgroundColor: COLORS.card,

    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#DCCFC2',
  },

  createTripIconContainer: {
    width: 40,
    height: 40,

    borderRadius: 20,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: COLORS.primarySoft,
  },

  createTripTextArea: {
    flex: 1,

    marginLeft: 11,
  },

  createTripTitle: {
    color: COLORS.textPrimary,

    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
  },

  createTripDescription: {
    marginTop: 3,

    color: COLORS.textSecondary,

    fontSize: 11,
    lineHeight: 16,
    fontWeight: '500',
  },
});
