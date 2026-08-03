import React, { useMemo, useState } from 'react';
import { router } from 'expo-router';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
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
  background: '#FAF8F1',
  card: '#FFFFFF',

  primary: '#FF8F32',
  primaryDark: '#E97B1F',
  primarySoft: '#FFF0E1',

  textPrimary: '#282722',
  textSecondary: '#8B8A83',
  textTertiary: '#B2B0AA',

  border: '#ECE8DF',
  divider: '#F0ECE4',

  route: '#F6784D',
  routeSoft: '#FFD2C2',

  mapBlue: '#DDF3F2',
  mapGreen: '#E6F2D8',
  mapCream: '#F7F0DA',

  shadow: '#443A31',
};

type RouteViewMode = 'info' | 'map' | 'list';

interface RouteStop {
  id: string;
  order: number;
  name: string;
  shortName: string;
  sticker: string;

  x: number;
  y: number;

  clipCount: number;
  time: string;

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

    x: 18,
    y: 25,

    clipCount: 2,
    time: '14:35',

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
      label: '루트 정보',
      icon: 'map-outline',
      activeIcon: 'map',
    },
    {
      mode: 'map',
      label: '지도',
      icon: 'location-outline',
      activeIcon: 'location',
    },
    {
      mode: 'list',
      label: '리스트',
      icon: 'list-outline',
      activeIcon: 'list',
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
            style={styles.internalNavigationItem}
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

function RouteInformationView() {
  return (
    <ScrollView
      style={styles.alternativeView}
      contentContainerStyle={styles.alternativeContent}
      showsVerticalScrollIndicator={false}
    >
      <Text
        allowFontScaling={false}
        style={styles.alternativeTitle}
      >
        제주 서부 루트
      </Text>

      <Text
        allowFontScaling={false}
        style={styles.alternativeDescription}
      >
        2박 3일 동안 제주 서부의 바다와 카페를 따라
        이동한 여행이에요.
      </Text>

      <View style={styles.routeSummaryGrid}>
        <View style={styles.summaryCard}>
          <Ionicons
            name="calendar-outline"
            size={23}
            color={COLORS.primary}
          />

          <Text style={styles.summaryValue}>
            2박 3일
          </Text>

          <Text style={styles.summaryLabel}>
            여행 기간
          </Text>
        </View>

        <View style={styles.summaryCard}>
          <Ionicons
            name="location-outline"
            size={23}
            color={COLORS.primary}
          />

          <Text style={styles.summaryValue}>
            4곳
          </Text>

          <Text style={styles.summaryLabel}>
            방문 장소
          </Text>
        </View>

        <View style={styles.summaryCard}>
          <Ionicons
            name="film-outline"
            size={23}
            color={COLORS.primary}
          />

          <Text style={styles.summaryValue}>
            10개
          </Text>

          <Text style={styles.summaryLabel}>
            촬영 클립
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

function RouteListView({
  selectedStopId,
  onSelectStop,
}: RouteMapProps) {
  return (
    <ScrollView
      style={styles.alternativeView}
      contentContainerStyle={styles.routeListContent}
      showsVerticalScrollIndicator={false}
    >
      {ROUTE_STOPS.map((stop, index) => {
        const selected = stop.id === selectedStopId;

        return (
          <Pressable
            key={stop.id}
            onPress={() => onSelectStop(stop.id)}
            style={({ pressed }) => [
              styles.routeListCard,
              selected && styles.routeListCardSelected,
              pressed && styles.cardPressed,
            ]}
          >
            <View style={styles.routeListOrderArea}>
              <View
                style={[
                  styles.routeListOrder,
                  selected &&
                    styles.routeListOrderSelected,
                ]}
              >
                <Text style={styles.routeListOrderText}>
                  {stop.order}
                </Text>
              </View>

              {index < ROUTE_STOPS.length - 1 ? (
                <View style={styles.routeListLine} />
              ) : null}
            </View>

            <View style={styles.routeListSticker}>
              <Text style={styles.routeListStickerText}>
                {stop.sticker}
              </Text>
            </View>

            <View style={styles.routeListTextArea}>
              <Text
                numberOfLines={1}
                style={styles.routeListTitle}
              >
                {stop.name}
              </Text>

              <Text style={styles.routeListMeta}>
                클립 {stop.clipCount}개 · {stop.time}
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={20}
              color={COLORS.textTertiary}
            />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export default function MyRouteScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [selectedMode, setSelectedMode] =
    useState<RouteViewMode>('map');

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
        <Pressable
          hitSlop={12}
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.headerButton,
            pressed && styles.headerButtonPressed,
          ]}
        >
          <Ionicons
            name="chevron-back"
            size={25}
            color={COLORS.textPrimary}
          />
        </Pressable>

        <View style={styles.headerTitleArea}>
          <Text
            numberOfLines={1}
            allowFontScaling={false}
            style={styles.headerTitle}
          >
            제주 서부 루트
          </Text>

          <Text
            numberOfLines={1}
            allowFontScaling={false}
            style={styles.headerSubtitle}
          >
            2박 3일 · 장소 4곳
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
          <View style={styles.mapScreen}>
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
          </View>
        ) : selectedMode === 'info' ? (
          <RouteInformationView />
        ) : (
          <RouteListView
            selectedStopId={selectedStopId}
            onSelectStop={(stopId) => {
              handleSelectStop(stopId);
            }}
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

  headerButtonPressed: {
    opacity: 0.68,
    transform: [{ scale: 0.96 }],
  },

  headerTitleArea: {
    flex: 1,

    alignItems: 'center',
    justifyContent: 'center',
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
    position: 'absolute',
    left: 22,
    right: 22,
    bottom: 112,
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
    height: 68,

    paddingHorizontal: 12,

    flexDirection: 'row',
    alignItems: 'center',

    borderRadius: 22,

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

    alignItems: 'center',
    justifyContent: 'center',
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

  alternativeContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 190,
  },

  alternativeTitle: {
    color: COLORS.textPrimary,

    fontSize: 24,
    lineHeight: 32,
    fontWeight: '800',

    letterSpacing: -0.6,
  },

  alternativeDescription: {
    marginTop: 9,

    color: COLORS.textSecondary,

    fontSize: 14,
    lineHeight: 22,
    fontWeight: '500',
  },

  routeSummaryGrid: {
    marginTop: 24,

    flexDirection: 'row',

    gap: 10,
  },

  summaryCard: {
    flex: 1,
    minHeight: 126,

    paddingVertical: 18,

    alignItems: 'center',
    justifyContent: 'center',

    borderRadius: 20,

    backgroundColor: COLORS.card,

    borderWidth: 1,
    borderColor: COLORS.border,
  },

  summaryValue: {
    marginTop: 10,

    color: COLORS.textPrimary,

    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
  },

  summaryLabel: {
    marginTop: 3,

    color: COLORS.textSecondary,

    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
  },

  routeListContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 190,
  },

  routeListCard: {
    minHeight: 92,

    paddingHorizontal: 14,
    paddingVertical: 12,

    flexDirection: 'row',
    alignItems: 'center',

    borderRadius: 18,

    backgroundColor: COLORS.card,

    borderWidth: 1,
    borderColor: COLORS.border,

    marginBottom: 12,
  },

  routeListCardSelected: {
    borderColor: COLORS.primary,

    backgroundColor: '#FFFDFC',
  },

  routeListOrderArea: {
    width: 34,

    alignItems: 'center',
    alignSelf: 'stretch',
  },

  routeListOrder: {
    width: 28,
    height: 28,

    borderRadius: 14,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: '#FFB36D',
  },

  routeListOrderSelected: {
    backgroundColor: COLORS.primary,
  },

  routeListOrderText: {
    color: '#FFFFFF',

    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
  },

  routeListLine: {
    flex: 1,
    width: 2,

    marginTop: 5,

    backgroundColor: COLORS.routeSoft,
  },

  routeListSticker: {
    width: 52,
    height: 52,

    marginLeft: 6,

    borderRadius: 26,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: COLORS.primarySoft,
  },

  routeListStickerText: {
    fontSize: 27,
  },

  routeListTextArea: {
    flex: 1,

    marginLeft: 12,
  },

  routeListTitle: {
    color: COLORS.textPrimary,

    fontSize: 15,
    lineHeight: 21,
    fontWeight: '800',
  },

  routeListMeta: {
    marginTop: 4,

    color: COLORS.textSecondary,

    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
});