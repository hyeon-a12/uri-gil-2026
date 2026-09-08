import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
} from "react-native";
import * as Location from "expo-location";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText as Text } from "@/components/AppText";
import { HapticPressable, MapLocateButton, SectionLabel } from "@/components/common";
import KakaoMapView, {
  KakaoMapPin,
} from "@/components/KakaoMapView";
import { COLORS as APP_COLORS, RADIUS } from "@/constants/color";
import { saveRecording } from "@/services/recordingService";
import { useTripStore } from "@/store/useTripStore";
import { getAllFolders } from "@/services/folderService";
import { apiFetch } from "@/services/api";
import { formatDistance, usePlaceSearch } from "@/hooks/usePlaceSearch";

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

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const MIN_SHEET_HEIGHT = SCREEN_HEIGHT * 0.42;
const MAX_SHEET_HEIGHT = SCREEN_HEIGHT * 0.88;
const DEFAULT_SHEET_HEIGHT = SCREEN_HEIGHT * 0.59;

type CapturedCoordinates = {
  latitude: number;
  longitude: number;
};

function parseCoordinate(value?: string): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** 검색 결과를 지도 핀으로 변환합니다. 선택된 장소만 포인트 컬러로 강조합니다. */
function buildMapPins(
  places: { id: string; latitude: number; longitude: number }[],
  selectedPlaceId: string | undefined,
): KakaoMapPin[] {
  return places.map((place, index) => ({
    id: place.id,
    label: String(index + 1),
    lat: place.latitude,
    lng: place.longitude,
    color: place.id === selectedPlaceId ? COLORS.primary : "#B9BFC9",
    // 검색 결과 핀은 아직 경로가 아니라 후보일 뿐이라 서로 잇는 선이 필요 없음
    excludeFromPath: true,
  }));
}

/**
 * 촬영 완료 후 장소를 검색하고 확정하는 화면입니다.
 *
 * CameraScreen에서 latitude/longitude route param을 전달하면 해당 지점을 고정해 검색합니다.
 * 전달되지 않은 경우에는 이 화면이 열린 시점의 기기 위치를 GPS로 가져와 씁니다.
 *
 * 장소 검색/근처 추천 로직은 usePlaceSearch 훅(add-place.tsx와 공유)을 그대로 쓰고,
 * autoSelectNearest 옵션으로 GPS 기준 가장 가까운 장소를 기본 제안값으로
 * 자동 선택합니다 — 사용자는 그대로 확인하거나 검색/재선택으로 바꿀 수 있습니다.
 */
