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
import { SafeAreaView } from "react-native-safe-area-context";

import { AppText as Text } from "@/components/AppText";
import { GridVideoPreview } from "@/components/location-confirm/GridVideoPreview";
import { VideoPreview } from "@/components/location-confirm/VideoPreview";
import { COLORS as APP_COLORS } from "@/constants/color";
import { saveRecording } from "@/services/recordingService";
import { useTripStore } from "@/store/useTripStore";

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
  sheet: APP_COLORS.sheetBackground,
  disabled: APP_COLORS.locationButtonDisabled,
  dragHandle: APP_COLORS.locationDragHandle,
  shadow: APP_COLORS.shadow,
};

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const MIN_SHEET_HEIGHT = SCREEN_HEIGHT * 0.42;
const MAX_SHEET_HEIGHT = SCREEN_HEIGHT * 0.88;
const DEFAULT_SHEET_HEIGHT = SCREEN_HEIGHT * 0.59;
const SEARCH_RADIUS_METERS = 3000;

type CapturedCoordinates = {
  latitude: number;
  longitude: number;
};

type KakaoPlace = {
  id: string;
  name: string;
  category: string;
  address: string;
  distance?: number;
  latitude: number;
  longitude: number;
};

type KakaoPlaceResponse = {
  id?: string;
  place_name?: string;
  category_name?: string;
  category_group_name?: string;
  road_address_name?: string;
  address_name?: string;
  distance?: string;
  x?: string;
  y?: string;
};

function parseCoordinate(value?: string): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapKakaoPlace(place: KakaoPlaceResponse): KakaoPlace | null {
  const latitude = Number(place.y);
  const longitude = Number(place.x);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return {
    id: String(place.id ?? `${latitude}-${longitude}`),
    name: place.place_name ?? "이름 없는 장소",
    category: place.category_group_name || place.category_name || "장소",
    address: place.road_address_name || place.address_name || "주소 정보 없음",
    distance: place.distance ? Number(place.distance) : undefined,
    latitude,
    longitude,
  };
}

function formatDistance(distance?: number): string {
  if (distance === undefined || !Number.isFinite(distance)) return "주변";
  if (distance < 1000) return `${distance}m`;
  return `${(distance / 1000).toFixed(1)}km`;
}

/**
 * 촬영 완료 후 장소를 검색하고 확정하는 화면입니다.
 *
 * CameraScreen에서 latitude/longitude route param을 전달하면 해당 지점을 고정해 검색합니다.
 * 전달되지 않은 경우에는 이 화면이 열린 시점의 기기 위치를 보조값으로 사용합니다.
 */
