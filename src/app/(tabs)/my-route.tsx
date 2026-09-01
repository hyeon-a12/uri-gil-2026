import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { parseDateRange, type FolderItem } from "@/services/folderService";
import { getRecordingsByFolder } from "@/services/recordingService";
import {
  getTripScheduleStops,
  type TripScheduleStop,
} from "@/services/trip-schedule-service";
import { getStopOrder, saveStopOrder, type StopOrderMap } from "@/services/stop-order-service";
import { buildPlanData, type PlanStop } from "@/services/tripPlanService";
import { navigateToCamera } from "@/navigation/recordingNavigation";
import type { RecordingData } from "@/types/recording";
import type { ClipItem } from "@/types/home";
import { ClipPreviewModal } from "@/components/ClipPreview/ClipPreviewModal";
import {
  PlaceDetailModal,
  fetchKakaoPlaceInfo,
  type KakaoPlaceInfo,
  type PlaceDetailView,
} from "@/components/PlaceDetail/PlaceDetailModal";
import { useTripStore } from "@/store/useTripStore";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { AppText as Text } from '@/components/AppText';
import { RoutePlanView } from '@/components/RoutePlanView';
import KakaoMapView, { type KakaoMapPin } from '@/components/KakaoMapView';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as MediaLibrary from 'expo-media-library';
import { captureRef } from 'react-native-view-shot';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS as SHARED_COLORS, RADIUS, SPACING } from '@/constants/color';

const COLORS = {
  background: SHARED_COLORS.background,
  card: SHARED_COLORS.background,

  primary: SHARED_COLORS.accent,
  primaryDark: SHARED_COLORS.accentPressed,
  primarySoft: SHARED_COLORS.main,

  textPrimary: SHARED_COLORS.textPrimary,
  textSecondary: SHARED_COLORS.textSecondary,
  textTertiary: SHARED_COLORS.textSecondary,

  border: SHARED_COLORS.border,
  divider: SHARED_COLORS.border,

  route: "#F6784D",
  routeSoft: "#FFD2C2",

  shadow: SHARED_COLORS.shadow,

  record: SHARED_COLORS.danger,
  white: SHARED_COLORS.background,
  surface: SHARED_COLORS.surface,
};

// 사용자 흐름을 단순화해 '일정'과 '지도' 두 가지 보기만 제공합니다.
type RouteViewMode = "info" | "map";

// 지도 위 스톱 카드 가로 스크롤 — 부드럽게 흘러가는 대신 카드 한 장씩 딱딱
// 걸리는(스냅) 느낌을 주기 위한 값들입니다.
const STOP_CARD_WIDTH = 300;
const STOP_CARD_GAP = SPACING.md;
const STOP_CARD_SNAP_INTERVAL = STOP_CARD_WIDTH + STOP_CARD_GAP;

function MapControlButtons({ onPressLocate }: { onPressLocate: () => void }) {
  return (
    <View style={styles.mapControls}>
      <Pressable
        onPress={onPressLocate}
        style={({ pressed }) => [
          styles.mapControlButton,
          pressed && styles.mapControlButtonPressed,
        ]}
      >
        <Ionicons
          name="navigate-outline"
          size={23}
          color={COLORS.textPrimary}
        />
      </Pressable>
    </View>
  );
}

interface ClipThumbnailProps {
  thumbnail: string;
  duration: string;
  onPress: () => void;
}

function ClipThumbnail({ thumbnail, duration, onPress }: ClipThumbnailProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.clipThumbnail,
        pressed && styles.cardPressed,
      ]}
    >
      <Image
        source={{ uri: thumbnail }}
        style={styles.clipImage}
        contentFit="cover"
        transition={150}
      />

      <View style={styles.clipDim} />

      <View style={styles.clipPlayButton}>
        <Ionicons name="play" size={14} color="#FFFFFF" />
      </View>

      <Text allowFontScaling={false} style={styles.clipDuration}>
        {duration}
      </Text>
    </Pressable>
  );
}

interface SelectedStopCardProps {
  stop: PlanStop;
  onPreviewClip: (clip: ClipItem) => void;
  onPressDetail: (stop: PlanStop) => void;
}

