import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  parseDateRange,
  type FolderItem,
} from '@/services/folderService';
import { getRecordingsByFolder } from '@/services/recordingService';
import type { RecordingData } from '@/types/recording';
import { useTripStore } from '@/store/useTripStore';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { AppText as Text } from '@/components/AppText';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Circle,
  Path,
} from 'react-native-svg';

const COLORS = {
  background: '#FFFFFF',
  card: '#FFFFFF',

  primary: '#FF7F5C',
  primaryDark: '#E97B1F',
  primarySoft: '#FFF3DF',

  textPrimary: '#222222',
  textSecondary: '#8A8A8A',
  textTertiary: '#8A8A8A',

  border: '#DDDDDD',
  divider: '#DDDDDD',

  route: '#F6784D',
  routeSoft: '#FFD2C2',

  mapBlue: '#DDF3F2',
  mapGreen: '#E6F2D8',
  mapCream: '#F7F0DA',

  shadow: '#443A31',
};

// 사용자 흐름을 단순화해 '일정'과 '지도' 두 가지 보기만 제공합니다.
type RouteViewMode = 'info' | 'map';

interface RouteStop {
  id: string;
  order: number;
  name: string;
  shortName: string;
  sticker: string;

  day: number; // 몇 박 몇 일 중 몇 일차 방문인지

  x: number;
  y: number;

  clipCount: number;
  time: string;

  distanceToNext?: string; // 같은 day 안에서 다음 장소까지의 이동 거리 표시용

  clips: {
    id: string;
    thumbnail: string;
    duration: string;
  }[];
}

