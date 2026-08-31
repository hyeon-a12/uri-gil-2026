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
import type { RecordingData } from "@/types/recording";
import { useTripStore } from "@/store/useTripStore";
import TravelIllustratedMap from '@/components/TravelIllustratedMap';
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
const STOP_CARD_WIDTH = 286;
const STOP_CARD_GAP = 12;
const STOP_CARD_SNAP_INTERVAL = STOP_CARD_WIDTH + STOP_CARD_GAP;

interface ClipThumbnailProps {
  thumbnail: string;
  duration: string;
}

function ClipThumbnail({ thumbnail, duration }: ClipThumbnailProps) {
  return (
    <Pressable
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
}

function SelectedStopCard({ stop }: SelectedStopCardProps) {
  const sourceLabel =
    stop.source === "manual"
      ? "직접 추가"
      : stop.source === "ai-recommendation"
        ? "AI 추천"
        : stop.time;

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

            <Ionicons name="location" size={15} color={COLORS.primary} />
          </View>

          <Text allowFontScaling={false} style={styles.stopCardMeta}>
            클립 {stop.clips.length}개 · {sourceLabel}
          </Text>
        </View>

        <Pressable
          hitSlop={10}
          onPress={() => {
            Alert.alert(
              stop.name,
              "장소 상세 화면을 연결할 수 있어요.",
            );
          }}
          style={({ pressed }) => [
            styles.stopCardMoreButton,
            pressed && styles.cardPressed,
          ]}
        >
          <Ionicons
            name="chevron-forward"
            size={21}
            color={COLORS.textSecondary}
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
          />
        ))}

        <Pressable
          onPress={() => {
            Alert.alert(
              "클립 추가",
              `${stop.name}에 새로운 클립을 추가할 예정입니다.`,
            );
          }}
          style={({ pressed }) => [
            styles.addClipButton,
            pressed && styles.cardPressed,
          ]}
        >
          <Ionicons name="add" size={28} color={COLORS.textSecondary} />

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

type TravelSavePosterProps = {
  tripName: string;
  tripSummary: string;
  placeCount: number;
  stops: PlanStop[];
};

function TravelSavePoster({
  tripName,
  tripSummary,
  placeCount,
  stops,
}: TravelSavePosterProps) {
  return (
    <View style={styles.savePoster}>
      <View style={styles.savePosterHeader}>
        <Text allowFontScaling={false} style={styles.savePosterTitle}>
          {tripName}에서 남긴 길
        </Text>
        <Text allowFontScaling={false} style={styles.savePosterMeta}>
          {tripSummary} · 장소 {placeCount}곳
        </Text>
      </View>

      <View style={styles.savePosterMap}>
        <TravelIllustratedMap
          stops={stops}
          height={620}
          exportMode
        />
      </View>

      <View style={styles.savePosterFooter}>
        <Text allowFontScaling={false} style={styles.savePosterMessage}>
          {placeCount}개의 장소, 하나의 여행
        </Text>
        <Text allowFontScaling={false} style={styles.savePosterBrand}>
          우리길
        </Text>
      </View>
    </View>
  );
}

type TravelShareSheetProps = {
  visible: boolean;
  tripName: string;
  tripSummary: string;
  placeCount: number;
  stops: PlanStop[];
  bottomInset: number;
  onClose: () => void;
  onNativeShare: () => void;
};