export default function LocationConfirmScreen() {
  const {
    videoUris: videoUrisParam,
    durationsMs: durationsMsParam,
    gridGroupId,
    latitude: latitudeParam,
    longitude: longitudeParam,
  } = useLocalSearchParams<{
    videoUris?: string;
    durationsMs?: string;
    gridGroupId?: string;
    latitude?: string;
    longitude?: string;
  }>();

  const videoUris = useMemo<string[]>(() => {
    if (!videoUrisParam) return [];
    try {
      return JSON.parse(videoUrisParam) as string[];
    } catch {
      return [];
    }
  }, [videoUrisParam]);

  const durationsMs = useMemo<number[]>(() => {
    if (!durationsMsParam) return [];
    try {
      return JSON.parse(durationsMsParam) as number[];
    } catch {
      return [];
    }
  }, [durationsMsParam]);

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
    routeCoordinates
      ? "촬영한 위치 주변 3km를 검색합니다."
      : "촬영 위치를 확인하고 있어요.",
  );
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<KakaoPlace[]>([]);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<KakaoPlace | null>(null);
  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);
  const [manualPlaceName, setManualPlaceName] = useState("");
  const [manualAddress, setManualAddress] = useState("");

  const videoUri = videoUris[0];
  const isGridSet = videoUris.length > 1;
  const searchRequestIdRef = useRef(0);

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

  /**
   * CameraScreen이 좌표를 넘기지 못한 구버전 흐름을 위한 보조 처리입니다.
   * 정확한 촬영 위치는 반드시 CameraScreen에서 route param으로 넘기는 방식이 우선입니다.
   */
  const loadFallbackDeviceLocation = useCallback(async () => {
    if (routeCoordinates) return;

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationMessage(
          "위치 권한을 허용하면 촬영 위치 주변을 검색할 수 있어요.",
        );
        return;
      }

      const lastKnown = await Location.getLastKnownPositionAsync();
      const position =
        lastKnown ??
        (await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }));

      setShootingCoordinates({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      setLocationMessage("현재 기기 위치 주변 3km를 검색합니다.");
    } catch (error) {
      console.warn("[LocationConfirm] 위치를 가져오지 못했습니다:", error);
      setLocationMessage(
        "촬영 위치를 확인하지 못했어요. 위치 권한을 확인해주세요.",
      );
    }
  }, [routeCoordinates]);

  useEffect(() => {
    void loadFallbackDeviceLocation();
  }, [loadFallbackDeviceLocation]);

  const searchPlacesAroundShootingLocation = useCallback(
    async (keyword: string) => {
      if (!shootingCoordinates) return;

      const apiKey = process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY;
      if (!apiKey) {
        setSearchError("Kakao REST API 키가 설정되지 않았어요.");
        setPlaces([]);
        return;
      }

      const requestId = ++searchRequestIdRef.current;
      setIsLoadingPlaces(true);
      setSearchError(null);

      try {
        const params = new URLSearchParams({
          x: String(shootingCoordinates.longitude),
          y: String(shootingCoordinates.latitude),
          radius: String(SEARCH_RADIUS_METERS),
          sort: "distance",
          size: "15",
        });

        let endpoint = "https://dapi.kakao.com/v2/local/search/category.json";

        // 빈 검색창에서는 촬영 위치와 가까운 음식점을 기본 제안합니다.
        if (keyword) {
          endpoint = "https://dapi.kakao.com/v2/local/search/keyword.json";
          params.set("query", keyword);
        } else {
          params.set("category_group_code", "FD6");
        }

        const response = await fetch(`${endpoint}?${params.toString()}`, {
          headers: {
            Authorization: `KakaoAK ${apiKey}`,
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            "[LocationConfirm] Kakao 장소 검색 실패:",
            response.status,
            errorText,
          );
          throw new Error("주변 장소를 불러오지 못했어요.");
        }

        const data = (await response.json()) as {
          documents?: KakaoPlaceResponse[];
        };
        const mappedPlaces = (data.documents ?? [])
          .map(mapKakaoPlace)
          .filter((place): place is KakaoPlace => place !== null);

        // 빠르게 타이핑할 때 이전 요청이 늦게 도착해 최신 결과를 덮어쓰지 않도록 막습니다.
        if (requestId === searchRequestIdRef.current) {
          setPlaces(mappedPlaces);
        }
      } catch (error) {
        if (requestId === searchRequestIdRef.current) {
          setPlaces([]);
          setSearchError(
            error instanceof Error
              ? error.message
              : "주변 장소를 불러오지 못했어요.",
          );
        }
      } finally {
        if (requestId === searchRequestIdRef.current) {
          setIsLoadingPlaces(false);
        }
      }
    },
    [shootingCoordinates],
  );

  // 350ms 디바운스를 둬서 글자마다 API 요청이 발생하지 않게 합니다.
  useEffect(() => {
    if (!shootingCoordinates) return;

    const timer = setTimeout(
      () => {
        void searchPlacesAroundShootingLocation(query.trim());
      },
      query.trim().length > 0 ? 350 : 0,
    );

    return () => clearTimeout(timer);
  }, [query, searchPlacesAroundShootingLocation, shootingCoordinates]);

  // 검색에 실패했을 때 입력한 장소명은 촬영 좌표와 결합해 일반 검색 결과와 같은 형태로 저장합니다.
  const manuallyAddedPlace = useMemo<KakaoPlace | null>(() => {
    const name = manualPlaceName.trim();
    if (!name || !shootingCoordinates) return null;

    return {
      id: "manual-place",
      name,
      category: "직접 추가한 장소",
      address: manualAddress.trim() || "주소 직접 입력 없음",
      latitude: shootingCoordinates.latitude,
      longitude: shootingCoordinates.longitude,
    };
  }, [manualAddress, manualPlaceName, shootingCoordinates]);

  const placeToSave = selectedPlace ?? manuallyAddedPlace;
  const canShowManualEntry =
    !isLoadingPlaces && (places.length === 0 || Boolean(searchError));

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

    try {
      for (let i = 0; i < videoUris.length; i += 1) {
        const uri = videoUris[i];
        await saveRecording({
          recordedAt: new Date().toISOString(),
          videoUri: uri,
          thumbnail: uri,
          durationMs: durationsMs[i] ?? 0,
          folderId: currentTrip.id,
          userId: "guest",
          location: {
            // 검색 결과의 Kakao 좌표 또는 직접 입력 장소의 촬영 좌표를 저장합니다.
            latitude: placeToSave.latitude,
            longitude: placeToSave.longitude,
            placeName:
              placeToSave.id === "manual-place" && manualAddress.trim()
                ? `${placeToSave.name} · ${placeToSave.address}`
                : placeToSave.name,
          },
          ...(isGridSet ? { gridGroupId, gridSlotIndex: i } : {}),
        });
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
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.container}>
          <View style={styles.topSection}>
            <Pressable
              onPress={() => router.back()}
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
              <Text allowFontScaling={false} style={styles.backLabel}>
                다시 촬영하기
              </Text>
            </Pressable>

            <View style={styles.videoContainer}>
              {isGridSet ? (
                <GridVideoPreview videoUris={videoUris} />
              ) : (
                <VideoPreview videoUri={videoUri ?? null} />
              )}
              {isGridSet && (
                <View style={styles.gridBadge} pointerEvents="none">
                  <Ionicons name="apps-outline" size={13} color="#FFFFFF" />
                  <Text allowFontScaling={false} style={styles.gridBadgeText}>
                    그리드 {videoUris.length}칸 동시 재생 미리보기
                  </Text>
                </View>
              )}
            </View>
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
                <Pressable
                  onPress={handleComplete}
                  disabled={!placeToSave}
                  style={({ pressed }) => [
                    styles.inlineNextButton,
                    !placeToSave && styles.inlineNextButtonDisabled,
                    pressed && placeToSave && styles.inlineNextButtonPressed,
                  ]}
                >
                  <Text
                    allowFontScaling={false}
                    style={styles.inlineNextButtonText}
                  >
                    완료
                  </Text>
                  <Ionicons name="arrow-forward" size={15} color="#FFFFFF" />
                </Pressable>
              </View>
              <Text allowFontScaling={false} style={styles.sheetDescription}>
                {locationMessage}
              </Text>
            </View>

            <View style={styles.searchField}>
              <Ionicons
                name="search-outline"
                size={20}
                color={COLORS.textSecondary}
              />
              <TextInput
                value={query}
                onChangeText={(value) => {
                  setQuery(value);
                  setSelectedPlace(null);
                  setIsManualEntryOpen(false);
                }}
                placeholder="장소·주소·카테고리 검색"
                placeholderTextColor={COLORS.textSecondary}
                returnKeyType="search"
                autoCorrect={false}
                style={styles.searchInput}
              />
              {query.length > 0 && (
                <Pressable onPress={() => setQuery("")} hitSlop={10}>
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
              <View style={styles.resultHeader}>
                <Text style={styles.resultTitle}>
                  {query.trim()
                    ? `“${query.trim()}” 검색 결과`
                    : "촬영 위치 주변 추천"}
                </Text>
                {shootingCoordinates && (
                  <Text style={styles.resultRange}>
                    반경 {SEARCH_RADIUS_METERS / 1000}km
                  </Text>
                )}
              </View>

              {isLoadingPlaces ? (
                <View style={styles.statusRow}>
                  <Ionicons
                    name="ellipsis-horizontal"
                    size={22}
                    color={COLORS.primary}
                  />
                  <Text style={styles.statusText}>
                    주변 장소를 찾고 있어요.
                  </Text>
                </View>
              ) : null}

              {!isLoadingPlaces && searchError ? (
                <View style={styles.statusRow}>
                  <Ionicons
                    name="alert-circle-outline"
                    size={21}
                    color={COLORS.primary}
                  />
                  <Text style={styles.statusText}>{searchError}</Text>
                </View>
              ) : null}

              {!isLoadingPlaces && !searchError && places.length === 0 ? (
                <View style={styles.statusRow}>
                  <Ionicons
                    name="search-outline"
                    size={21}
                    color={COLORS.textSecondary}
                  />
                  <Text style={styles.statusText}>
                    {shootingCoordinates
                      ? "해당 위치 근처의 장소를 찾지 못했어요."
                      : "위치 확인 후 검색 결과를 보여드릴게요."}
                  </Text>
                </View>
              ) : null}

              {canShowManualEntry ? (
                <View style={styles.manualAddSection}>
                  <Pressable
                    onPress={() => {
                      setIsManualEntryOpen((opened) => !opened);
                      setSelectedPlace(null);
                    }}
                    style={({ pressed }) => [
                      styles.manualAddTrigger,
                      isManualEntryOpen && styles.manualAddTriggerOpen,
                      pressed && styles.manualAddTriggerPressed,
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
                        onChangeText={(value) => {
                          setManualPlaceName(value);
                          setSelectedPlace(null);
                        }}
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
                        onChangeText={(value) => {
                          setManualAddress(value);
                          setSelectedPlace(null);
                        }}
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

              {places.map((place) => {
                const selected = selectedPlace?.id === place.id;
                return (
                  <Pressable
                    key={place.id}
                    onPress={() => {
                      setSelectedPlace(place);
                      setIsManualEntryOpen(false);
                    }}
                    style={({ pressed }) => [
                      styles.placeCard,
                      selected && styles.placeCardSelected,
                      pressed && styles.placeCardPressed,
                    ]}
                  >
                    <View
                      style={[
                        styles.placeIcon,
                        selected && styles.placeIconSelected,
                      ]}
                    >
                      <Ionicons
                        name="location"
                        size={20}
                        color={selected ? "#FFFFFF" : COLORS.primary}
                      />
                    </View>
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
                    <View
                      style={[styles.radio, selected && styles.radioSelected]}
                    >
                      {selected && <View style={styles.radioDot} />}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  keyboardAvoidingView: { flex: 1 },
  container: { flex: 1, backgroundColor: COLORS.background },
  topSection: { flex: 1, paddingHorizontal: 18, paddingBottom: 12 },
  backButton: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  backButtonPressed: { opacity: 0.6 },
  backLabel: {
    color: COLORS.textPrimary,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "700",
  },
  videoContainer: {
    flex: 1,
    minHeight: 100,
    overflow: "hidden",
    borderRadius: 22,
    backgroundColor: "#E8E5DF",
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  gridBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  gridBadgeText: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" },
  sheet: {
    paddingHorizontal: 20,
    paddingBottom: 18,
    backgroundColor: COLORS.sheet,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 12,
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
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: "600",
    padding: 0,
  },
  listScroll: { flex: 1, marginTop: 12 },
  listContent: { gap: 9, paddingBottom: 20 },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 3,
    marginBottom: 2,
  },
  resultTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: "800" },
  resultRange: { color: COLORS.textSecondary, fontSize: 12, fontWeight: "600" },
  statusRow: {
    minHeight: 72,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statusText: {
    flex: 1,
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
  },
  placeCard: {
    minHeight: 82,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 17,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  placeCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primarySoft,
  },
  placeCardPressed: { opacity: 0.8, transform: [{ scale: 0.995 }] },
  placeIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primarySoft,
  },
  placeIconSelected: { backgroundColor: COLORS.primary },
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
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: { borderColor: COLORS.primary },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
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
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#FFF9F6",
  },
  manualAddTriggerOpen: {
    borderColor: COLORS.primary,
  },
  manualAddTriggerPressed: {
    opacity: 0.8,
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
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: "600",
    backgroundColor: "#FFFFFF",
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