const ROUTE_STOPS: RouteStop[] = [
  {
    id: 'stop-1',
    order: 1,
    name: '협재해변',
    shortName: '협재해변',
    sticker: '🏖️',

    day: 1,

    x: 18,
    y: 25,

    clipCount: 2,
    time: '14:35',

    distanceToNext: '1.2km',

    clips: [
      {
        id: 'clip-1',
        thumbnail:
          'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600',
        duration: '00:08',
      },
      {
        id: 'clip-2',
        thumbnail:
          'https://images.unsplash.com/photo-1500534623283-312aade485b7?w=600',
        duration: '00:05',
      },
    ],
  },
  {
    id: 'stop-2',
    order: 2,
    name: '카페 이연',
    shortName: '카페 이연',
    sticker: '☕',

    day: 1,

    x: 51,
    y: 46,

    clipCount: 3,
    time: '16:10',

    clips: [
      {
        id: 'clip-3',
        thumbnail:
          'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600',
        duration: '00:12',
      },
      {
        id: 'clip-4',
        thumbnail:
          'https://images.unsplash.com/photo-1445116572660-236099ec97a0?w=600',
        duration: '00:07',
      },
    ],
  },
  {
    id: 'stop-3',
    order: 3,
    name: '모슬포항',
    shortName: '모슬포항',
    sticker: '⛵',

    day: 2,

    x: 74,
    y: 67,

    clipCount: 1,
    time: '18:20',

    clips: [
      {
        id: 'clip-5',
        thumbnail:
          'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
        duration: '00:09',
      },
    ],
  },
  {
    id: 'stop-4',
    order: 4,
    name: '동문시장',
    shortName: '동문시장',
    sticker: '🍜',

    day: 3,

    x: 86,
    y: 40,

    clipCount: 4,
    time: '19:40',

    clips: [
      {
        id: 'clip-6',
        thumbnail:
          'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600',
        duration: '00:11',
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────
// '일정' 탭(RoutePlanView) 전용 실데이터.
//
// 앱에 아직 "핑/경로 계획" 저장 모델이 없어서(위 ROUTE_STOPS는 지도 탭용
// 목데이터), 실제로 트립별로 저장돼 있는 건 recordingService의 클립뿐입니다.
// 그래서 '일정' 탭은 클립을 장소명 기준으로 묶어서 타임라인을 만듭니다 —
// '지도' 탭은 당분간 위 목데이터를 그대로 씁니다.
// ─────────────────────────────────────────────────────────────

interface PlanStop {
  id: string;
  order: number;
  name: string;
  day: number;
  time: string;
  clips: {
    id: string;
    thumbnail: string;
    duration: string;
  }[];
}

interface PlanTravelLog {
  id: string;
  day: number;
  time: string;
  thumbnail: string;
}

function formatClipDuration(durationMs?: number): string {
  const totalSeconds = Math.floor((durationMs ?? 0) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatClipTime(recordedAt: string): string {
  const date = new Date(recordedAt);
  return `${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes(),
  ).padStart(2, '0')}`;
}

/** 여행 시작일 기준 며칠째인지 (1부터 시작). 기간을 못 읽으면 항상 1일차로 취급. */
function dayIndexOf(recordedAt: string, tripStart: Date | null): number {
  if (!tripStart) return 1;
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const recordedDate = new Date(recordedAt);
  const diff = Math.floor(
    (new Date(
      recordedDate.getFullYear(),
      recordedDate.getMonth(),
      recordedDate.getDate(),
    ).getTime() -
      new Date(
        tripStart.getFullYear(),
        tripStart.getMonth(),
        tripStart.getDate(),
      ).getTime()) /
      MS_PER_DAY,
  );
  return Math.max(1, diff + 1);
}

/**
 * 클립을 "같은 날 + 같은 장소명"끼리 묶어 일정 타임라인용 스톱으로 만듭니다.
 * 장소명이 없는 클립(placeName 미입력)은 스톱으로 묶지 않고 '이동 중 기록'으로 뺍니다.
 */
function buildPlanData(
  recordings: RecordingData[],
  trip: FolderItem | null,
): { stops: PlanStop[]; travelLogs: PlanTravelLog[]; dayNumbers: number[] } {
  const tripStart = trip ? parseDateRange(trip.dateRange)?.start ?? null : null;

  const sorted = [...recordings].sort((a, b) =>
    a.recordedAt.localeCompare(b.recordedAt),
  );

  const stopOrder: string[] = []; // 그룹 키의 최초 등장 순서
  const stopGroups = new Map<string, PlanStop>();
  const travelLogs: PlanTravelLog[] = [];

  for (const recording of sorted) {
    const day = dayIndexOf(recording.recordedAt, tripStart);
    const placeName = recording.location.placeName?.trim();

    const clip = {
      id: recording.id,
      thumbnail: recording.thumbnail,
      duration: formatClipDuration(recording.durationMs),
    };

    if (!placeName) {
      travelLogs.push({
        id: recording.id,
        day,
        time: formatClipTime(recording.recordedAt),
        thumbnail: recording.thumbnail,
      });
      continue;
    }

    const groupKey = `${day}::${placeName}`;
    const existing = stopGroups.get(groupKey);
    if (existing) {
      existing.clips.push(clip);
      continue;
    }

    stopOrder.push(groupKey);
    stopGroups.set(groupKey, {
      id: groupKey,
      order: stopOrder.length,
      name: placeName,
      day,
      time: formatClipTime(recording.recordedAt),
      clips: [clip],
    });
  }

  const stops = stopOrder.map((key) => stopGroups.get(key)!);
  const dayNumbers = Array.from(
    new Set([...stops.map((s) => s.day), ...travelLogs.map((l) => l.day)]),
  ).sort((a, b) => a - b);

  return { stops, travelLogs, dayNumbers };
}

function MapDecoration() {
  return (
    <>
      <View style={[styles.mapIsland, styles.mapIslandOne]} />
      <View style={[styles.mapIsland, styles.mapIslandTwo]} />
      <View style={[styles.mapIsland, styles.mapIslandThree]} />

      <Text style={[styles.mapDecoration, styles.treeOne]}>
        🌲
      </Text>

      <Text style={[styles.mapDecoration, styles.treeTwo]}>
        🌴
      </Text>

      <Text style={[styles.mapDecoration, styles.treeThree]}>
        🌳
      </Text>

      <Text style={[styles.mapDecoration, styles.flower]}>
        🌼
      </Text>

      <View style={[styles.road, styles.roadOne]} />
      <View style={[styles.road, styles.roadTwo]} />
      <View style={[styles.road, styles.roadThree]} />
      <View style={[styles.road, styles.roadFour]} />
    </>
  );
}

interface RouteMapProps {
  selectedStopId: string;
  onSelectStop: (stopId: string) => void;
}

function RouteMap({
  selectedStopId,
  onSelectStop,
}: RouteMapProps) {
  return (
    <View style={styles.map}>
      <MapDecoration />

      <Svg
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <Path
          d="M18 25 C29 31 36 40 51 46 C60 52 66 63 74 67 C78 60 82 49 86 40"
          stroke={COLORS.routeSoft}
          strokeWidth={3.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        <Path
          d="M18 25 C29 31 36 40 51 46 C60 52 66 63 74 67 C78 60 82 49 86 40"
          stroke={COLORS.route}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {ROUTE_STOPS.map((stop) => (
          <Circle
            key={stop.id}
            cx={stop.x}
            cy={stop.y}
            r={1.7}
            fill={COLORS.route}
            stroke="#FFFFFF"
            strokeWidth={0.8}
          />
        ))}
      </Svg>

      {ROUTE_STOPS.map((stop) => {
        const selected = selectedStopId === stop.id;

        return (
          <Pressable
            key={stop.id}
            onPress={() => onSelectStop(stop.id)}
            style={[
              styles.stopContainer,
              {
                left: `${stop.x}%`,
                top: `${stop.y}%`,
              },
            ]}
          >
            <View
              style={[
                styles.orderBadge,
                selected && styles.orderBadgeSelected,
              ]}
            >
              <Text
                allowFontScaling={false}
                style={styles.orderBadgeText}
              >
                {stop.order}
              </Text>
            </View>

            <View
              style={[
                styles.stickerContainer,
                selected && styles.stickerContainerSelected,
              ]}
            >
              <Text style={styles.sticker}>
                {stop.sticker}
              </Text>
            </View>

            <View
              style={[
                styles.stopLabel,
                selected && styles.stopLabelSelected,
              ]}
            >
              <Text
                numberOfLines={1}
                allowFontScaling={false}
                style={[
                  styles.stopLabelText,
                  selected && styles.stopLabelTextSelected,
                ]}
              >
                {stop.shortName}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function MapControlButtons() {
  return (
    <View style={styles.mapControls}>
      <Pressable
        onPress={() => {
          Alert.alert(
            '지도 보기',
            '지도 유형 선택 기능을 연결할 예정입니다.',
          );
        }}
        style={({ pressed }) => [
          styles.mapControlButton,
          pressed && styles.mapControlButtonPressed,
        ]}
      >
        <Ionicons
          name="layers-outline"
          size={23}
          color={COLORS.textPrimary}
        />
      </Pressable>

      <Pressable
        onPress={() => {
          Alert.alert(
            '현재 위치',
            '현재 위치로 지도를 이동할 예정입니다.',
          );
        }}
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
}

function ClipThumbnail({
  thumbnail,
  duration,
}: ClipThumbnailProps) {
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
        <Ionicons
          name="play"
          size={14}
          color="#FFFFFF"
        />
      </View>

      <Text
        allowFontScaling={false}
        style={styles.clipDuration}
      >
        {duration}
      </Text>
    </Pressable>
  );
}

interface SelectedStopCardProps {
  stop: RouteStop;
}

function SelectedStopCard({
  stop,
}: SelectedStopCardProps) {
  return (
    <View style={styles.stopCard}>
      <View style={styles.stopCardHeader}>
        <View style={styles.stopCardOrder}>
          <Text
            allowFontScaling={false}
            style={styles.stopCardOrderText}
          >
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

            <Text style={styles.stopCardSticker}>
              {stop.sticker}
            </Text>
          </View>

          <Text
            allowFontScaling={false}
            style={styles.stopCardMeta}
          >
            클립 {stop.clipCount}개 · {stop.time}
          </Text>
        </View>

        <Pressable
          hitSlop={10}
          onPress={() => {
            Alert.alert(
              stop.name,
              '장소 상세 정보 화면으로 연결할 예정입니다.',
            );
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
          />
        ))}

        <Pressable
          onPress={() => {
            Alert.alert(
              '클립 추가',
              `${stop.name}에 새 클립을 추가할 예정입니다.`,
            );
          }}
          style={({ pressed }) => [
            styles.addClipButton,
            pressed && styles.cardPressed,
          ]}
        >
          <Ionicons
            name="add"
            size={29}
            color={COLORS.textSecondary}
          />

          <Text
            allowFontScaling={false}
            style={styles.addClipText}
          >
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
    icon: React.ComponentProps<typeof Ionicons>['name'];
    activeIcon: React.ComponentProps<typeof Ionicons>['name'];
  }[] = [
    {
      mode: 'info',
      label: '일정',
      icon: 'calendar-outline',
      activeIcon: 'calendar',
    },
    {
      mode: 'map',
      label: '지도',
      icon: 'map-outline',
      activeIcon: 'map',
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
              color={
                selected
                  ? COLORS.primary
                  : COLORS.textSecondary
              }
            />

            <Text
              numberOfLines={1}
              allowFontScaling={false}
              style={[
                styles.internalNavigationLabel,
                selected &&
                  styles.internalNavigationLabelSelected,
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

interface MemoEditorModalProps {
  visible: boolean;
  stopName: string | null;
  draft: string;
  onChangeDraft: (text: string) => void;
  onSave: () => void;
  onClose: () => void;
}

// 장소에 남기는 메모(좋았던 점, 먹은 음식 등)를 쓰고 수정하는 모달
function MemoEditorModal({
  visible,
  stopName,
  draft,
  onChangeDraft,
  onSave,
  onClose,
}: MemoEditorModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.memoModalBackdrop}>
        <View style={styles.memoModalCard}>
          <Text
            allowFontScaling={false}
            style={styles.memoModalTitle}
          >
            {stopName ?? ''} 메모
          </Text>

          <Text
            allowFontScaling={false}
            style={styles.memoModalHint}
          >
            좋았던 점, 먹은 음식처럼 남기고 싶은 걸 적어보세요.
          </Text>

          <TextInput
            value={draft}
            onChangeText={onChangeDraft}
            placeholder="예: 노을이 예뻤고, 옆 포차에서 먹은 딱새우회가 최고였다."
            placeholderTextColor={COLORS.textTertiary}
            multiline
            autoFocus
            style={styles.memoInput}
          />

          <View style={styles.memoModalButtonRow}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.memoModalButton,
                styles.memoModalButtonGhost,
                pressed && styles.cardPressed,
              ]}
            >
              <Text
                allowFontScaling={false}
                style={styles.memoModalButtonGhostText}
              >
                취소
              </Text>
            </Pressable>

            <Pressable
              onPress={onSave}
              style={({ pressed }) => [
                styles.memoModalButton,
                styles.memoModalButtonPrimary,
                pressed && styles.cardPressed,
              ]}
            >
              <Text
                allowFontScaling={false}
                style={styles.memoModalButtonPrimaryText}
              >
                저장
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

type RoutePlanViewProps = {
  hasTrip: boolean;
  stops: PlanStop[];
  travelLogs: PlanTravelLog[];
  dayNumbers: number[];
};

// '루트 정보' 탭 대신 들어가는 새 화면: day별 일정 타임라인 + 장소별 메모 + 이동 중 기록
//
// stops/travelLogs/dayNumbers는 활성 여행의 실제 클립(recordingService)에서
// 파생된 데이터입니다(부모인 MyRouteScreen이 buildPlanData()로 만들어 내려줌).
// 메모는 아직 별도 저장소가 없어서 이전과 동일하게 화면 안에서만 유지됩니다.
function RoutePlanView({ hasTrip, stops, travelLogs, dayNumbers }: RoutePlanViewProps) {
  const [selectedDay, setSelectedDay] = useState(dayNumbers[0] ?? 1);

  const [stopMemos, setStopMemos] = useState<Record<string, string>>({});

  const [memoModalVisible, setMemoModalVisible] = useState(false);
  const [activeStopId, setActiveStopId] = useState<string | null>(null);
  const [memoDraft, setMemoDraft] = useState('');

  // 여행을 전환해서 날짜 목록 자체가 바뀌면, 이전 여행의 day 선택이 남아있지
  // 않도록 첫 번째 날로 되돌립니다.
  useEffect(() => {
    if (!dayNumbers.includes(selectedDay)) {
      setSelectedDay(dayNumbers[0] ?? 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayNumbers]);

  const dayStops = useMemo(
    () =>
      stops
        .filter((stop) => stop.day === selectedDay)
        .sort((a, b) => a.order - b.order),
    [stops, selectedDay],
  );

  const dayLogs = useMemo(
    () => travelLogs.filter((log) => log.day === selectedDay),
    [travelLogs, selectedDay],
  );

  const activeStop = useMemo(
    () => stops.find((stop) => stop.id === activeStopId) ?? null,
    [stops, activeStopId],
  );

  const openMemoEditor = (stop: PlanStop) => {
    setActiveStopId(stop.id);
    setMemoDraft(stopMemos[stop.id] ?? '');
    setMemoModalVisible(true);
  };

  const closeMemoEditor = () => {
    setMemoModalVisible(false);
  };

  const saveMemo = () => {
    if (activeStopId) {
      const trimmed = memoDraft.trim();

      setStopMemos((prev) => {
        const next = { ...prev };

        if (trimmed.length > 0) {
          next[activeStopId] = trimmed;
        } else {
          delete next[activeStopId];
        }

        return next;
      });
    }

    setMemoModalVisible(false);
  };

  if (!hasTrip) {
    return (
      <View style={styles.planEmptyState}>
        <Ionicons name="airplane-outline" size={32} color={COLORS.textTertiary} />
        <Text allowFontScaling={false} style={styles.planEmptyTitle}>
          선택된 여행이 없어요
        </Text>
        <Text allowFontScaling={false} style={styles.planEmptyDescription}>
          홈 화면 상단에서 여행을 선택하거나 새로 만들어주세요.
        </Text>
      </View>
    );
  }

  if (stops.length === 0 && travelLogs.length === 0) {
    return (
      <View style={styles.planEmptyState}>
        <Ionicons name="videocam-outline" size={32} color={COLORS.textTertiary} />
        <Text allowFontScaling={false} style={styles.planEmptyTitle}>
          아직 촬영한 클립이 없어요
        </Text>
        <Text allowFontScaling={false} style={styles.planEmptyDescription}>
          카메라로 이 여행의 첫 순간을 기록해보세요.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.planScreen}>
      <ScrollView
        style={styles.alternativeView}
        contentContainerStyle={styles.planContent}
        showsVerticalScrollIndicator={false}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dayChipRow}
        >
          {dayNumbers.map((day) => {
            const selected = day === selectedDay;

            return (
              <Pressable
                key={day}
                onPress={() => setSelectedDay(day)}
                style={[
                  styles.dayChip,
                  selected && styles.dayChipSelected,
                ]}
              >
                <Text
                  allowFontScaling={false}
                  style={[
                    styles.dayChipText,
                    selected && styles.dayChipTextSelected,
                  ]}
                >
                  Day {day}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.planTimeline}>
          {dayStops.map((stop, index) => {
            const memo = stopMemos[stop.id];

            return (
              <View key={stop.id} style={styles.planTimelineRow}>
                <View style={styles.planTimelineIndicator}>
                  <View style={styles.planTimelineDot}>
                    <Text
                      allowFontScaling={false}
                      style={styles.planTimelineDotText}
                    >
                      {stop.order}
                    </Text>
                  </View>

                  {index < dayStops.length - 1 ? (
                    <View style={styles.planTimelineLineArea}>
                      <View style={styles.planTimelineLine} />
                    </View>
                  ) : null}
                </View>

                <View style={styles.planStopCard}>
                  <View style={styles.planStopCardTop}>
                    <View style={styles.planStopStickerCircle}>
                      <Ionicons
                        name="location"
                        size={18}
                        color={COLORS.primary}
                      />
                    </View>

                    <View style={styles.planStopTextArea}>
                      <Text
                        numberOfLines={1}
                        allowFontScaling={false}
                        style={styles.planStopName}
                      >
                        {stop.name}
                      </Text>

                      <Text
                        allowFontScaling={false}
                        style={styles.planStopMeta}
                      >
                        {stop.time} · 클립 {stop.clips.length}개
                      </Text>
                    </View>

                    <Pressable
                      hitSlop={8}
                      onPress={() => openMemoEditor(stop)}
                      style={styles.planStopIconButton}
                    >
                      <Ionicons
                        name={memo ? 'chatbubble' : 'chatbubble-outline'}
                        size={16}
                        color={
                          memo ? COLORS.primary : COLORS.textSecondary
                        }
                      />
                    </Pressable>

                    <Pressable
                      hitSlop={8}
                      onPress={() => {
                        Alert.alert(
                          stop.name,
                          '장소 상세 정보 화면으로 연결할 예정입니다.',
                        );
                      }}
                      style={styles.planStopIconButton}
                    >
                      <Ionicons
                        name="chevron-forward"
                        size={18}
                        color={COLORS.textTertiary}
                      />
                    </Pressable>
                  </View>

                  {memo ? (
                    <Pressable
                      onPress={() => openMemoEditor(stop)}
                      style={({ pressed }) => [
                        styles.planStopMemoBox,
                        pressed && styles.cardPressed,
                      ]}
                    >
                      <Text
                        numberOfLines={3}
                        allowFontScaling={false}
                        style={styles.planStopMemoText}
                      >
                        {memo}
                      </Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={() => openMemoEditor(stop)}
                      style={({ pressed }) => [
                        styles.planStopMemoEmpty,
                        pressed && styles.cardPressed,
                      ]}
                    >
                      <Ionicons
                        name="add"
                        size={13}
                        color={COLORS.textTertiary}
                      />

                      <Text
                        allowFontScaling={false}
                        style={styles.planStopMemoEmptyText}
                      >
                        메모 남기기
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })}

          <View style={styles.planAddRow}>
            <Pressable
              onPress={() => {
                Alert.alert(
                  '장소 추가',
                  `Day ${selectedDay}에 새 장소를 추가할 예정입니다.`,
                );
              }}
              style={({ pressed }) => [
                styles.planAddButton,
                pressed && styles.cardPressed,
              ]}
            >
              <Ionicons
                name="add"
                size={16}
                color={COLORS.textSecondary}
              />

              <Text
                allowFontScaling={false}
                style={styles.planAddButtonText}
              >
                장소 추가
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.travelLogSection}>
          <View style={styles.travelLogHeader}>
            <Text
              allowFontScaling={false}
              style={styles.travelLogTitle}
            >
              이동 중 기록
            </Text>

            <Text
              allowFontScaling={false}
              style={styles.travelLogSubtitle}
            >
              여행하며 바로 남기기
            </Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.travelLogList}
          >
            {dayLogs.map((log) => (
              <Pressable
                key={log.id}
                onPress={() => {
                  Alert.alert(
                    '미분류 기록',
                    '촬영 시 장소를 입력하지 않은 클립이에요. 눌러서 장소로 등록할 수 있습니다.',
                  );
                }}
                style={styles.travelLogItem}
              >
                <View style={styles.travelLogThumbWrapper}>
                  <Image
                    source={{ uri: log.thumbnail }}
                    style={styles.travelLogThumb}
                    contentFit="cover"
                    transition={150}
                  />

                  <View style={[styles.travelLogBadge, styles.travelLogBadgeUnmatched]}>
                    <Ionicons
                      name="location-outline"
                      size={9}
                      color={COLORS.textSecondary}
                    />
                  </View>
                </View>

                <Text
                  numberOfLines={1}
                  allowFontScaling={false}
                  style={styles.travelLogTime}
                >
                  미분류 · {log.time}
                </Text>
              </Pressable>
            ))}

            <Pressable
              onPress={() => {
                Alert.alert(
                  '기록 추가',
                  '카메라를 열어 새 기록을 남길 예정입니다.',
                );
              }}
              style={({ pressed }) => [
                styles.travelLogAddButton,
                pressed && styles.cardPressed,
              ]}
            >
              <Ionicons
                name="add"
                size={22}
                color={COLORS.textSecondary}
              />
            </Pressable>
          </ScrollView>
        </View>
      </ScrollView>

      <Pressable
        onPress={() => {
          Alert.alert(
            '기록하기',
            '카메라를 열어 새 기록을 남길 예정입니다.',
          );
        }}
        style={({ pressed }) => [
          styles.travelLogFab,
          pressed && styles.cardPressed,
        ]}
      >
        <Ionicons
          name="camera"
          size={24}
          color="#FFFFFF"
        />
      </Pressable>

      <MemoEditorModal
        visible={memoModalVisible}
        stopName={activeStop?.name ?? null}
        draft={memoDraft}
        onChangeDraft={setMemoDraft}
        onSave={saveMemo}
        onClose={closeMemoEditor}
      />
    </View>
  );
}

function getTripDisplayName(trip: FolderItem | null): string {
  if (!trip) {
    return '여행 선택';
  }

  // FolderItem의 실제 이름 필드가 프로젝트마다 다를 수 있어
  // 흔히 쓰는 필드명을 순서대로 확인합니다.
  const candidate = trip as FolderItem & Record<string, unknown>;
  const displayName =
    candidate.name ??
    candidate.title ??
    candidate.folderName ??
    candidate.tripName;

  return typeof displayName === 'string' && displayName.trim().length > 0
    ? displayName
    : `여행 ${trip.id}`;
}

export default function MyRouteScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  // 전환 UI는 홈 화면에만 있습니다 — 이 화면은 useTripStore의 currentTrip을
  // 구독만 하고, 그 값이 바뀌면(홈에서 전환) 아래 클립 데이터를 다시 불러옵니다.
  const currentTrip = useTripStore((state) => state.currentTrip);

  const [recordings, setRecordings] = useState<RecordingData[]>([]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      (async () => {
        if (!currentTrip) {
          if (isActive) setRecordings([]);
          return;
        }

        try {
          const records = await getRecordingsByFolder(currentTrip.id);
          if (isActive) setRecordings(records);
        } catch (error) {
          console.error('[MyRouteScreen] 클립을 불러오지 못했습니다.', error);
          if (isActive) setRecordings([]);
        }
      })();

      return () => {
        isActive = false;
      };
    }, [currentTrip?.id]),
  );

  const planData = useMemo(
    () => buildPlanData(recordings, currentTrip),
    [recordings, currentTrip],
  );

  const nights = useMemo(() => {
    if (!currentTrip) return null;
    const range = parseDateRange(currentTrip.dateRange);
    if (!range) return null;
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    return Math.round((range.end.getTime() - range.start.getTime()) / MS_PER_DAY);
  }, [currentTrip]);

  const [selectedMode, setSelectedMode] =
    useState<RouteViewMode>('info');

  const [selectedStopId, setSelectedStopId] =
    useState(ROUTE_STOPS[0].id);

  const selectedStop = useMemo(
    () =>
      ROUTE_STOPS.find(
        (stop) => stop.id === selectedStopId,
      ) ?? ROUTE_STOPS[0],
    [selectedStopId],
  );

  const mapHeight = Math.min(
    Math.max(width * 1.05, 430),
    570,
  );

  const handleSelectStop = (stopId: string) => {
    setSelectedStopId(stopId);
  };

  return (
    <View style={styles.screen}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 8,
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
              ? `${nights !== null ? `${nights}박 ${nights + 1}일 · ` : ''}장소 ${planData.stops.length}곳`
              : '여행을 선택해주세요'}
          </Text>
        </View>

        <Pressable
          hitSlop={12}
          onPress={() => {
            Alert.alert(
              '여행 공유',
              '여행 경로 공유 기능을 연결할 예정입니다.',
            );
          }}
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
      </View>

      <View style={styles.content}>
        {selectedMode === 'map' ? (
          <ScrollView
            style={styles.mapScreen}
            contentContainerStyle={styles.mapScreenContent}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={[
                styles.mapFrame,
                {
                  height: mapHeight,
                },
              ]}
            >
              <RouteMap
                selectedStopId={selectedStopId}
                onSelectStop={handleSelectStop}
              />

              <MapControlButtons />
            </View>

            <View style={styles.selectedCardWrapper}>
              <SelectedStopCard stop={selectedStop} />
            </View>
          </ScrollView>
        ) : (
          <RoutePlanView
            hasTrip={!!currentTrip}
            stops={planData.stops}
            travelLogs={planData.travelLogs}
            dayNumbers={planData.dayNumbers}
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  header: {
    minHeight: 94,

    paddingHorizontal: 14,
    paddingBottom: 12,

    flexDirection: 'row',
    alignItems: 'flex-end',

    backgroundColor: COLORS.background,
  },

  headerButton: {
    width: 46,
    height: 46,

    borderRadius: 23,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: COLORS.card,

    borderWidth: 1,
    borderColor: COLORS.border,
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

    alignItems: 'center',
    justifyContent: 'center',
  },

  headerTripTitleRow: {
    maxWidth: '100%',

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',

    gap: 4,
  },

  headerTitle: {
    color: COLORS.textPrimary,

    fontSize: 19,
    lineHeight: 25,
    fontWeight: '800',

    letterSpacing: -0.5,
  },

  headerSubtitle: {
    marginTop: 2,

    color: COLORS.textSecondary,

    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
  },

  content: {
    flex: 1,
  },

  mapScreen: {
    flex: 1,
  },

  mapScreenContent: {
    paddingBottom: 190,
  },

  mapFrame: {
    marginHorizontal: 14,

    overflow: 'hidden',

    borderRadius: 28,

    backgroundColor: COLORS.mapBlue,

    borderWidth: 1,
    borderColor: '#D6E8E0',

    shadowColor: COLORS.shadow,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.08,
    shadowRadius: 13,

    elevation: 3,
  },

  map: {
    flex: 1,
    position: 'relative',

    overflow: 'hidden',

    backgroundColor: COLORS.mapBlue,
  },

  mapIsland: {
    position: 'absolute',

    backgroundColor: COLORS.mapCream,

    opacity: 0.86,

    transform: [{ rotate: '-8deg' }],
  },

  mapIslandOne: {
    width: '92%',
    height: '74%',

    left: '4%',
    top: '9%',

    borderTopLeftRadius: 120,
    borderTopRightRadius: 90,
    borderBottomLeftRadius: 100,
    borderBottomRightRadius: 130,
  },

  mapIslandTwo: {
    width: 160,
    height: 120,

    left: -38,
    bottom: 28,

    borderRadius: 70,

    backgroundColor: COLORS.mapGreen,
    opacity: 0.55,
  },

  mapIslandThree: {
    width: 170,
    height: 140,

    right: -45,
    top: 22,

    borderRadius: 80,

    backgroundColor: COLORS.mapGreen,
    opacity: 0.52,
  },

  road: {
    position: 'absolute',

    height: 2,

    borderRadius: 1,

    backgroundColor: 'rgba(255,255,255,0.82)',
  },

  roadOne: {
    width: '70%',
    left: '12%',
    top: '23%',

    transform: [{ rotate: '-18deg' }],
  },

  roadTwo: {
    width: '62%',
    left: '20%',
    top: '55%',

    transform: [{ rotate: '14deg' }],
  },

  roadThree: {
    width: '52%',
    left: '6%',
    top: '73%',

    transform: [{ rotate: '-26deg' }],
  },

  roadFour: {
    width: '45%',
    right: '5%',
    top: '38%',

    transform: [{ rotate: '70deg' }],
  },

  mapDecoration: {
    position: 'absolute',
    zIndex: 2,

    fontSize: 27,
    opacity: 0.48,
  },

  treeOne: {
    left: '12%',
    top: '60%',
  },

  treeTwo: {
    left: '31%',
    top: '75%',
  },

  treeThree: {
    right: '16%',
    top: '18%',
  },

  flower: {
    right: 9,
    bottom: 14,

    fontSize: 22,
    opacity: 0.72,
  },

  stopContainer: {
    position: 'absolute',
    zIndex: 8,

    alignItems: 'center',

    transform: [
      { translateX: -35 },
      { translateY: -35 },
    ],
  },

  orderBadge: {
    position: 'absolute',
    top: -7,
    left: -4,
    zIndex: 10,

    width: 25,
    height: 25,

    borderRadius: 13,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: COLORS.primary,

    borderWidth: 3,
    borderColor: '#FFFFFF',
  },

  orderBadgeSelected: {
    transform: [{ scale: 1.12 }],
  },

  orderBadgeText: {
    color: '#FFFFFF',

    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
  },

  stickerContainer: {
    width: 58,
    height: 58,

    borderRadius: 29,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: 'rgba(255,255,255,0.90)',

    borderWidth: 2,
    borderColor: '#FFFFFF',

    shadowColor: COLORS.shadow,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.14,
    shadowRadius: 7,

    elevation: 4,
  },

  stickerContainerSelected: {
    width: 64,
    height: 64,

    borderRadius: 32,

    borderWidth: 3,
    borderColor: COLORS.primary,

    transform: [{ scale: 1.04 }],
  },

  sticker: {
    fontSize: 32,
  },

  stopLabel: {
    maxWidth: 92,

    marginTop: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,

    borderRadius: 9,

    backgroundColor: 'rgba(255,255,255,0.78)',
  },

  stopLabelSelected: {
    backgroundColor: COLORS.card,
  },

  stopLabelText: {
    color: COLORS.textSecondary,

    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
  },

  stopLabelTextSelected: {
    color: COLORS.textPrimary,
    fontWeight: '800',
  },

  mapControls: {
    position: 'absolute',
    right: 14,
    top: 104,
    zIndex: 20,

    gap: 10,
  },

  mapControlButton: {
    width: 46,
    height: 46,

    borderRadius: 23,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: 'rgba(255,255,255,0.93)',

    borderWidth: 1,
    borderColor: COLORS.border,

    shadowColor: COLORS.shadow,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.1,
    shadowRadius: 6,

    elevation: 4,
  },

  mapControlButtonPressed: {
    opacity: 0.74,
    transform: [{ scale: 0.95 }],
  },

  selectedCardWrapper: {
    marginHorizontal: 22,
    marginTop: -56, // 지도 프레임 아래쪽에 살짝 겹쳐 떠 보이도록 음수 여백을 줍니다.
    zIndex: 30,
  },

  stopCard: {
    paddingHorizontal: 16,
    paddingTop: 15,
    paddingBottom: 14,

    borderRadius: 23,

    backgroundColor: 'rgba(255,255,255,0.96)',

    borderWidth: 1,
    borderColor: COLORS.border,

    shadowColor: COLORS.shadow,
    shadowOffset: {
      width: 0,
      height: 7,
    },
    shadowOpacity: 0.14,
    shadowRadius: 16,

    elevation: 10,
  },

  stopCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  stopCardOrder: {
    width: 32,
    height: 32,

    borderRadius: 16,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: COLORS.primary,
  },

  stopCardOrderText: {
    color: '#FFFFFF',

    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
  },

  stopCardTitleArea: {
    flex: 1,

    marginLeft: 11,
  },

  stopCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',

    gap: 6,
  },

  stopCardTitle: {
    maxWidth: '82%',

    color: COLORS.textPrimary,

    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
  },

  stopCardSticker: {
    fontSize: 19,
  },

  stopCardMeta: {
    marginTop: 3,

    color: COLORS.textSecondary,

    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },

  stopCardMoreButton: {
    width: 34,
    height: 42,

    alignItems: 'center',
    justifyContent: 'center',
  },

  clipList: {
    paddingTop: 13,
    gap: 9,
  },

  clipThumbnail: {
    position: 'relative',

    width: 104,
    height: 82,

    overflow: 'hidden',

    borderRadius: 13,

    backgroundColor: '#E8E5DF',
  },

  clipImage: {
    width: '100%',
    height: '100%',
  },

  clipDim: {
    ...StyleSheet.absoluteFillObject,

    backgroundColor: 'rgba(20,20,18,0.10)',
  },

  clipPlayButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',

    width: 30,
    height: 30,

    marginLeft: -15,
    marginTop: -15,

    borderRadius: 15,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: 'rgba(28,28,25,0.52)',
  },

  clipDuration: {
    position: 'absolute',
    right: 6,
    bottom: 5,

    color: '#FFFFFF',

    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',

    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 3,
  },

  addClipButton: {
    width: 88,
    height: 82,

    alignItems: 'center',
    justifyContent: 'center',

    borderRadius: 13,

    backgroundColor: '#FFFDFC',

    borderWidth: 1,
    borderColor: COLORS.border,
  },

  addClipText: {
    marginTop: 4,

    color: COLORS.textSecondary,

    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
  },

  cardPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.99 }],
  },

  internalNavigationWrapper: {
    position: 'absolute',
    left: 22,
    right: 22,
    zIndex: 40,
  },

  internalNavigation: {
    height: 58,

    paddingHorizontal: 6,
    paddingVertical: 6,

    flexDirection: 'row',
    alignItems: 'center',

    borderRadius: 20,

    backgroundColor: 'rgba(255,255,255,0.97)',

    borderWidth: 1,
    borderColor: COLORS.border,

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

    alignItems: 'center',
    justifyContent: 'center',

    borderRadius: 15,
  },

  internalNavigationItemSelected: {
    backgroundColor: COLORS.primarySoft,
  },

  internalNavigationLabel: {
    marginTop: 3,

    color: COLORS.textSecondary,

    fontSize: 10,
    lineHeight: 14,
    fontWeight: '600',
  },

  internalNavigationLabelSelected: {
    color: COLORS.primary,
    fontWeight: '800',
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingBottom: 120,
    gap: 8,
  },

  planEmptyTitle: {
    marginTop: 6,
    color: COLORS.textPrimary,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '800',
  },

  planEmptyDescription: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
    textAlign: 'center',
  },

  planContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 190,
  },

  dayChipRow: {
    flexDirection: 'row',
    gap: 8,

    paddingBottom: 4,
  },

  dayChip: {
    paddingHorizontal: 16,
    paddingVertical: 9,

    borderRadius: 18,

    backgroundColor: COLORS.card,

    borderWidth: 1,
    borderColor: COLORS.border,
  },

  dayChipSelected: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.primary,
  },

  dayChipText: {
    color: COLORS.textSecondary,

    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },

  dayChipTextSelected: {
    color: COLORS.primaryDark,
    fontWeight: '800',
  },

  planTimeline: {
    marginTop: 20,
  },

  planTimelineRow: {
    flexDirection: 'row',
    gap: 12,
  },

  planTimelineIndicator: {
    width: 40,

    alignItems: 'center',
  },

  planTimelineDot: {
    width: 22,
    height: 22,

    borderRadius: 11,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: COLORS.primary,
  },

  planTimelineDotText: {
    color: '#FFFFFF',

    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
  },

  planTimelineLineArea: {
    flex: 1,
    width: '100%',

    minHeight: 40,

    alignItems: 'center',
    justifyContent: 'center',
  },

  planTimelineLine: {
    position: 'absolute',
    top: 3,
    bottom: 3,

    width: 2,

    backgroundColor: COLORS.routeSoft,
  },

  planDistanceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,

    borderRadius: 8,

    backgroundColor: COLORS.background,

    borderWidth: 1,
    borderColor: COLORS.border,
  },

  planDistanceBadgeText: {
    color: COLORS.textSecondary,

    fontSize: 9,
    lineHeight: 12,
    fontWeight: '700',
  },

  planStopStickerCircle: {
    width: 44,
    height: 44,

    marginRight: 10,

    borderRadius: 22,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: COLORS.primarySoft,
  },

  planStopCard: {
    flex: 1,
    marginBottom: 12,

    paddingHorizontal: 13,
    paddingVertical: 12,

    borderRadius: 16,

    backgroundColor: COLORS.card,

    borderWidth: 1,
    borderColor: COLORS.border,
  },

  planStopCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontWeight: '800',
  },

  planStopMeta: {
    marginTop: 2,

    color: COLORS.textSecondary,

    fontSize: 11,
    lineHeight: 16,
    fontWeight: '500',
  },

  planStopIconButton: {
    width: 30,
    height: 30,

    alignItems: 'center',
    justifyContent: 'center',
  },

  planStopMemoBox: {
    marginTop: 10,

    paddingHorizontal: 11,
    paddingVertical: 9,

    borderRadius: 12,

    backgroundColor: COLORS.primarySoft,
  },

  planStopMemoText: {
    color: COLORS.textPrimary,

    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },

  planStopMemoEmpty: {
    marginTop: 10,

    paddingVertical: 8,

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,

    borderRadius: 12,

    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },

  planStopMemoEmptyText: {
    color: COLORS.textTertiary,

    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },

  planAddRow: {
    flexDirection: 'row',
    gap: 8,

    marginTop: 2,
  },

  planAddButton: {
    flex: 1,

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,

    paddingVertical: 11,

    borderRadius: 14,

    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },

  planAddButtonText: {
    color: COLORS.textSecondary,

    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },

  travelLogSection: {
    marginTop: 28,
  },

  travelLogHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',

    marginBottom: 10,
  },

  travelLogTitle: {
    color: COLORS.textPrimary,

    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
  },

  travelLogSubtitle: {
    color: COLORS.textTertiary,

    fontSize: 11,
    lineHeight: 15,
    fontWeight: '500',
  },

  travelLogList: {
    gap: 10,
  },

  travelLogItem: {
    width: 68,
  },

  travelLogThumbWrapper: {
    position: 'relative',
  },

  travelLogThumb: {
    width: 68,
    height: 68,

    borderRadius: 14,

    backgroundColor: '#E8E5DF',
  },

  travelLogBadge: {
    position: 'absolute',
    right: -3,
    bottom: -3,

    width: 18,
    height: 18,

    borderRadius: 9,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: COLORS.primary,

    borderWidth: 2,
    borderColor: '#FFFFFF',
  },

  travelLogBadgeUnmatched: {
    backgroundColor: '#FFFFFF',
  },

  travelLogTime: {
    marginTop: 5,

    color: COLORS.textSecondary,

    fontSize: 10,
    lineHeight: 13,
    fontWeight: '600',

    textAlign: 'center',
  },

  travelLogAddButton: {
    width: 68,
    height: 68,

    alignItems: 'center',
    justifyContent: 'center',

    borderRadius: 14,

    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },

  travelLogFab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    zIndex: 20,

    width: 54,
    height: 54,

    borderRadius: 27,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: COLORS.primary,

    shadowColor: COLORS.shadow,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.22,
    shadowRadius: 10,

    elevation: 6,
  },

  memoModalBackdrop: {
    flex: 1,

    alignItems: 'center',
    justifyContent: 'center',

    paddingHorizontal: 28,

    backgroundColor: 'rgba(20,20,18,0.45)',
  },

  memoModalCard: {
    width: '100%',

    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,

    borderRadius: 22,

    backgroundColor: COLORS.card,
  },

  memoModalTitle: {
    color: COLORS.textPrimary,

    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
  },

  memoModalHint: {
    marginTop: 4,

    color: COLORS.textSecondary,

    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },

  memoInput: {
    marginTop: 14,

    minHeight: 96,

    paddingHorizontal: 13,
    paddingVertical: 11,

    borderRadius: 14,

    color: COLORS.textPrimary,

    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',

    textAlignVertical: 'top',

    backgroundColor: COLORS.primarySoft,
  },

  memoModalButtonRow: {
    flexDirection: 'row',
    gap: 8,

    marginTop: 16,
  },

  memoModalButton: {
    flex: 1,

    alignItems: 'center',
    justifyContent: 'center',

    paddingVertical: 12,

    borderRadius: 14,
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
    fontWeight: '700',
  },

  memoModalButtonPrimary: {
    backgroundColor: COLORS.primary,
  },

  memoModalButtonPrimaryText: {
    color: '#FFFFFF',

    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
  },

  // === '일정' 탭 스타일 끝 ===
});