function TravelShareSheet({
  visible,
  tripName,
  tripSummary,
  placeCount,
  stops,
  bottomInset,
  onClose,
  onNativeShare,
}: TravelShareSheetProps) {
  const savePosterRef = useRef<View>(null);
  const [isSavingImage, setIsSavingImage] = useState(false);

  const handleSaveImage = useCallback(async () => {
    if (isSavingImage) return;

    try {
      setIsSavingImage(true);

      const permission = await MediaLibrary.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          '사진 접근 권한이 필요해요',
          '여행 지도를 사진으로 저장하려면 사진 접근 권한을 허용해주세요.',
        );
        return;
      }

      if (!savePosterRef.current) {
        Alert.alert('저장 준비 중이에요', '잠시 후 다시 시도해주세요.');
        return;
      }

      const uri = await captureRef(savePosterRef.current, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });

      await MediaLibrary.saveToLibraryAsync(uri);

      Alert.alert('저장 완료', '여행 지도가 사진에 저장되었습니다.');
    } catch (error) {
      console.error('[TravelShareSheet] 이미지 저장 실패:', error);
      Alert.alert('저장하지 못했어요', '잠시 후 다시 시도해주세요.');
    } finally {
      setIsSavingImage(false);
    }
  }, [isSavingImage]);

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
            <View style={styles.sharePreviewCard}>
              <View pointerEvents="none" style={styles.shareMapPreview}>
                <TravelIllustratedMap
                  stops={stops}
                  height={126}
                  exportMode
                />
              </View>

              <View style={styles.sharePreviewTextArea}>
                <Text numberOfLines={1} style={styles.sharePreviewTitle}>
                  {tripName}
                </Text>
                <Text style={styles.sharePreviewMeta}>
                  {tripSummary} · 장소 {placeCount}곳
                </Text>
                <Text style={styles.sharePreviewMeta}>
                  {placeCount}개의 장소, 하나의 여행
                </Text>

                <Pressable
                  onPress={onNativeShare}
                  style={({ pressed }) => [
                    styles.shareInlineButton,
                    pressed && styles.sharePressed,
                  ]}
                >
                  <Ionicons name="link-outline" size={18} color="#555555" />
                  <Text style={styles.shareInlineButtonText}>
                    공유 링크 보내기
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.shareAppsRow}>
              <ShareAppButton
                label="카카오톡"
                color="#F9DD00"
                icon="chatbubble-ellipses"
                iconColor="#3C2C00"
                onPress={onNativeShare}
              />
              <ShareAppButton
                label="메시지"
                color="#54D965"
                icon="chatbubble"
                iconColor="#FFFFFF"
                onPress={onNativeShare}
              />
              <ShareAppButton
                label="인스타그램"
                color="#D94A87"
                icon="camera"
                iconColor="#FFFFFF"
                onPress={onNativeShare}
              />
              <ShareAppButton
                label="페이스북"
                color="#3779D4"
                icon="logo-facebook"
                iconColor="#FFFFFF"
                onPress={onNativeShare}
              />
              <ShareAppButton
                label="더보기"
                color="#F0F0F0"
                icon="ellipsis-horizontal"
                iconColor="#4E4E4E"
                onPress={onNativeShare}
              />
            </View>

            <View style={styles.shareActionList}>
              <ShareActionRow
                icon="link-outline"
                label="공유 링크 보내기"
                onPress={onNativeShare}
              />
              <ShareActionRow
                icon="qr-code-outline"
                label="QR 코드로 공유"
                onPress={() =>
                  Alert.alert(
                    'QR 코드 공유',
                    'QR 코드 기능을 연결할 수 있습니다.',
                  )
                }
              />
              <ShareActionRow
                icon="download-outline"
                label={isSavingImage ? '이미지 저장 중...' : '이미지로 저장'}
                onPress={handleSaveImage}
                isLast
              />
            </View>
          </ScrollView>

          <View pointerEvents="none" style={styles.hiddenSavePoster}>
            <View ref={savePosterRef} collapsable={false}>
              <TravelSavePoster
                tripName={tripName}
                tripSummary={tripSummary}
                placeCount={placeCount}
                stops={stops}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ShareAppButton({
  label,
  color,
  icon,
  iconColor,
  onPress,
}: {
  label: string;
  color: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  iconColor: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}으로 공유하기`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.shareAppButton,
        pressed && styles.sharePressed,
      ]}
    >
      <View style={[styles.shareAppIcon, { backgroundColor: color }]}>
        <Ionicons name={icon} size={27} color={iconColor} />
      </View>
      <Text numberOfLines={1} style={styles.shareAppLabel}>
        {label}
      </Text>
    </Pressable>
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

  // 지도와 하단 장소 카드를 같은 순서로 사용합니다.
  const sortedMapStops = useMemo(
    () => [...planData.stops].sort((a, b) => a.order - b.order),
    [planData.stops],
  );

  // 지도에서 현재 선택된 장소입니다.
  // 처음에는 1번 장소를 자동 선택하고, 카드 스와이프/마커 탭에 따라 같이 바뀝니다.
  const [selectedMapStopId, setSelectedMapStopId] = useState<string | null>(null);
  const stopCardScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (sortedMapStops.length === 0) {
      setSelectedMapStopId(null);
      return;
    }

    setSelectedMapStopId((current) => {
      const stillExists =
        current !== null && sortedMapStops.some((stop) => stop.id === current);

      if (stillExists) {
        return current;
      }

      return sortedMapStops[0]?.id ?? null;
    });
  }, [sortedMapStops]);

  // 지도 마커를 누르면 아래 카드도 같은 장소로 이동합니다.
  const handleSelectMapStop = useCallback(
    (stopId: string) => {
      setSelectedMapStopId(stopId);

      const index = sortedMapStops.findIndex((stop) => stop.id === stopId);
      if (index < 0) return;

      stopCardScrollRef.current?.scrollTo({
        x: index * STOP_CARD_SNAP_INTERVAL,
        animated: true,
      });
    },
    [sortedMapStops],
  );

  // 아래 카드를 넘기면 지도에서도 같은 장소를 선택합니다.
  const handleStopCardMomentumEnd = useCallback(
    (offsetX: number) => {
      if (sortedMapStops.length === 0) return;

      const rawIndex = Math.round(offsetX / STOP_CARD_SNAP_INTERVAL);
      const index = Math.min(Math.max(rawIndex, 0), sortedMapStops.length - 1);
      const stop = sortedMapStops[index];

      if (stop) {
        setSelectedMapStopId(stop.id);
      }
    },
    [sortedMapStops],
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

  const mapHeight = Math.min(
    Math.max(width * 0.9, 320),
    370,
  );

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
              <TravelIllustratedMap
                stops={sortedMapStops}
                height={mapHeight}
                selectedStopId={selectedMapStopId}
                onSelectStop={handleSelectMapStop}
                onPressLocate={handlePressLocate}
                onPressLayers={() => {
                  Alert.alert(
                    '지도 보기',
                    '지도 표시 옵션을 연결할 수 있어요.',
                  );
                }}
              />
            </View>

            {sortedMapStops.length > 0 ? (
              <ScrollView
                ref={stopCardScrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.stopCardScroll}
                contentContainerStyle={styles.selectedCardWrapper}
                snapToInterval={STOP_CARD_SNAP_INTERVAL}
                snapToAlignment="start"
                decelerationRate="fast"
                onMomentumScrollEnd={(event) => {
                  handleStopCardMomentumEnd(event.nativeEvent.contentOffset.x);
                }}
              >
                {sortedMapStops.map((stop) => {
                  const selected = selectedMapStopId === stop.id;

                  return (
                    <View
                      key={stop.id}
                      style={[
                        styles.stopCardSlide,
                        selected && styles.stopCardSlideSelected,
                      ]}
                    >
                      <SelectedStopCard stop={stop} />
                    </View>
                  );
                })}
              </ScrollView>
            ) : (
              <View style={styles.mapEmptyCard}>
                <View style={styles.mapEmptyIcon}>
                  <Ionicons
                    name="location-outline"
                    size={22}
                    color={COLORS.primary}
                  />
                </View>

                <View style={styles.mapEmptyTextArea}>
                  <Text allowFontScaling={false} style={styles.mapEmptyTitle}>
                    아직 등록된 장소가 없어요
                  </Text>

                  <Text allowFontScaling={false} style={styles.mapEmptyDescription}>
                    장소를 추가하거나 영상을 촬영해보세요.
                  </Text>
                </View>
              </View>
            )}
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
        stops={sortedMapStops}
        bottomInset={insets.bottom}
        onClose={() => setIsShareSheetVisible(false)}
        onNativeShare={handleNativeShare}
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
    position: 'relative',

    paddingTop: 16,

    backgroundColor: COLORS.background,
  },

  mapFrame: {
    position: "relative",
    marginHorizontal: 14,
    overflow: "hidden",
    borderRadius: 28,
    backgroundColor: "#FAF4E9",
    borderWidth: 1,
    borderColor: "#EEE6DB",
    shadowColor: "#3B342E",
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },

  mapControls: {
    position: "absolute",
    right: 14,
    top: 18,
    zIndex: 30,
    elevation: 30,
    gap: 10,
  },

  mapControlButton: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.96)",
    borderWidth: 1,
    borderColor: "rgba(20,20,20,0.06)",
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.12,
    shadowRadius: 7,
    elevation: 5,
  },

  mapControlButtonPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.94 }],
  },

  mapRouteInfo: {
    position: "absolute",
    left: 14,
    top: 18,
    zIndex: 25,
    elevation: 25,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderWidth: 1,
    borderColor: "rgba(20,20,20,0.05)",
    shadowColor: "#332C27",
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.09,
    shadowRadius: 8,

  },

  mapRouteInfoIcon: {
    width: 28,
    height: 28,
    marginRight: 8,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
  },

  mapRouteInfoTitle: {
    color: COLORS.textPrimary,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
  },

  mapRouteInfoSubtitle: {
    marginTop: 1,
    color: COLORS.textSecondary,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "500",
  },

  mapBottomFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 75,
    backgroundColor: "rgba(255,255,255,0.05)",
  },

  stopCardScroll: {
    marginTop: 0,
    zIndex: 40,
    elevation: 10,
  },

  selectedCardWrapper: {
    paddingHorizontal: 20,
    paddingRight: 50,
    gap: STOP_CARD_GAP,
    paddingTop: 16,
  },
  stopCardSlide: {
    width: STOP_CARD_WIDTH,
    opacity: 0.86,
    transform: [{ scale: 0.98 }],
  },

  stopCardSlideSelected: {
    opacity: 1,
    transform: [{ scale: 1 }],
  },

  stopCard: {
    paddingHorizontal: 15,
    paddingTop: 13,
    paddingBottom: 13,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.98)",
    borderWidth: 1,
    borderColor: "rgba(30,30,30,0.04)",
    shadowColor: "#332B25",
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.1,
    shadowRadius: 13,
    elevation: 7,
  },

  stopCardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },

  stopCardOrder: {
    width: 34,
    height: 34,
    borderRadius: 17,
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
    gap: 5,
  },

  stopCardTitle: {
    maxWidth: "82%",
    color: COLORS.textPrimary,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
  },

  stopCardMeta: {
    marginTop: 3,
    color: COLORS.textSecondary,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "500",
  },

  stopCardMoreButton: {
    width: 34,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },

  clipList: {
    paddingTop: 14,
    gap: 8,
  },

  clipThumbnail: {
    position: "relative",
    width: 76,
    height: 62,
    overflow: "hidden",
    borderRadius: 12,
    backgroundColor: "#E8E5DF",
  },

  clipImage: {
    width: "100%",
    height: "100%",
  },

  clipDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(20,20,18,0.08)",
  },

  clipPlayButton: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 25,
    height: 25,
    marginLeft: -12.5,
    marginTop: -12.5,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(25,25,22,0.48)",
  },

  clipDuration: {
    position: "absolute",
    right: 5,
    bottom: 4,
    color: "#FFFFFF",
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "600",
    textShadowColor: "rgba(0,0,0,0.55)",
    textShadowRadius: 3,
  },

  addClipButton: {
    width: 76,
    height: 62,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#FFF6EF",
    borderWidth: 1,
    borderColor: "#F6E8DB",
  },

  addClipText: {
    marginTop: 2,
    color: COLORS.textSecondary,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "700",
  },

  mapEmptyCard: {
    marginHorizontal: 22,
    marginTop: -40,
    zIndex: 40,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    shadowColor: COLORS.shadow,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.09,
    shadowRadius: 12,
    elevation: 8,
  },

  mapEmptyIcon: {
    width: 40,
    height: 40,
    marginRight: 11,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primarySoft,
  },

  mapEmptyTextArea: {
    flex: 1,
  },

  mapEmptyTitle: {
    color: COLORS.textPrimary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },

  mapEmptyDescription: {
    marginTop: 2,
    color: COLORS.textSecondary,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "500",
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
  shareInlineButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderColor: "#E3E3E3",
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    gap: SPACING.sm,
    marginTop: SPACING.sm,
    paddingHorizontal: 13,
    paddingVertical: SPACING.sm,
  },
  shareInlineButtonText: {
    color: "#555555",
    fontSize: 13,
    fontWeight: "700",
  },
  shareAppsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: SPACING.lg,
    marginTop: 28,
  },
  shareAppButton: {
    alignItems: "center",
    width: 59,
  },
  shareAppIcon: {
    alignItems: "center",
    borderRadius: RADIUS.banner,
    height: 55,
    justifyContent: "center",
    width: 55,
  },
  shareAppLabel: {
    color: "#5C5C5C",
    fontSize: 11,
    marginTop: SPACING.sm,
  },
  shareActionList: {
    backgroundColor: '#FBFBFA',
    borderRadius: RADIUS.banner,
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

  hiddenSavePoster: {
    position: 'absolute',
    left: -1400,
    top: 0,
    width: 1080,
  },

  savePoster: {
    width: 1080,
    paddingTop: 96,
    paddingHorizontal: 72,
    paddingBottom: 72,
    backgroundColor: '#FFFFFF',
  },

  savePosterHeader: {
    marginBottom: 38,
  },

  savePosterTitle: {
    color: COLORS.textPrimary,
    fontSize: 52,
    lineHeight: 66,
    fontWeight: '800',
    letterSpacing: -1.2,
  },

  savePosterMeta: {
    marginTop: 12,
    color: COLORS.textSecondary,
    fontSize: 28,
    lineHeight: 38,
    fontWeight: '600',
  },

  savePosterMap: {
    overflow: 'hidden',
    borderRadius: 42,
  },

  savePosterFooter: {
    marginTop: 38,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },

  savePosterMessage: {
    color: COLORS.textPrimary,
    fontSize: 30,
    lineHeight: 42,
    fontWeight: '700',
  },

  savePosterBrand: {
    color: COLORS.primary,
    fontSize: 27,
    lineHeight: 34,
    fontWeight: '800',
  },

  // === '일정' 탭 스타일 끝 ===
});