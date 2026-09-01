import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/AppText';
import KakaoMapView, { KakaoMapPin } from '@/components/KakaoMapView';
import { COLORS as APP_COLORS, RADIUS } from '@/constants/color';
import { appendTripScheduleStops } from '@/services/trip-schedule-service';
import { getAllFolders, parseDateRange } from '@/services/folderService';
import { getDayLabel } from '@/services/tripPlanService';
import { formatDistance, usePlaceSearch, type PlaceCoordinates } from '@/hooks/usePlaceSearch';

const COLORS = {
  background: APP_COLORS.background,
  card: APP_COLORS.background,
  primary: APP_COLORS.accent,
  primaryDark: APP_COLORS.accentPressed,
  primarySoft: APP_COLORS.main,
  textPrimary: APP_COLORS.textPrimary,
  textSecondary: APP_COLORS.textSecondary,
  textTertiary: APP_COLORS.textSecondary,
  border: APP_COLORS.border,
  divider: APP_COLORS.border,
  surface: APP_COLORS.surface,
  disabled: APP_COLORS.locationButtonDisabled,
  dragHandle: APP_COLORS.locationDragHandle,
  shadow: APP_COLORS.shadow,
};

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MIN_SHEET_HEIGHT = SCREEN_HEIGHT * 0.42;
const MAX_SHEET_HEIGHT = SCREEN_HEIGHT * 0.88;
const DEFAULT_SHEET_HEIGHT = SCREEN_HEIGHT * 0.59;

/** 검색 결과를 지도 핀으로 변환합니다. 선택된 장소만 포인트 컬러로 강조합니다. */
function buildMapPins(places: { id: string; latitude: number; longitude: number }[], selectedPlaceId: string | undefined): KakaoMapPin[] {
  return places.map((place, index) => ({
    id: place.id,
    label: String(index + 1),
    lat: place.latitude,
    lng: place.longitude,
    color: place.id === selectedPlaceId ? COLORS.primary : '#B9BFC9',
    // 검색 결과 핀은 아직 경로가 아니라 후보일 뿐이라 서로 잇는 선이 필요 없음
    excludeFromPath: true,
  }));
}

/**
 * 일정(RoutePlanView)에서 "장소 추가"를 눌렀을 때 여는 화면입니다.
 * 촬영 후 장소 확인 화면(LocationConfirmScreen)과 검색 로직(usePlaceSearch)을
 * 공유하되, 영상 저장 대신 trip-schedule-service에 일정 스톱을 추가합니다.
 */