export default function LocationConfirmScreen() {
  const {
    videoUri,
    durationMs: durationMsParam,
    latitude: latitudeParam,
    longitude: longitudeParam,
  } = useLocalSearchParams<{
    videoUri?: string;
    durationMs?: string;
    latitude?: string;
    longitude?: string;
  }>();

  const durationMs = useMemo(() => {
    const parsed = Number(durationMsParam);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [durationMsParam]);

  const routeCoordinates = useMemo<CapturedCoordinates | null>(() => {
    const latitude = parseCoordinate(latitudeParam);
    const longitude = parseCoordinate(longitudeParam);
    return latitude !== null && longitude !== null
      ? { latitude, longitude }
      : null;
  }, [latitudeParam, longitudeParam]);

  const [shootingCoordinates, setShootingCoordinates] =
    useState<CapturedCoordinates | null>(routeCoordinates);
  const [locationMessage, setLocationMessage] = useState(
    routeCoordinates ? "" : "촬영 위치를 확인하고 있어요.",
  );

  const insets = useSafeAreaInsets();

  const sheetHeight = useRef(new Animated.Value(DEFAULT_SHEET_HEIGHT)).current;
  const lastHeightRef = useRef(DEFAULT_SHEET_HEIGHT);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dy) > 2,
      onPanResponderMove: (_, gestureState) => {
        const newHeight = lastHeightRef.current - gestureState.dy;
        const clamped = Math.max(
          MIN_SHEET_HEIGHT,
          Math.min(MAX_SHEET_HEIGHT, newHeight),
        );
        sheetHeight.setValue(clamped);
      },
      onPanResponderRelease: (_, gestureState) => {
        const newHeight = lastHeightRef.current - gestureState.dy;
        lastHeightRef.current = Math.max(
          MIN_SHEET_HEIGHT,
          Math.min(MAX_SHEET_HEIGHT, newHeight),
        );
      },
    }),
  ).current;

  // notifyOnFailure: 최초 진입 시 조용히 시도할 때는 false, 사용자가 직접
  // "내 위치로" 버튼을 눌렀을 때는 true로 넘겨 실패 사유를 알려줍니다
  // (my-route.tsx / add-place.tsx의 loadDeviceLocation과 동일한 패턴).
  const loadDeviceLocation = useCallback(async (notifyOnFailure = false) => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationMessage(
          "위치 권한을 허용하면 촬영 위치 주변을 검색할 수 있어요.",
        );
        if (notifyOnFailure) {
          Alert.alert("위치 권한이 필요해요", "설정에서 위치 접근을 허용해주세요.");
        }
        return;
      }

      const lastKnown = notifyOnFailure ? null : await Location.getLastKnownPositionAsync();
      const position =
        lastKnown ??
        (await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }));

      setShootingCoordinates({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      setLocationMessage("");
    } catch (error) {
      console.warn("[LocationConfirm] 위치를 가져오지 못했습니다:", error);
      setLocationMessage(
        "촬영 위치를 확인하지 못했어요. 위치 권한을 확인해주세요.",
      );
      if (notifyOnFailure) {
        Alert.alert("위치를 가져오지 못했어요", "잠시 후 다시 시도해주세요.");
      }
    }
  }, []);

  useEffect(() => {
    // CameraScreen이 좌표를 이미 넘긴 경우(routeCoordinates)엔 다시 조회할 필요가 없습니다.
    if (routeCoordinates) return;
    void loadDeviceLocation();
  }, [loadDeviceLocation, routeCoordinates]);

  // 좌표가 이전과 완전히 같으면 지도 URL 문자열이 안 바뀌어서 WebView가 재로드를
  // 건너뛰고 "내 위치로" 버튼이 반응 없는 것처럼 보입니다 — 누를 때마다 이 값을
  // 증가시켜 항상 재중심이 일어나게 합니다.
  const [locateToken, setLocateToken] = useState(0);
  const handlePressLocate = useCallback(async () => {
    await loadDeviceLocation(true);
    setLocateToken((prev) => prev + 1);
  }, [loadDeviceLocation]);

  const {
    query,
    changeQuery,
    clearQuery,
    isBrowsingNearby,
    displayedPlaces,
    isLoadingDisplayed,
    isDisplayedMockData,
    searchError,
    selectedPlace,
    selectPlace,
    autoSuggestedPlaceId,
    isManualEntryOpen,
    toggleManualEntry,
    manualPlaceName,
    changeManualPlaceName,
    manualAddress,
    changeManualAddress,
    placeToSave,
  } = usePlaceSearch(shootingCoordinates, { autoSelectNearest: true });

  // 검색어를 입력한 뒤에만 "나만의 장소 추가"를 노출합니다 — 결과가 있어도
  // 항상 검색 결과 목록 맨 아래에 위치합니다.
  const showManualEntry = query.trim().length > 0 && !isLoadingDisplayed;

  const mapPins = useMemo(
    () => buildMapPins(displayedPlaces, selectedPlace?.id),
    [displayedPlaces, selectedPlace],
  );

  // GPS로 자동 제안된 장소가 아직 사용자의 다른 선택으로 바뀌지 않았을 때만
  // "추천했어요" 안내를 보여줍니다. locationMessage(권한/조회 실패 안내)가
  // 있으면 그쪽을 우선 보여줍니다.
  const isShowingAutoSuggestion =
    Boolean(autoSuggestedPlaceId) && selectedPlace?.id === autoSuggestedPlaceId;
  const sheetDescription = locationMessage
    ? locationMessage
    : isShowingAutoSuggestion && selectedPlace
      ? `근처 '${selectedPlace.name}'을(를) 촬영 장소로 추천했어요. 다르면 검색하거나 목록에서 골라주세요.`
      : "";

  const handleComplete = async () => {
    if (!placeToSave) return;

    if (!videoUri) {
      Alert.alert("영상이 없습니다.", "촬영을 먼저 완료해주세요.");
      return;
    }

    const currentTrip = useTripStore.getState().currentTrip;
    if (!currentTrip) {
      Alert.alert(
        "진행 중인 여행이 없습니다",
        "홈 화면에서 여행을 다시 선택해주세요.",
      );
      return;
    }

    const recordedAt = new Date().toISOString();
    const placeName =
      placeToSave.id === "manual-place" && manualAddress.trim()
        ? `${placeToSave.name} · ${placeToSave.address}`
        : placeToSave.name;

    try {
      await saveRecording({
        recordedAt,
        videoUri,
        thumbnail: videoUri,
        durationMs,
        folderId: currentTrip.id,
        userId: "guest",
        location: {
          latitude: placeToSave.latitude,
          longitude: placeToSave.longitude,
          placeName,
        },
      });

      // 서버에도 클립 메타데이터 저장 시도 (실패해도 로컬 저장은 이미 끝났으니 무시)
      try {
        const folders = await getAllFolders();
        const folder = folders.find((f) => f.id === currentTrip.id);

        if (folder?.routeId) {
          await apiFetch("/clips/", {
            method: "POST",
            body: JSON.stringify({
              route_id: folder.routeId,
              spot_name: placeName,
              clip_url: videoUri,
              latitude: placeToSave.latitude,
              longitude: placeToSave.longitude,
              recorded_at: recordedAt,
            }),
          });
        } else {
          console.warn("[LocationConfirm] routeId가 없어 서버 저장을 건너뜁니다.");
        }
      } catch (serverError) {
        console.error("[LocationConfirm] 서버 클립 저장 실패:", serverError);
      }

      Alert.alert(
        "클립이 저장되었습니다",
        placeToSave.id === "manual-place"
          ? "직접 입력한 장소로 클립을 추가했어요."
          : "선택한 장소로 클립을 추가했어요.",
        [
          {
            text: "확인",
            onPress: () => router.replace("/clip-manage"),
          },
        ],
      );
    } catch (error) {
      console.error("[LocationConfirm] 클립 저장 실패:", error);
      Alert.alert("저장에 실패했습니다", "잠시 후 다시 시도해주세요.");
    }
  };

  return (
    <View style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.container}>
          <View style={styles.mapArea}>
            <KakaoMapView
              pins={mapPins}
              currentLocation={
                shootingCoordinates
                  ? {
                      lat: shootingCoordinates.latitude,
                      lng: shootingCoordinates.longitude,
                    }
                  : null
              }
              height={SCREEN_HEIGHT}
              pathColor={COLORS.primary}
              focusOnLocationToken={locateToken || undefined}
              centerOffsetY={DEFAULT_SHEET_HEIGHT / 2}
            />

            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [
                styles.backButton,
                { top: insets.top + 10 },
                pressed && styles.backButtonPressed,
              ]}
              hitSlop={10}
            >
              <Ionicons
                name="chevron-back"
                size={20}
                color={COLORS.textPrimary}
              />
              <Text allowFontScaling={false} style={styles.backLabel}>
                다시 촬영하기
              </Text>
            </Pressable>

            {/* "내 위치로" 버튼 — 시트를 드래그해도 항상 시트 바로 위에 떠 있도록
                sheetHeight(Animated.Value)에 맞춰 bottom을 같이 움직입니다. */}
            <Animated.View style={[styles.mapControls, { bottom: Animated.add(sheetHeight, 16) }]}>
              <MapLocateButton onPress={handlePressLocate} color={COLORS.textPrimary} />
            </Animated.View>
          </View>

          <Animated.View style={[styles.sheet, { height: sheetHeight }]}>
            <View style={styles.dragHandleArea} {...panResponder.panHandlers}>
              <View style={styles.dragHandle} />
            </View>

            <View style={styles.sheetHeader}>
              <View style={styles.titleRow}>
                <View style={styles.titleIconContainer}>
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
                  어디에서 촬영했나요?
                </Text>
                <HapticPressable
                  onPress={handleComplete}
                  disabled={!placeToSave}
                  style={[
                    styles.inlineNextButton,
                    !placeToSave && styles.inlineNextButtonDisabled,
                  ]}
                >
                  <Text
                    allowFontScaling={false}
                    style={styles.inlineNextButtonText}
                  >
                    완료
                  </Text>
                </HapticPressable>
              </View>
              {sheetDescription ? (
                <Text allowFontScaling={false} style={styles.sheetDescription}>
                  {sheetDescription}
                </Text>
              ) : null}
            </View>

            <View style={styles.searchField}>
              <Ionicons
                name="search-outline"
                size={20}
                color={COLORS.textSecondary}
              />
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
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color={COLORS.textTertiary}
                  />
                </Pressable>
              )}
            </View>

            <ScrollView
              style={styles.listScroll}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {isBrowsingNearby && !isLoadingDisplayed && displayedPlaces.length > 0 ? (
                <SectionLabel text="내 주변 장소" />
              ) : null}

              {isDisplayedMockData && !isLoadingDisplayed ? (
                <View style={styles.mockNotice}>
                  <Ionicons
                    name="information-circle-outline"
                    size={16}
                    color={COLORS.textSecondary}
                  />
                  <Text style={styles.mockNoticeText}>
                    검색 API 연동 전이라 예시 데이터를 보여드리고 있어요.
                  </Text>
                </View>
              ) : null}

              {isLoadingDisplayed ? (
                <View style={styles.statusRow}>
                  <Ionicons
                    name="ellipsis-horizontal"
                    size={22}
                    color={COLORS.primary}
                  />
                  <Text style={styles.statusText}>
                    {isBrowsingNearby
                      ? "촬영 위치 근처를 찾고 있어요."
                      : "주변 장소를 찾고 있어요."}
                  </Text>
                </View>
              ) : null}

              {!isLoadingDisplayed && !isBrowsingNearby && searchError ? (
                <View style={styles.statusRow}>
                  <Ionicons
                    name="alert-circle-outline"
                    size={21}
                    color={COLORS.primary}
                  />
                  <Text style={styles.statusText}>{searchError}</Text>
                </View>
              ) : null}

              {!isLoadingDisplayed && !searchError && displayedPlaces.length === 0 ? (
                <View style={styles.statusRow}>
                  <Ionicons
                    name="search-outline"
                    size={21}
                    color={COLORS.textSecondary}
                  />
                  <Text style={styles.statusText}>
                    {isBrowsingNearby
                      ? "촬영 위치 근처에서 장소를 찾지 못했어요."
                      : "해당 검색어로 장소를 찾지 못했어요."}
                  </Text>
                </View>
              ) : null}

              {displayedPlaces.map((place) => {
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
                        <Text style={styles.distanceText}>
                          {formatDistance(place.distance)}
                        </Text>
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
                      <Ionicons
                        name="create-outline"
                        size={20}
                        color={COLORS.primary}
                      />
                    </View>
                    <View style={styles.manualAddCopy}>
                      <Text style={styles.manualAddTitle}>
                        나만의 장소 추가
                      </Text>
                      <Text style={styles.manualAddDescription}>
                        찾는 장소가 없다면 직접 등록해보세요.
                      </Text>
                    </View>
                    <Ionicons
                      name={isManualEntryOpen ? "chevron-up" : "chevron-down"}
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
                      <Text style={styles.manualFormLabel}>
                        주소 또는 메모 (선택)
                      </Text>
                      <TextInput
                        value={manualAddress}
                        onChangeText={changeManualAddress}
                        placeholder="예: 전주시 완산구 태조로 00"
                        placeholderTextColor={COLORS.textTertiary}
                        returnKeyType="done"
                        style={styles.manualFormInput}
                      />
                      <View style={styles.manualNotice}>
                        <Ionicons
                          name="information-circle-outline"
                          size={16}
                          color={COLORS.textSecondary}
                        />
                        <Text style={styles.manualNoticeText}>
                          입력한 장소는 촬영 위치 좌표와 함께 저장됩니다.
                        </Text>
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
  // 지도는 박스 안에 갇히지 않고 화면 폭 전체를 그대로 채웁니다(홈 화면과 동일한 패턴).
  // 시트가 위로 끌어올려지면 flex:1이 자동으로 줄어들어 지도가 함께 줄고,
  // 시트를 내리면 그만큼 지도가 위로 넓게 드러납니다.
  // 지도를 화면 전체에 깔고 시트를 그 위에 절대 위치로 띄워야, 시트의
  // 둥근 모서리 안쪽으로 지도가 비쳐서 라운드 처리가 실제로 보입니다.
  mapArea: { ...StyleSheet.absoluteFillObject, overflow: "hidden" },
  backButton: {
    position: "absolute",
    left: 16,
    minHeight: 44,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    shadowColor: "#172033",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 5,
  },
  backButtonPressed: { opacity: 0.7 },
  backLabel: {
    color: COLORS.textPrimary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  // "내 위치로" 버튼 위치. bottom은 시트 높이(Animated.Value)에 맞춰 인라인으로 준다.
  mapControls: {
    position: "absolute",
    right: 16,
    zIndex: 20,
    // WebView(카카오맵)는 안드로이드에서 zIndex와 무관하게 형제 뷰 위로 겹쳐
    // 보일 수 있어서 elevation도 같이 줘야 버튼이 지도 위로 확실히 올라옵니다.
    elevation: 20,
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingBottom: 18,
    backgroundColor: COLORS.background,
    borderTopLeftRadius: RADIUS.sheet,
    borderTopRightRadius: RADIUS.sheet,
  },
  dragHandleArea: {
    width: "100%",
    paddingTop: 12,
    paddingBottom: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  dragHandle: {
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.dragHandle,
  },
  sheetHeader: { marginBottom: 14 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  titleIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primarySoft,
  },
  sheetTitle: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 21,
    lineHeight: 29,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  inlineNextButton: {
    height: 38,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 3,
  },
  inlineNextButtonDisabled: {
    backgroundColor: COLORS.disabled,
    shadowOpacity: 0,
    elevation: 0,
  },
  inlineNextButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
  },
  sheetDescription: {
    marginTop: 8,
    marginLeft: 48,
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "500",
  },
  searchField: {
    minHeight: 54,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
  },
  searchInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 15,
    fontFamily: "Pretendard-SemiBold",
    padding: 0,
  },
  listScroll: { flex: 1, marginTop: 12 },
  listContent: { gap: 9, paddingBottom: 20 },
  statusRow: {
    minHeight: 72,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 16,
    backgroundColor: "#FBFBFA",
  },
  statusText: {
    flex: 1,
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
  },
  mockNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 3,
    paddingBottom: 2,
  },
  mockNoticeText: {
    flex: 1,
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: "500",
    lineHeight: 16,
  },
  placeCard: {
    minHeight: 82,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 17,
    backgroundColor: "#FBFBFA",
  },
  placeCardSelected: {
    backgroundColor: COLORS.primarySoft,
  },
  placeCardPressed: { opacity: 0.8, transform: [{ scale: 0.995 }] },
  placeTextBox: { flex: 1, gap: 3 },
  placeNameRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  placeName: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: "800",
  },
  distanceText: { color: COLORS.primary, fontSize: 12, fontWeight: "800" },
  placeCategory: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  placeAddress: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: "500",
  },
  manualAddSection: {
    gap: 8,
  },
  manualAddTrigger: {
    minHeight: 72,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    borderRadius: 17,
    backgroundColor: "#FFF9F6",
  },
  manualAddTriggerOpen: {
    backgroundColor: COLORS.primarySoft,
  },
  manualAddIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: COLORS.primarySoft,
  },
  manualAddCopy: {
    flex: 1,
  },
  manualAddTitle: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "800",
  },
  manualAddDescription: {
    marginTop: 3,
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: "500",
  },
  manualForm: {
    gap: 7,
    padding: 14,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  manualFormLabel: {
    marginTop: 3,
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: "800",
  },
  manualFormInput: {
    height: 46,
    paddingHorizontal: 13,
    borderRadius: 12,
    color: COLORS.textPrimary,
    fontSize: 15,
    fontFamily: "Pretendard-SemiBold",
    backgroundColor: COLORS.surface,
  },
  manualNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 3,
  },
  manualNoticeText: {
    flex: 1,
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: "500",
    lineHeight: 16,
  },
});