function SelectedStopCard({ stop, onPreviewClip, onPressDetail }: SelectedStopCardProps) {
  return (
    <View style={styles.stopCard}>
      <View style={styles.stopCardHeader}>
        <View style={styles.stopCardOrder}>
          <Text allowFontScaling={false} style={styles.stopCardOrderText}>
            {stop.order}
          </Text>
        </View>

        <View style={styles.stopCardTitleArea}>
          <View style={styles.stopCardTitleRow}>
            <Text
              numberOfLines={1}
              allowFontScaling={false}
              style={styles.stopCardTitle}
            >
              {stop.name}
            </Text>

            <Ionicons name="location" size={16} color={COLORS.primary} />
          </View>

          <Text allowFontScaling={false} style={styles.stopCardMeta}>
            클립 {stop.clips.length}개 · {stop.time}
          </Text>
        </View>

        <Pressable
          hitSlop={10}
          onPress={() => {
            if (stop.source === "manual") {
              // 직접 추가한 장소는 실제 API로 검증된 정보가 아니라 상세
              // 정보를 보여줄 수 없습니다.
              Alert.alert(stop.name, "직접 추가한 장소는 상세 정보가 없어요.");
              return;
            }

            if (stop.latitude === null || stop.longitude === null) {
              Alert.alert(stop.name, "위치 정보가 없어 상세 정보를 볼 수 없어요.");
              return;
            }

            onPressDetail(stop);
          }}
          style={styles.stopCardMoreButton}
        >
          <Ionicons
            name="chevron-forward"
            size={22}
            color={COLORS.textTertiary}
          />
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.clipList}
      >
        {stop.clips.map((clip) => (
          <ClipThumbnail
            key={clip.id}
            thumbnail={clip.thumbnail}
            duration={clip.duration}
            onPress={() =>
              onPreviewClip({
                id: clip.id,
                title: stop.name,
                recordedAt: clip.recordedAt,
                durationSeconds: clip.durationMs ? clip.durationMs / 1000 : undefined,
                thumbnail: clip.thumbnail,
                uri: clip.uri,
              })
            }
          />
        ))}

        <Pressable
          onPress={() => {
            if (stop.latitude === null || stop.longitude === null) {
              // 좌표를 모르는 스톱은 바로 저장할 장소를 특정할 수 없어
              // 기존처럼 카메라 → 장소 확인 화면 흐름으로 보냅니다.
              navigateToCamera();
              return;
            }

            navigateToCamera({
              quickAddPlace: {
                name: stop.name,
                latitude: stop.latitude,
                longitude: stop.longitude,
              },
            });
          }}
          style={({ pressed }) => [
            styles.addClipButton,
            pressed && styles.cardPressed,
          ]}
        >
          <Ionicons name="add" size={29} color={COLORS.textSecondary} />

          <Text allowFontScaling={false} style={styles.addClipText}>
            클립 추가
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

interface InternalNavigationProps {
  selectedMode: RouteViewMode;
  onChange: (mode: RouteViewMode) => void;
}

function InternalNavigation({
  selectedMode,
  onChange,
}: InternalNavigationProps) {
  const items: {
    mode: RouteViewMode;
    label: string;
    icon: React.ComponentProps<typeof Ionicons>["name"];
    activeIcon: React.ComponentProps<typeof Ionicons>["name"];
  }[] = [
    {
      mode: "info",
      label: "일정",
      icon: "calendar-outline",
      activeIcon: "calendar",
    },
    {
      mode: "map",
      label: "지도",
      icon: "map-outline",
      activeIcon: "map",
    },
  ];

  return (
    <View style={styles.internalNavigation}>
      {items.map((item) => {
        const selected = selectedMode === item.mode;

        return (
          <Pressable
            key={item.mode}
            onPress={() => onChange(item.mode)}
            style={[
              styles.internalNavigationItem,
              selected && styles.internalNavigationItemSelected,
            ]}
          >
            <Ionicons
              name={selected ? item.activeIcon : item.icon}
              size={22}
              color={selected ? COLORS.primary : COLORS.textSecondary}
            />

            <Text
              numberOfLines={1}
              allowFontScaling={false}
              style={[
                styles.internalNavigationLabel,
                selected && styles.internalNavigationLabelSelected,
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}


function getTripDisplayName(trip: FolderItem | null): string {
  if (!trip) {
    return "여행 선택";
  }

  // FolderItem의 실제 이름 필드가 프로젝트마다 다를 수 있어
  // 흔히 쓰는 필드명을 순서대로 확인합니다.
  const candidate = trip as FolderItem & Record<string, unknown>;
  const displayName =
    candidate.name ??
    candidate.title ??
    candidate.folderName ??
    candidate.tripName;

  return typeof displayName === "string" && displayName.trim().length > 0
    ? displayName
    : `여행 ${trip.id}`;
}

type TravelShareSheetProps = {
  visible: boolean;
  tripName: string;
  tripSummary: string;
  placeCount: number;
  mapPins: KakaoMapPin[];
  bottomInset: number;
  onClose: () => void;
  onNativeShare: () => void;
};

function TravelShareSheet({
  visible,
  tripName,
  tripSummary,
  placeCount,
  mapPins,
  bottomInset,
  onClose,
  onNativeShare,
}: TravelShareSheetProps) {
  const previewCardRef = useRef<View>(null);
  const isSavingImageRef = useRef(false);

  const handleSaveImage = async () => {
    if (isSavingImageRef.current || !previewCardRef.current) return;
    isSavingImageRef.current = true;

    try {
      const { status } = await MediaLibrary.requestPermissionsAsync(true);
      if (status !== 'granted') {
        Alert.alert('권한 필요', '이미지를 저장하려면 갤러리 접근 권한이 필요해요.');
        return;
      }

      const uri = await captureRef(previewCardRef, { format: 'png', quality: 1 });
      await MediaLibrary.createAssetAsync(uri);
      Alert.alert('저장 완료', '여행 카드 이미지를 갤러리에 저장했어요.');
    } catch (error) {
      console.error('[TravelShareSheet] 이미지 저장 실패:', error);
      Alert.alert('저장 실패', '이미지를 저장하지 못했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      isSavingImageRef.current = false;
    }
  };

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.shareModalRoot}>
        <Pressable
          accessibilityLabel="공유 화면 닫기"
          onPress={onClose}
          style={styles.shareBackdrop}
        />

        <View style={[styles.shareSheet, { paddingBottom: bottomInset + 20 }]}>
          <View style={styles.shareHandle} />

          <View style={styles.shareHeader}>
            <View style={styles.shareHeaderText}>
              <Text style={styles.shareTitle}>여행 공유하기</Text>
              <Text style={styles.shareDescription}>
                {tripName} 여행 경로와 클립을{"\n"}친구들과 공유해보세요!
              </Text>
            </View>

            <Pressable hitSlop={12} onPress={onClose}>
              <Ionicons name="close" size={30} color="#8A8A8A" />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.shareScrollContent}
          >
            <View ref={previewCardRef} collapsable={false} style={styles.sharePreviewCard}>
              <View pointerEvents="none" style={styles.shareMapPreview}>
                <KakaoMapView pins={mapPins} height={126} pathColor={COLORS.primary} />
              </View>

              <View style={styles.sharePreviewTextArea}>
                <Text numberOfLines={1} style={styles.sharePreviewTitle}>
                  {tripName}
                </Text>
                <Text style={styles.sharePreviewMeta}>
                  {tripSummary} · 장소 {placeCount}곳
                </Text>
                <Text style={styles.sharePreviewMeta}>
                  여행 경로를 친구들과 함께 확인해보세요
                </Text>
              </View>
            </View>

            <View style={styles.shareActionList}>
              <ShareActionRow
                icon="link-outline"
                label="공유 링크 보내기"
                onPress={onNativeShare}
              />
              <ShareActionRow
                icon="download-outline"
                label="이미지로 저장"
                onPress={() => void handleSaveImage()}
                isLast
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function ShareActionRow({
  icon,
  label,
  onPress,
  isLast = false,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
  isLast?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.shareActionRow,
        !isLast && styles.shareActionDivider,
        pressed && styles.shareActionPressed,
      ]}
    >
      <Ionicons name={icon} size={25} color="#555555" />
      <Text style={styles.shareActionLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={22} color="#AAAAAA" />
    </Pressable>
  );
}

export default function MyRouteScreen() {
  const { view, saved } = useLocalSearchParams<{
    view?: string;
    saved?: string;
  }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  // 전환 UI는 홈 화면에만 있습니다 — 이 화면은 useTripStore의 currentTrip을
  // 구독만 하고, 그 값이 바뀌면(홈에서 전환) 아래 클립 데이터를 다시 불러옵니다.
  const currentTrip = useTripStore((state) => state.currentTrip);

  const [recordings, setRecordings] = useState<RecordingData[]>([]);
  const [savedScheduleStops, setSavedScheduleStops] = useState<
    TripScheduleStop[]
  >([]);
  const [stopOrder, setStopOrder] = useState<StopOrderMap>({});
  const [previewClip, setPreviewClip] = useState<ClipItem | null>(null);
  const [viewingPlace, setViewingPlace] = useState<PlaceDetailView | null>(null);
  const [placeExtraInfo, setPlaceExtraInfo] = useState<KakaoPlaceInfo | null>(null);
  const [isLoadingPlaceInfo, setIsLoadingPlaceInfo] = useState(false);

  // 정보 팝업이 열릴 때(viewingPlace가 바뀔 때)만 카카오 로컬 검색으로
  // 주소·카테고리·전화번호를 채웁니다 — 홈 화면의 정보 팝업과 동일한 방식.
  useEffect(() => {
    let isMounted = true;
    (async () => {
      if (!viewingPlace) {
        setPlaceExtraInfo(null);
        return;
      }
      setIsLoadingPlaceInfo(true);
      setPlaceExtraInfo(null);
      const info = await fetchKakaoPlaceInfo(
        viewingPlace.name,
        viewingPlace.lat,
        viewingPlace.lng,
      );
      if (isMounted) {
        setPlaceExtraInfo(info);
        setIsLoadingPlaceInfo(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [viewingPlace]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      (async () => {
        if (!currentTrip) {
          if (isActive) {
            setRecordings([]);
            setSavedScheduleStops([]);
            setStopOrder({});
          }
          return;
        }

        try {
          const [records, scheduleStops, order] = await Promise.all([
            getRecordingsByFolder(currentTrip.id),
            getTripScheduleStops(currentTrip.id),
            getStopOrder(currentTrip.id),
          ]);
          if (isActive) {
            setRecordings(records);
            setSavedScheduleStops(scheduleStops);
            setStopOrder(order);
          }
        } catch (error) {
          console.error(
            "[MyRouteScreen] 여행 데이터를 불러오지 못했습니다.",
            error,
          );
          if (isActive) {
            setRecordings([]);
            setSavedScheduleStops([]);
            setStopOrder({});
          }
        }
      })();

      return () => {
        isActive = false;
      };
    }, [currentTrip?.id]),
  );

  // 드래그로 순서를 바꾸면 즉시 반영되도록 로컬 상태도 같이 갱신하고, 다음 방문 때도
  // 유지되도록 AsyncStorage에 저장합니다.
  const handleReorderStops = useCallback(
    (day: number, orderedIds: string[]) => {
      if (!currentTrip) return;
      setStopOrder((prev) => ({ ...prev, [day]: orderedIds }));
      void saveStopOrder(currentTrip.id, day, orderedIds);
    },
    [currentTrip],
  );

  const planData = useMemo(
    () => buildPlanData(recordings, currentTrip, savedScheduleStops, stopOrder),
    [recordings, currentTrip, savedScheduleStops, stopOrder],
  );

  const nights = useMemo(() => {
    if (!currentTrip) return null;
    const range = parseDateRange(currentTrip.dateRange);
    if (!range) return null;
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    // range.end는 종료일 23:59:59로 저장돼 있어서(getFolderStatus가 종료일
    // 당일까지 '여행중'으로 보기 위함), 그대로 나눈 뒤 Math.round를 쓰면
    // 1박이 항상 1일 더 많게 반올림됩니다. Math.floor로 그 끝자락을 버립니다.
    return Math.floor(
      (range.end.getTime() - range.start.getTime()) / MS_PER_DAY,
    );
  }, [currentTrip]);

  // day 탭에 "7/7"처럼 실제 날짜를 보여주기 위한 여행 시작일.
  const tripStartDate = useMemo(() => {
    if (!currentTrip) return null;
    return parseDateRange(currentTrip.dateRange)?.start ?? null;
  }, [currentTrip]);

  const [selectedMode, setSelectedMode] = useState<RouteViewMode>("info");

  // 홈에서 AI 추천 일정을 확정하고 넘어온 경우, 이전 탭 상태와 무관하게 일정 탭을 엽니다.
  useEffect(() => {
    if (view === "schedule") {
      setSelectedMode("info");
    }
  }, [saved, view]);

  const [isShareSheetVisible, setIsShareSheetVisible] = useState(false);

  const tripName = getTripDisplayName(currentTrip);
  const tripSummary = currentTrip
    ? nights !== null
      ? `${nights}박 ${nights + 1}일`
      : "여행 일정"
    : "여행을 선택해주세요";

  const handleNativeShare = useCallback(async () => {
    try {
      await Share.share({
        title: `${tripName} 여행`,
        message: `${tripName}의 ${tripSummary} 여행 경로를 확인해보세요!`,
      });
    } catch (error) {
      console.error("[MyRouteScreen] 공유 화면을 열지 못했습니다.", error);
      Alert.alert("공유를 열지 못했어요", "잠시 후 다시 시도해 주세요.");
    }
  }, [tripName, tripSummary]);

  const mapHeight = Math.min(Math.max(width * 0.95, 400), 540);

  // 실제 GPS 위치 — "현재 위치" 버튼을 눌렀을 때도 다시 불러와 지도를 재중심합니다.
  const [deviceLocation, setDeviceLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  // notifyOnFailure: 최초 진입 시 조용히 시도할 때는 false, 사용자가 직접
  // "내 위치로" 버튼을 눌렀을 때는 true로 넘겨 실패 사유를 알려줍니다.
  const loadDeviceLocation = useCallback(async (notifyOnFailure = false) => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        if (notifyOnFailure) {
          Alert.alert("위치 권한이 필요해요", "설정에서 위치 접근을 허용해주세요.");
        }
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setDeviceLocation({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      });
    } catch (error) {
      console.warn("[MyRouteScreen] 현재 위치를 가져오지 못했습니다:", error);
      if (notifyOnFailure) {
        Alert.alert("위치를 가져오지 못했어요", "잠시 후 다시 시도해주세요.");
      }
    }
  }, []);

  useEffect(() => {
    void loadDeviceLocation();
  }, [loadDeviceLocation]);

  // 좌표가 이전과 완전히 같으면(제자리에서 다시 누른 경우) 지도 URL 문자열이
  // 안 바뀌어서 WebView가 재로드를 건너뛰고, "내 위치로" 버튼이 아무 반응도
  // 없는 것처럼 보였습니다. 누를 때마다 이 값을 증가시켜 항상 재중심이
  // 일어나게 합니다.
  const [locateToken, setLocateToken] = useState(0);

  const handlePressLocate = useCallback(async () => {
    await loadDeviceLocation(true);
    setLocateToken((prev) => prev + 1);
  }, [loadDeviceLocation]);

  // 지도에 찍을 핀 — 좌표가 있는 스톱만, day/순서대로 이어서 경로선을 그립니다.
  const mapPins = useMemo<KakaoMapPin[]>(
    () =>
      planData.stops
        .filter(
          (stop): stop is PlanStop & { latitude: number; longitude: number } =>
            typeof stop.latitude === "number" &&
            typeof stop.longitude === "number",
        )
        .sort((a, b) => a.order - b.order)
        .map((stop) => ({
          id: stop.id,
          lat: stop.latitude,
          lng: stop.longitude,
          label: String(stop.order),
          color: COLORS.primary,
        })),
    [planData.stops],
  );

  return (
    <View style={styles.screen}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 10,
          },
        ]}
      >
        {/* 탭 루트 화면이라 뒤로가기 개념이 없어서 버튼을 없앴습니다.
            오른쪽 공유 버튼과의 좌우 균형을 위해 같은 폭의 빈 자리만 남겨둡니다. */}
        <View style={styles.headerButtonSpacer} />

        {/* 여행 전환 트리거는 홈 화면에만 있습니다 — 여기는 currentTrip을
            구독해서 이름만 보여줍니다(탭해도 아무 일도 일어나지 않음). */}
        <View style={styles.headerTitleArea}>
          <View style={styles.headerTripTitleRow}>
            <Text
              numberOfLines={1}
              allowFontScaling={false}
              style={styles.headerTitle}
            >
              {getTripDisplayName(currentTrip)}
            </Text>
          </View>

          <Text
            numberOfLines={1}
            allowFontScaling={false}
            style={styles.headerSubtitle}
          >
            {currentTrip
              ? `${nights !== null ? `${nights}박 ${nights + 1}일 · ` : ""}장소 ${planData.stops.length}곳`
              : "여행을 선택해주세요"}
          </Text>
        </View>

        {selectedMode === "map" ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="여행 경로 공유하기"
            hitSlop={12}
            onPress={() => setIsShareSheetVisible(true)}
            style={({ pressed }) => [
              styles.headerButton,
              pressed && styles.headerButtonPressed,
            ]}
          >
            <Ionicons
              name="share-outline"
              size={23}
              color={COLORS.textPrimary}
            />
          </Pressable>
        ) : (
          // 일정 탭에서는 제목을 정확히 중앙에 두기 위한 빈 공간만 유지합니다.
          <View style={styles.headerButtonSpacer} />
        )}
      </View>

      <View style={styles.content}>
        {selectedMode === "map" ? (
          <View style={styles.mapScreen}>
            <View
              style={[
                styles.mapFrame,
                {
                  height: mapHeight,
                },
              ]}
            >
              <KakaoMapView
                pins={mapPins}
                height={mapHeight}
                currentLocation={deviceLocation}
                pathColor={COLORS.primary}
                focusOnLocationToken={locateToken || undefined}
              />

              <MapControlButtons onPressLocate={handlePressLocate} />
            </View>

            {planData.stops.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={[styles.stopCardScroll, { top: mapHeight - 56 }]}
                contentContainerStyle={styles.selectedCardWrapper}
                snapToInterval={STOP_CARD_SNAP_INTERVAL}
                snapToAlignment="start"
                decelerationRate="fast"
              >
                {[...planData.stops]
                  .sort((a, b) => a.order - b.order)
                  .map((stop) => (
                    <View key={stop.id} style={styles.stopCardSlide}>
                      <SelectedStopCard
                        stop={stop}
                        onPreviewClip={setPreviewClip}
                        onPressDetail={(pressedStop) =>
                          setViewingPlace({
                            id: pressedStop.id,
                            name: pressedStop.name,
                            lat: pressedStop.latitude!,
                            lng: pressedStop.longitude!,
                          })
                        }
                      />
                    </View>
                  ))}
              </ScrollView>
            ) : null}
          </View>
        ) : (
          <RoutePlanView
            hasTrip={!!currentTrip}
            tripId={currentTrip?.id}
            stops={planData.stops}
            dayNumbers={planData.dayNumbers}
            tripStartDate={tripStartDate}
            onReorderStops={handleReorderStops}
          />
        )}
      </View>

      <View
        style={[
          styles.internalNavigationWrapper,
          {
            bottom: insets.bottom + 86,
          },
        ]}
      >
        <InternalNavigation
          selectedMode={selectedMode}
          onChange={setSelectedMode}
        />
      </View>

      <TravelShareSheet
        visible={isShareSheetVisible}
        tripName={tripName}
        tripSummary={tripSummary}
        placeCount={planData.stops.length}
        mapPins={mapPins}
        bottomInset={insets.bottom}
        onClose={() => setIsShareSheetVisible(false)}
        onNativeShare={handleNativeShare}
      />

      <ClipPreviewModal
        clip={previewClip}
        onClose={() => setPreviewClip(null)}
      />

      <PlaceDetailModal
        place={viewingPlace}
        extraInfo={placeExtraInfo}
        isLoadingExtraInfo={isLoadingPlaceInfo}
        onClose={() => setViewingPlace(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  header: {
    minHeight: 84,

    paddingHorizontal: SPACING.md,
    paddingBottom: 0,

    flexDirection: "row",
    alignItems: "flex-end",

    backgroundColor: COLORS.background,
  },

  headerButton: {
    width: 46,
    height: 46,

    borderRadius: 23,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: COLORS.surface,
  },

  // 뒤로가기 버튼이 있던 자리에 남겨두는 빈 공간 — headerButton과 같은 너비로
  // 오른쪽 공유 버튼과 좌우 균형은 맞추되, 원형 배경/테두리는 없앤 순수 여백입니다.
  headerButtonSpacer: {
    width: 46,
    height: 46,
  },

  headerButtonPressed: {
    opacity: 0.68,
    transform: [{ scale: 0.96 }],
  },

  headerTitleArea: {
    flex: 1,

    alignItems: "center",
    justifyContent: "center",
  },

  headerTripTitleRow: {
    maxWidth: "100%",

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",

    gap: SPACING.xs,
  },

  headerTitle: {
    color: COLORS.textPrimary,

    fontSize: 19,
    lineHeight: 25,
    fontWeight: "700",

    letterSpacing: -0.5,
  },

  headerSubtitle: {
    marginTop: SPACING.xs,

    color: COLORS.textSecondary,

    fontSize: 11,
    lineHeight: 16,
    fontWeight: "600",
  },

  content: {
    flex: 1,
  },

  mapScreen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  mapFrame: {
    marginHorizontal: SPACING.md,

    overflow: "hidden",

    borderRadius: 28,

    backgroundColor: COLORS.surface,

    borderWidth: 1,
    borderColor: "#D6E8E0",
  },

  mapControls: {
    position: "absolute",
    right: 14,
    bottom: 54,
    zIndex: 20,
    // WebView(카카오맵)는 안드로이드에서 zIndex와 무관하게 형제 뷰 위로 겹쳐
    // 보일 수 있어서, elevation까지 같이 줘야 이 버튼이 지도 위로 확실히
    // 올라옵니다(stopCardScroll과 동일한 이유).
    elevation: 20,

    gap: SPACING.sm,
  },

  mapControlButton: {
    width: 46,
    height: 46,

    borderRadius: 23,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: "rgba(255,255,255,0.93)",
  },

  mapControlButtonPressed: {
    opacity: 0.74,
    transform: [{ scale: 0.95 }],
  },

  // WebView(카카오맵)는 안드로이드에서 zIndex와 무관하게 다른 형제 뷰 위로
  // 겹쳐 보이는 경우가 있어서, elevation까지 같이 줘야 이 카드 목록이 지도
  // 위로 확실히 올라옵니다.
  // 카드 목록을 세로 스크롤 흐름 밖으로 빼서 지도 위에 절대 위치로 고정합니다
  // (top은 mapHeight에 따라 인라인으로 계산해서 넣습니다) — 화면을 세로로
  // 스크롤해도 이 카드 목록은 움직이지 않고, 자기 자신만 가로로 스크롤됩니다.
  stopCardScroll: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 30,
    elevation: 10,
  },

  selectedCardWrapper: {
    paddingHorizontal: SPACING.lg,
    gap: STOP_CARD_GAP,
  },

  // 가로 스크롤 안에서 각 스톱 카드 한 장의 너비.
  stopCardSlide: {
    width: STOP_CARD_WIDTH,
  },

  stopCard: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.md,

    borderRadius: RADIUS.sheet,

    backgroundColor: "#FFFFFF",
  },

  stopCardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },

  stopCardOrder: {
    width: 32,
    height: 32,

    borderRadius: 16,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: COLORS.primary,
  },

  stopCardOrderText: {
    color: "#FFFFFF",

    fontSize: 13,
    lineHeight: 17,
    fontWeight: "800",
  },

  stopCardTitleArea: {
    flex: 1,

    marginLeft: 11,
  },

  stopCardTitleRow: {
    flexDirection: "row",
    alignItems: "center",

    gap: SPACING.xs,
  },

  stopCardTitle: {
    maxWidth: "82%",

    color: COLORS.textPrimary,

    fontSize: 16,
    lineHeight: 22,
    fontWeight: "600",
  },

  stopCardMeta: {
    marginTop: SPACING.xs,

    color: COLORS.textSecondary,

    fontSize: 12,
    lineHeight: 17,
    fontWeight: "500",
  },

  stopCardMoreButton: {
    width: 34,
    height: 42,

    alignItems: "center",
    justifyContent: "center",
  },

  clipList: {
    paddingTop: 13,
    gap: SPACING.sm,
  },

  clipThumbnail: {
    position: "relative",

    width: 104,
    height: 82,

    overflow: "hidden",

    borderRadius: RADIUS.card,

    backgroundColor: "#E8E5DF",
  },

  clipImage: {
    width: "100%",
    height: "100%",
  },

  clipDim: {
    ...StyleSheet.absoluteFillObject,

    backgroundColor: "rgba(20,20,18,0.10)",
  },

  clipPlayButton: {
    position: "absolute",
    top: "50%",
    left: "50%",

    width: 30,
    height: 30,

    marginLeft: -15,
    marginTop: -15,

    borderRadius: 15,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: "rgba(28,28,25,0.52)",
  },

  clipDuration: {
    position: "absolute",
    right: 6,
    bottom: 5,

    color: "#FFFFFF",

    fontSize: 10,
    lineHeight: 13,
    fontWeight: "600",

    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowRadius: 3,
  },

  addClipButton: {
    width: 88,
    height: 82,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: RADIUS.card,

    backgroundColor: COLORS.surface,
  },

  addClipText: {
    marginTop: SPACING.xs,

    color: COLORS.textSecondary,

    fontSize: 10,
    lineHeight: 14,
    fontWeight: "700",
  },

  cardPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.99 }],
  },

  internalNavigationWrapper: {
    position: "absolute",
    left: 22,
    right: 22,
    zIndex: 40,
  },

  internalNavigation: {
    height: 60,

    paddingHorizontal: SPACING.xs,
    paddingVertical: SPACING.xs,

    flexDirection: "row",
    alignItems: "center",

    borderRadius: 20,

    backgroundColor: "rgba(255,255,255,0.97)",

    shadowColor: COLORS.shadow,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.11,
    shadowRadius: 12,

    elevation: 8,
  },

  internalNavigationItem: {
    flex: 1,
    height: 46,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: RADIUS.banner,
  },

  internalNavigationItemSelected: {
    backgroundColor: COLORS.primarySoft,
  },

  internalNavigationLabel: {
    marginTop: SPACING.xs,

    color: COLORS.textSecondary,

    fontSize: 10,
    lineHeight: 14,
    fontWeight: "600",
  },

  internalNavigationLabelSelected: {
    color: COLORS.primary,
    fontWeight: "800",
  },

  alternativeView: {
    flex: 1,
  },

  // === 여기서부터 '일정' 탭(RoutePlanView) 전용 스타일입니다 ===

  planScreen: {
    flex: 1,
  },

  planEmptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    paddingBottom: 120,
    gap: SPACING.sm,
  },

  planEmptyTitle: {
    marginTop: SPACING.xs,
    color: COLORS.textPrimary,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "700",
  },

  planEmptyDescription: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
    textAlign: "center",
  },

  planContent: {
    paddingHorizontal: SPACING.screenH,
    paddingTop: SPACING.md,
    paddingBottom: 190,
  },

  dayChipRow: {
    flexDirection: "row",
    gap: SPACING.sm,

    paddingBottom: SPACING.xs,
  },

  dayChip: {
    flexDirection: "row",
    alignItems: "center",

    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,

    borderRadius: RADIUS.banner,

    backgroundColor: COLORS.surface,
  },

  dayChipSelected: {
    backgroundColor: COLORS.primary,
  },

  dayChipText: {
    color: COLORS.textPrimary,

    fontSize: 13,
    fontWeight: "400",
  },

  dayChipTextSelected: {
    color: COLORS.white,
  },

  // 드래그 재정렬 리스트(DraggableFlatList)의 헤더로 들어가는 day 탭 줄 아래 여백.
  planTimeline: {
    marginTop: 32, // day 태그 줄과 목록 사이 간격 (px로 직접 조절)
  },

  planTimelineRow: {
    flexDirection: "row",
    gap: SPACING.sm,
  },

  planTimelineIndicator: {
    width: 40,

    alignItems: "center",
  },

  planTimelineDot: {
    width: 22,
    height: 22,

    borderRadius: 11,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: COLORS.primary,
  },

  planTimelineDotText: {
    color: "#FFFFFF",

    fontSize: 10,
    lineHeight: 13,
    fontWeight: "800",
  },

  planTimelineLineArea: {
    flex: 1,
    width: "100%",

    minHeight: 40,

    alignItems: "center",
    justifyContent: "center",
  },

  planTimelineLine: {
    position: "absolute",
    top: 3,
    bottom: 3,

    width: 2,

    backgroundColor: COLORS.routeSoft,
  },

  planDistanceBadge: {
    paddingHorizontal: SPACING.xs,
    paddingVertical: SPACING.xs,

    borderRadius: RADIUS.badge,

    backgroundColor: COLORS.surface,
  },

  planDistanceBadgeText: {
    color: COLORS.textSecondary,

    fontSize: 9,
    lineHeight: 12,
    fontWeight: "700",
  },

  planStopStickerCircle: {
    width: 44,
    height: 44,

    marginRight: SPACING.sm,

    borderRadius: RADIUS.sheet,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: COLORS.primarySoft,
  },

  planStopCard: {
    flex: 1,
    marginBottom: SPACING.sm,

    paddingHorizontal: 13,
    paddingVertical: SPACING.sm,

    borderRadius: RADIUS.banner,

    backgroundColor: '#FBFBFA',
  },

  planStopCardTop: {
    flexDirection: "row",
    alignItems: "center",
  },

  planStopSticker: {
    fontSize: 22,
  },

  planStopTextArea: {
    flex: 1,
  },

  planStopName: {
    color: COLORS.textPrimary,

    fontSize: 14,
    lineHeight: 19,
    fontWeight: "700",
  },

  planStopMeta: {
    marginTop: SPACING.xs,

    color: COLORS.textSecondary,

    fontSize: 11,
    lineHeight: 16,
    fontWeight: "500",
  },

  planStopIconButton: {
    width: 30,
    height: 30,

    alignItems: "center",
    justifyContent: "center",
  },

  planStopMemoBox: {
    marginTop: SPACING.sm,

    paddingHorizontal: 11,
    paddingVertical: SPACING.sm,

    borderRadius: RADIUS.card,

    backgroundColor: COLORS.primarySoft,
  },

  planStopMemoText: {
    color: COLORS.textPrimary,

    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
  },

  planStopMemoEmpty: {
    marginTop: SPACING.sm,

    paddingVertical: SPACING.sm,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.xs,

    borderRadius: RADIUS.card,

    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: "dashed",
  },

  planStopMemoEmptyText: {
    color: COLORS.textTertiary,

    fontSize: 11,
    lineHeight: 15,
    fontWeight: "600",
  },

  planAddRow: {
    flexDirection: "row",
    gap: SPACING.sm,

    marginTop: SPACING.xs,
  },

  planAddButton: {
    flex: 1,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.xs,

    paddingVertical: 11,

    borderRadius: RADIUS.card,

    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: "dashed",
  },

  planAddButtonText: {
    color: COLORS.textSecondary,

    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },

  memoModalBackdrop: {
    flex: 1,

    alignItems: "center",
    justifyContent: "center",

    paddingHorizontal: 28,

    backgroundColor: "rgba(20,20,18,0.45)",
  },

  memoModalCard: {
    width: "100%",

    paddingHorizontal: SPACING.screenH,
    paddingTop: SPACING.screenH,
    paddingBottom: SPACING.md,

    borderRadius: RADIUS.sheet,

    backgroundColor: COLORS.card,
  },

  memoModalTitle: {
    color: COLORS.textPrimary,

    fontSize: 16,
    lineHeight: 22,
    fontWeight: "600",
  },

  memoModalHint: {
    marginTop: SPACING.xs,

    color: COLORS.textSecondary,

    fontSize: 12,
    lineHeight: 17,
    fontWeight: "500",
  },

  memoInput: {
    marginTop: SPACING.md,

    minHeight: 96,

    paddingHorizontal: 13,
    paddingVertical: 11,

    borderRadius: RADIUS.card,

    color: COLORS.textPrimary,

    fontSize: 14,
    lineHeight: 19,
    fontFamily: "Pretendard-Medium",

    textAlignVertical: "top",

    backgroundColor: COLORS.primarySoft,
  },

  memoModalButtonRow: {
    flexDirection: "row",
    gap: SPACING.sm,

    marginTop: SPACING.md,
  },

  memoModalButton: {
    flex: 1,

    alignItems: "center",
    justifyContent: "center",

    paddingVertical: SPACING.sm,

    borderRadius: RADIUS.card,
  },

  memoModalButtonGhost: {
    backgroundColor: COLORS.background,

    borderWidth: 1,
    borderColor: COLORS.border,
  },

  memoModalButtonGhostText: {
    color: COLORS.textSecondary,

    fontSize: 13,
    lineHeight: 17,
    fontWeight: "700",
  },

  memoModalButtonPrimary: {
    backgroundColor: COLORS.primary,
  },

  memoModalButtonPrimaryText: {
    color: "#FFFFFF",

    fontSize: 13,
    lineHeight: 17,
    fontWeight: "800",
  },

  shareModalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  shareBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.28)",
  },
  shareSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: "88%",
    paddingHorizontal: SPACING.screenH,
    paddingTop: SPACING.sm,
  },
  shareHandle: {
    alignSelf: "center",
    backgroundColor: "#D7D7D7",
    borderRadius: 4,
    height: 6,
    marginBottom: SPACING.lg,
    width: 70,
  },
  shareHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  shareHeaderText: {
    flex: 1,
    paddingRight: SPACING.sm,
  },
  shareTitle: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: "700",
  },
  shareDescription: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginTop: SPACING.sm,
  },
  shareScrollContent: {
    paddingBottom: SPACING.xs,
  },
  sharePreviewCard: {
    alignItems: "center",
    backgroundColor: '#FBFBFA',
    borderRadius: 20,
    flexDirection: "row",
    marginTop: SPACING.lg,
    padding: 13,
  },
  shareMapPreview: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.card,
    height: 126,
    overflow: "hidden",
    position: "relative",
    width: 126,
  },
  shareMapRoute: {
    backgroundColor: COLORS.route,
    borderColor: COLORS.routeSoft,
    borderRadius: RADIUS.badge,
    borderWidth: 2,
    height: 9,
    position: "absolute",
  },
  shareMapRouteOne: {
    left: 18,
    top: 46,
    transform: [{ rotate: "25deg" }],
    width: 65,
  },
  shareMapRouteTwo: {
    left: 68,
    top: 74,
    transform: [{ rotate: "51deg" }],
    width: 48,
  },
  shareMapRouteThree: {
    right: 16,
    top: 74,
    transform: [{ rotate: "-58deg" }],
    width: 43,
  },
  shareMapEmoji: {
    fontSize: 23,
    position: "absolute",
  },
  shareMapEmojiOne: {
    left: 10,
    top: 19,
  },
  shareMapEmojiTwo: {
    left: 68,
    top: 52,
  },
  shareMapEmojiThree: {
    bottom: 12,
    right: 14,
  },
  sharePreviewTextArea: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  sharePreviewTitle: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: "700",
  },
  sharePreviewMeta: {
    color: COLORS.textSecondary,
    fontSize: 11,
    lineHeight: 19,
    marginTop: SPACING.xs,
  },
  shareActionList: {
    backgroundColor: '#FBFBFA',
    borderRadius: RADIUS.banner,
    marginTop: SPACING.lg,
    overflow: "hidden",
  },
  shareActionRow: {
    alignItems: "center",
    flexDirection: "row",
    height: 62,
    paddingHorizontal: SPACING.screenH,
  },
  shareActionDivider: {
    borderBottomColor: "#EEEEEE",
    borderBottomWidth: 1,
  },
  shareActionLabel: {
    color: "#555555",
    flex: 1,
    fontSize: 14,
    marginLeft: SPACING.md,
  },
  sharePressed: {
    opacity: 0.6,
  },
  shareActionPressed: {
    backgroundColor: "#F7F7F7",
  },

  // === '일정' 탭 스타일 끝 ===
});