export default function AddPlaceScreen() {
  const { tripId, day: dayParam } = useLocalSearchParams<{ tripId?: string; day?: string }>();
  const day = useMemo(() => {
    const parsed = Number(dayParam);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
  }, [dayParam]);

  const [coordinates, setCoordinates] = useState<PlaceCoordinates | null>(null);
  const [locationMessage, setLocationMessage] = useState('현재 위치를 확인하고 있어요.');
  const [isSaving, setIsSaving] = useState(false);
  const [tripStartDate, setTripStartDate] = useState<Date | null>(null);

  const insets = useSafeAreaInsets();

  // 시트 제목에 "Day {n}" 대신 실제 날짜를 보여주기 위해 여행 시작일을 가져옵니다.
  useEffect(() => {
    if (!tripId) return;
    (async () => {
      const folders = await getAllFolders();
      const trip = folders.find((folder) => folder.id === tripId);
      setTripStartDate(trip ? parseDateRange(trip.dateRange)?.start ?? null : null);
    })();
  }, [tripId]);

  const {
    query,
    changeQuery,
    clearQuery,
    places,
    isLoadingPlaces,
    searchError,
    isMockData,
    selectedPlace,
    selectPlace,
    isManualEntryOpen,
    toggleManualEntry,
    manualPlaceName,
    changeManualPlaceName,
    manualAddress,
    changeManualAddress,
    placeToSave,
  } = usePlaceSearch(coordinates);

  const sheetHeight = useRef(new Animated.Value(DEFAULT_SHEET_HEIGHT)).current;
  const lastHeightRef = useRef(DEFAULT_SHEET_HEIGHT);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 2,
      onPanResponderMove: (_, gestureState) => {
        const newHeight = lastHeightRef.current - gestureState.dy;
        const clamped = Math.max(MIN_SHEET_HEIGHT, Math.min(MAX_SHEET_HEIGHT, newHeight));
        sheetHeight.setValue(clamped);
      },
      onPanResponderRelease: (_, gestureState) => {
        const newHeight = lastHeightRef.current - gestureState.dy;
        lastHeightRef.current = Math.max(MIN_SHEET_HEIGHT, Math.min(MAX_SHEET_HEIGHT, newHeight));
      },
    }),
  ).current;

  const loadDeviceLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationMessage('위치 권한을 허용하면 주변 장소를 검색할 수 있어요.');
        return;
      }

      const lastKnown = await Location.getLastKnownPositionAsync();
      const position =
        lastKnown ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));

      setCoordinates({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      setLocationMessage('');
    } catch (error) {
      console.warn('[AddPlaceScreen] 위치를 가져오지 못했습니다:', error);
      setLocationMessage('위치를 확인하지 못했어요. 위치 권한을 확인해주세요.');
    }
  }, []);

  useEffect(() => {
    void loadDeviceLocation();
  }, [loadDeviceLocation]);

  // 검색어를 입력한 뒤에만 "나만의 장소 추가"를 노출합니다 — 결과가 있어도
  // 항상 검색 결과 목록 맨 아래에 위치합니다.
  const showManualEntry = query.trim().length > 0 && !isLoadingPlaces;
  const mapPins = useMemo(() => buildMapPins(places, selectedPlace?.id), [places, selectedPlace]);

  const handleComplete = async () => {
    if (!placeToSave || !tripId) return;

    setIsSaving(true);
    try {
      await appendTripScheduleStops(tripId, [
        {
          source: 'manual',
          placeId: placeToSave.id,
          title:
            placeToSave.id === 'manual-place' && manualAddress.trim()
              ? `${placeToSave.name} · ${placeToSave.address}`
              : placeToSave.name,
          address: placeToSave.address,
          category: placeToSave.category,
          latitude: placeToSave.latitude,
          longitude: placeToSave.longitude,
          day,
        },
      ]);

      router.back();
    } catch (error) {
      console.error('[AddPlaceScreen] 장소 저장 실패:', error);
      Alert.alert('저장에 실패했습니다', '잠시 후 다시 시도해주세요.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.keyboardAvoidingView} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.container}>
          <View style={styles.mapArea}>
            <KakaoMapView
              pins={mapPins}
              currentLocation={coordinates ? { lat: coordinates.latitude, lng: coordinates.longitude } : null}
              height={SCREEN_HEIGHT}
              pathColor={COLORS.primary}
            />

            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [styles.backButton, { top: insets.top + 10 }, pressed && styles.backButtonPressed]}
              hitSlop={10}
            >
              <Ionicons name="chevron-back" size={20} color={COLORS.textPrimary} />

            </Pressable>
          </View>

          <Animated.View style={[styles.sheet, { height: sheetHeight }]}>
            <View style={styles.dragHandleArea} {...panResponder.panHandlers}>
              <View style={styles.dragHandle} />
            </View>

            <View style={styles.sheetHeader}>
              <View style={styles.titleRow}>
                <View style={styles.titleIconContainer}>
                  <Ionicons name="location-outline" size={20} color={COLORS.primary} />
                </View>
                <Text allowFontScaling={false} numberOfLines={1} style={styles.sheetTitle}>
                  {getDayLabel(day, tripStartDate)}에 추가할 장소
                </Text>
                <Pressable
                  onPress={handleComplete}
                  disabled={!placeToSave || isSaving}
                  style={({ pressed }) => [
                    styles.inlineNextButton,
                    (!placeToSave || isSaving) && styles.inlineNextButtonDisabled,
                    pressed && placeToSave && !isSaving && styles.inlineNextButtonPressed,
                  ]}
                >
                  <Text allowFontScaling={false} style={styles.inlineNextButtonText}>
                    완료
                  </Text>
                </Pressable>
              </View>
              {locationMessage ? (
                <Text allowFontScaling={false} style={styles.sheetDescription}>
                  {locationMessage}
                </Text>
              ) : null}
            </View>

            <View style={styles.searchField}>
              <Ionicons name="search-outline" size={20} color={COLORS.textSecondary} />
              <TextInput
                value={query}
                onChangeText={changeQuery}
                placeholder="장소, 주소로 검색"
                placeholderTextColor={COLORS.textSecondary}
                returnKeyType="search"
                autoCorrect={false}
                style={styles.searchInput}
              />
              {query.length > 0 && (
                <Pressable onPress={clearQuery} hitSlop={10}>
                  <Ionicons name="close-circle" size={20} color={COLORS.textTertiary} />
                </Pressable>
              )}
            </View>

            <ScrollView
              style={styles.listScroll}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {query.trim().length === 0 ? null : (
                <>
                  {isMockData && !isLoadingPlaces ? (
                    <View style={styles.mockNotice}>
                      <Ionicons name="information-circle-outline" size={16} color={COLORS.textSecondary} />
                      <Text style={styles.mockNoticeText}>검색 API 연동 전이라 예시 데이터를 보여드리고 있어요.</Text>
                    </View>
                  ) : null}

                  {isLoadingPlaces ? (
                    <View style={styles.statusRow}>
                      <Ionicons name="ellipsis-horizontal" size={22} color={COLORS.primary} />
                      <Text style={styles.statusText}>주변 장소를 찾고 있어요.</Text>
                    </View>
                  ) : null}

                  {!isLoadingPlaces && searchError ? (
                    <View style={styles.statusRow}>
                      <Ionicons name="alert-circle-outline" size={21} color={COLORS.primary} />
                      <Text style={styles.statusText}>{searchError}</Text>
                    </View>
                  ) : null}

                  {!isLoadingPlaces && !searchError && places.length === 0 ? (
                    <View style={styles.statusRow}>
                      <Ionicons name="search-outline" size={21} color={COLORS.textSecondary} />
                      <Text style={styles.statusText}>해당 검색어로 장소를 찾지 못했어요.</Text>
                    </View>
                  ) : null}
                </>
              )}

              {places.map((place) => {
                const selected = selectedPlace?.id === place.id;
                return (
                  <Pressable
                    key={place.id}
                    onPress={() => selectPlace(place)}
                    style={({ pressed }) => [
                      styles.placeCard,
                      selected && styles.placeCardSelected,
                      pressed && styles.placeCardPressed,
                    ]}
                  >
                    <View style={styles.placeTextBox}>
                      <View style={styles.placeNameRow}>
                        <Text numberOfLines={1} style={styles.placeName}>
                          {place.name}
                        </Text>
                        <Text style={styles.distanceText}>{formatDistance(place.distance)}</Text>
                      </View>
                      <Text numberOfLines={1} style={styles.placeCategory}>
                        {place.category}
                      </Text>
                      <Text numberOfLines={1} style={styles.placeAddress}>
                        {place.address}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}

              {showManualEntry ? (
                <View style={styles.manualAddSection}>
                  <Pressable
                    onPress={toggleManualEntry}
                    style={[
                      styles.manualAddTrigger,
                      isManualEntryOpen && styles.manualAddTriggerOpen,
                    ]}
                  >
                    <View style={styles.manualAddIcon}>
                      <Ionicons name="create-outline" size={20} color={COLORS.primary} />
                    </View>
                    <View style={styles.manualAddCopy}>
                      <Text style={styles.manualAddTitle}>나만의 장소 추가</Text>
                      <Text style={styles.manualAddDescription}>찾는 장소가 없다면 직접 등록해보세요.</Text>
                    </View>
                    <Ionicons
                      name={isManualEntryOpen ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={COLORS.textSecondary}
                    />
                  </Pressable>

                  {isManualEntryOpen ? (
                    <View style={styles.manualForm}>
                      <Text style={styles.manualFormLabel}>장소 이름</Text>
                      <TextInput
                        value={manualPlaceName}
                        onChangeText={changeManualPlaceName}
                        placeholder="예: 골목 끝 작은 카페"
                        placeholderTextColor={COLORS.textTertiary}
                        returnKeyType="next"
                        style={styles.manualFormInput}
                      />
                      <Text style={styles.manualFormLabel}>주소 또는 메모 (선택)</Text>
                      <TextInput
                        value={manualAddress}
                        onChangeText={changeManualAddress}
                        placeholder="예: 전주시 완산구 태조로 00"
                        placeholderTextColor={COLORS.textTertiary}
                        returnKeyType="done"
                        style={styles.manualFormInput}
                      />
                      <View style={styles.manualNotice}>
                        <Ionicons name="information-circle-outline" size={16} color={COLORS.textSecondary} />
                        <Text style={styles.manualNoticeText}>입력한 장소는 현재 위치 좌표와 함께 저장됩니다.</Text>
                      </View>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </ScrollView>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  keyboardAvoidingView: { flex: 1 },
  container: { flex: 1, backgroundColor: COLORS.background },
  // 지도를 화면 전체에 깔고 시트를 그 위에 절대 위치로 띄워야, 시트의
  // 둥근 모서리 안쪽으로 지도가 비쳐서 라운드 처리가 실제로 보입니다.
  // (예전처럼 flex로 지도/시트를 위아래로 나누면 시트 뒤가 흰 배경 그대로라
  // 모서리를 둥글게 깎아도 흰색끼리 겹쳐 티가 안 났습니다.)
  mapArea: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  backButton: {
    position: 'absolute',
    left: 16,
    minHeight: 44,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    shadowColor: '#172033',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 5,
  },
  backButtonPressed: { opacity: 0.7 },
  backLabel: { color: COLORS.textPrimary, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingBottom: 18,
    backgroundColor: COLORS.background,
    borderTopLeftRadius: RADIUS.sheet,
    borderTopRightRadius: RADIUS.sheet,
  },
  dragHandleArea: { width: '100%', paddingTop: 12, paddingBottom: 14, alignItems: 'center', justifyContent: 'center' },
  dragHandle: { width: 42, height: 5, borderRadius: 3, backgroundColor: COLORS.dragHandle },
  sheetHeader: { marginBottom: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
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
    fontSize: 19,
    lineHeight: 26,
    fontWeight: '600',
    letterSpacing: -0.5,
  },
  inlineNextButton: {
    height: 38,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 3,
  },
  inlineNextButtonPressed: { backgroundColor: COLORS.primaryDark, transform: [{ scale: 0.97 }] },
  inlineNextButtonDisabled: { backgroundColor: COLORS.disabled, shadowOpacity: 0, elevation: 0 },
  inlineNextButtonText: { color: '#FFFFFF', fontSize: 13, lineHeight: 18, fontWeight: '800' },
  sheetDescription: { marginTop: 8, marginLeft: 48, color: COLORS.textSecondary, fontSize: 13, lineHeight: 19, fontWeight: '500' },
  searchField: {
    minHeight: 54,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
  },
  searchInput: { flex: 1, color: COLORS.textPrimary, fontSize: 15, fontFamily: 'Pretendard-SemiBold', padding: 0 },
  listScroll: { flex: 1, marginTop: 12 },
  listContent: { gap: 9, paddingBottom: 20 },
  statusRow: {
    minHeight: 72,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    backgroundColor: '#FBFBFA',
  },
  statusText: { flex: 1, color: COLORS.textSecondary, fontSize: 13, fontWeight: '600', lineHeight: 19 },
  mockNotice: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 3, paddingBottom: 2 },
  mockNoticeText: { flex: 1, color: COLORS.textSecondary, fontSize: 11, fontWeight: '500', lineHeight: 16 },
  placeCard: {
    minHeight: 82,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 17,
    backgroundColor: '#FBFBFA',
  },
  placeCardSelected: { backgroundColor: COLORS.primarySoft },
  placeCardPressed: { opacity: 0.8, transform: [{ scale: 0.995 }] },
  placeTextBox: { flex: 1, gap: 3 },
  placeNameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  placeName: { flex: 1, color: COLORS.textPrimary, fontSize: 15, fontWeight: '800' },
  distanceText: { color: COLORS.primary, fontSize: 12, fontWeight: '800' },
  placeCategory: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
  placeAddress: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '500' },
  manualAddSection: { gap: 8 },
  manualAddTrigger: {
    minHeight: 72,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderRadius: 17,
    backgroundColor: '#FFF9F6',
  },
  manualAddTriggerOpen: { backgroundColor: COLORS.primarySoft },
  manualAddIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: COLORS.primarySoft },
  manualAddCopy: { flex: 1 },
  manualAddTitle: { color: COLORS.primary, fontSize: 14, fontWeight: '700' },
  manualAddDescription: { marginTop: 3, color: COLORS.textSecondary, fontSize: 12, fontWeight: '500' },
  manualForm: { gap: 7, padding: 14, borderRadius: 17, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card },
  manualFormLabel: { marginTop: 3, color: COLORS.textPrimary, fontSize: 12, fontWeight: '700' },
  manualFormInput: {
    height: 46,
    paddingHorizontal: 13,
    borderRadius: 12,
    color: COLORS.textPrimary,
    fontSize: 14,
    fontFamily: 'Pretendard-SemiBold',
    backgroundColor: COLORS.surface,
  },
  manualNotice: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  manualNoticeText: { flex: 1, color: COLORS.textSecondary, fontSize: 11, fontWeight: '500', lineHeight: 16 },
});
