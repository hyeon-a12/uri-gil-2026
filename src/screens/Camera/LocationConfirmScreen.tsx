import { Ionicons } from '@expo/vector-icons';
import {
  router,
  useLocalSearchParams,
} from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LocationOptionCard } from '@/components/location-confirm/LocationOptionCard';
import { VideoPreview } from '@/components/location-confirm/VideoPreview';
import { MOCK_LOCATION_SUGGESTIONS } from '@/constants/mockLocations';

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

  const [manualInputVisible, setManualInputVisible] =
    useState(false);

  const [manualLocation, setManualLocation] =
    useState('');

  const selectedLocation = useMemo(() => {
    if (manualInputVisible && manualLocation.trim()) {
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
    manualInputVisible,
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
    selectedLocationId !== null ||
    manualLocation.trim().length > 0;

  const hasTripSelection =
    selectedTripId !== null;

  const handleRetake = () => {
    router.back();
  };

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
    setManualInputVisible(false);
    setManualLocation('');
    setSelectedLocationId(locationId);
  };

  const handleManualInputOpen = () => {
    setSelectedLocationId(null);
    setManualInputVisible(true);
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

  const handleComplete = () => {
    if (
      !hasLocationSelection ||
      !hasTripSelection
    ) {
      return;
    }

    console.log({
      videoUri,
      location: selectedLocation,
      trip: selectedTrip,
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

          <View style={styles.sheet}>
            <View style={styles.dragHandle} />

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
                      style={styles.sheetTitle}
                    >
                      여기가 맞나요?
                    </Text>
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

                  <Pressable
                    onPress={handleManualInputOpen}
                    style={({ pressed }) => [
                      styles.manualInputButton,
                      manualInputVisible &&
                        styles.manualInputButtonSelected,
                      pressed &&
                        styles.cardPressed,
                    ]}
                  >
                    <Ionicons
                      name="create-outline"
                      size={19}
                      color={
                        manualInputVisible
                          ? COLORS.primary
                          : COLORS.textSecondary
                      }
                    />

                    <Text
                      allowFontScaling={false}
                      style={[
                        styles.manualInputButtonText,
                        manualInputVisible &&
                          styles.manualInputButtonTextSelected,
                      ]}
                    >
                      직접 입력하기
                    </Text>

                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={COLORS.textTertiary}
                    />
                  </Pressable>

                  {manualInputVisible ? (
                    <View
                      style={
                        styles.manualInputContainer
                      }
                    >
                      <TextInput
                        value={manualLocation}
                        onChangeText={
                          setManualLocation
                        }
                        placeholder="장소 이름을 입력해주세요"
                        placeholderTextColor={
                          COLORS.textTertiary
                        }
                        autoFocus
                        returnKeyType="done"
                        style={styles.manualInput}
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
                  ) : null}
                </ScrollView>

                <Pressable
                  onPress={handleNext}
                  disabled={!hasLocationSelection}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    !hasLocationSelection &&
                      styles.primaryButtonDisabled,
                    pressed &&
                      hasLocationSelection &&
                      styles.primaryButtonPressed,
                  ]}
                >
                  <Text
                    allowFontScaling={false}
                    style={styles.primaryButtonText}
                  >
                    다음
                  </Text>

                  <Ionicons
                    name="arrow-forward"
                    size={19}
                    color="#FFFFFF"
                  />
                </Pressable>
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
                       {selectedLocation?.name ?? '선택한 장소'}
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
          </View>
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

  topSection: {
    flex: 0.44,

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
    minHeight: 190,

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

  sheet: {
    flex: 0.56,

    paddingHorizontal: 20,
    paddingTop: 10,
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

  dragHandle: {
    width: 42,
    height: 5,

    marginBottom: 17,

    alignSelf: 'center',

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

  manualInputButton: {
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

  manualInputButtonSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#FFFDFC',
  },

  manualInputButtonText: {
    flex: 1,

    color: COLORS.textSecondary,

    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
  },

  manualInputButtonTextSelected: {
    color: COLORS.primary,
    fontWeight: '700',
  },

  manualInputContainer: {
    minHeight: 54,

    paddingHorizontal: 15,

    flexDirection: 'row',
    alignItems: 'center',

    borderRadius: 15,

    backgroundColor: COLORS.card,

    borderWidth: 1,
    borderColor: COLORS.primary,
  },

  manualInput: {
    flex: 1,

    color: COLORS.textPrimary,

    fontSize: 14,
    fontWeight: '600',
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