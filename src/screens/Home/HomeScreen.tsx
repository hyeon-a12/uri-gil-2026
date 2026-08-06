import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';

/**
 * ─────────────────────────────────────────────────────────────
 * 이 화면에서 "진짜 지도"는 아직 없습니다
 * ─────────────────────────────────────────────────────────────
 * 카카오맵 연동은 나중으로 미뤄뒀으니(메모리에 있던 결정), 여기 지도는
 * 실제 좌표/타일이 아니라 스크린샷과 같은 느낌만 내는 "가짜 지도"입니다
 * — 배경색 + 흐릿한 장소 라벨 + 점선 경로 + 핀 마커로만 구성했어요.
 * 나중에 KakaoMap(보통 WebView + JS SDK 방식)으로 교체할 때는 이
 * MockMap 컴포넌트 통째로 갈아끼우면 되고, 그 위에 떠 있는 검색바/
 * 진행 카드/바텀시트는 실제 지도가 들어와도 구조가 그대로 재사용됩니다.
 */

const COLORS = {
  accent: '#FFB134', // Point/Accent — 메인 CTA, 강조 액션
  accentTint: '#FFF3DF', // 프로모션 배지, 태그 배경
  surface: '#F5F5F5', // 카드/섹션 구분용 연한 회색 배경
  white: '#FFFFFF', // 앱 전체 배경
  textPrimary: '#222222',
  textSecondary: '#8A8A8A',
  border: '#DDDDDD',
  record: '#E14D3F',
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// 지도 영역이 화면에서 차지하는 높이. 검색바는 이 위에 떠 있고,
// 진행 카드는 이 경계에 걸쳐서 떠 있습니다.
const MAP_HEIGHT = SCREEN_HEIGHT * 0.58;

// 바텀시트가 다 접혔을 때(peek) 화면에 보이는 높이,
// 다 펼쳤을 때(expanded) 화면 상단에서 남겨둘 여백.
const SHEET_PEEK_HEIGHT = SCREEN_HEIGHT * 0.46;
const SHEET_EXPANDED_TOP_OFFSET = 90;

// ── 지도 위에 표시할 배경 장소 라벨(사용자의 경로와 무관한, 지도에 원래
// 있는 지명들) ────────────────────────────────────────────────
// RN의 ViewStyle은 top/left에 '%' 문자열을 받을 때 아무 string이나
// 허용하지 않고 `${number}%` 형태의 템플릿 리터럴 타입만 허용해요.
// 그냥 `string`으로 선언하면 "이 값이 진짜 '숫자%' 형태라는 보장이 없다"고
// 보고 에러를 냅니다(정확히 지금 만난 TS2769 오류의 원인이에요).
type PercentString = `${number}%`;

const BACKGROUND_POIS: {
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  top: PercentString;
  left: PercentString;
}[] = [
  { name: '전동성당', icon: 'business-outline', top: '18%', left: '10%' },
  { name: '경기전', icon: 'business-outline', top: '20%', left: '38%' },
  { name: '오목대', icon: 'triangle-outline', top: '52%', left: '52%' },
  { name: '남부시장', icon: 'storefront-outline', top: '78%', left: '82%' },
];

// ── 사용자의 실제 여행 경로(핀) ─────────────────────────────
// order대로 점선으로 이어집니다. icon은 그 장소에서 뭘 했는지를
// 나타내요(집=출발지, 카메라=촬영 스팟, 배터리=충전소, 깃발=도착지).
type RoutePin = {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  top: number; // MAP_HEIGHT 대비 %
  left: number; // 지도 너비 대비 %
  isCurrent?: boolean; // 현재 위치면 pulse 링을 보여줌
};

const ROUTE_PINS: RoutePin[] = [
  { id: 'start', label: '출발', icon: 'home', top: 66, left: 20, isCurrent: true },
  { id: 'photo', label: '촬영', icon: 'camera', top: 38, left: 48 },
  { id: 'charge', label: '충전', icon: 'flash', top: 60, left: 68 },
  { id: 'end', label: '도착', icon: 'flag', top: 14, left: 80 },
];

/** ROUTE_PINS 좌표들을 부드러운 곡선으로 이어붙인 SVG path 문자열을 만듭니다. */
function buildRoutePath(pins: RoutePin[], width: number, height: number) {
  const points = pins.map((p) => ({
    x: (p.left / 100) * width,
    y: (p.top / 100) * height,
  }));

  if (points.length < 2) return '';

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    // 두 점의 중간 지점을 제어점으로 써서 완만한 곡선을 만듭니다.
    const midX = (prev.x + curr.x) / 2;
    const midY = (prev.y + curr.y) / 2;
    d += ` Q ${midX} ${prev.y}, ${midX} ${midY}`;
    d += ` T ${curr.x} ${curr.y}`;
  }
  return d;
}

function MockMap() {
  const mapWidth = SCREEN_WIDTH;
  const pathD = buildRoutePath(ROUTE_PINS, mapWidth, MAP_HEIGHT);

  return (
    <View style={styles.map}>
      {/* 배경 장소 라벨: 실제 경로랑 상관없이 지도 위에 그냥 존재하는 지명들 */}
      {BACKGROUND_POIS.map((poi) => (
        <View
          key={poi.name}
          style={[styles.poiLabel, { top: poi.top, left: poi.left }]}
        >
          <Ionicons name={poi.icon} size={14} color={COLORS.textSecondary} />
          <Text style={styles.poiLabelText}>{poi.name}</Text>
        </View>
      ))}

      {/* 점선 경로 */}
      <Svg
        width={mapWidth}
        height={MAP_HEIGHT}
        style={StyleSheet.absoluteFillObject}
      >
        <Path
          d={pathD}
          stroke={COLORS.accent}
          strokeWidth={2.5}
          strokeDasharray="7, 7"
          fill="none"
          strokeLinecap="round"
        />
      </Svg>

      {/* 경로 핀 마커 */}
      {ROUTE_PINS.map((pin) => (
        <View
          key={pin.id}
          style={[
            styles.pinWrapper,
            {
              // pin.top/left는 number라서 `${pin.top}%`로 문자열을 만들면
              // TS는 이걸 그냥 넓은 string으로 취급해요(리터럴 타입이 아니라서).
              // 위 BACKGROUND_POIS 때와 똑같은 이유로, PercentString으로
              // 명시적으로 캐스팅해줘야 ViewStyle의 top/left 타입과 맞습니다.
              top: `${pin.top}%` as PercentString,
              left: `${pin.left}%` as PercentString,
            },
          ]}
        >
          {/* 현재 위치 핀만 바깥에 옅은 pulse 링을 하나 더 둡니다 */}
          {pin.isCurrent && <View style={styles.pinPulseRing} />}
          <View style={styles.pinCircle}>
            <Ionicons name={pin.icon} size={16} color={COLORS.white} />
          </View>
        </View>
      ))}
    </View>
  );
}

function SearchBar() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.searchBarWrapper, { top: insets.top + 12 }]}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={COLORS.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="어디로 떠나볼까요?"
          placeholderTextColor={COLORS.textSecondary}
        />
        <TouchableOpacity hitSlop={8}>
          <Ionicons name="options-outline" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

type TripProgressCardProps = {
  tripTitle: string;
  elapsedLabel: string;
  onStop: () => void;
};

function TripProgressCard({
  tripTitle,
  elapsedLabel,
  onStop,
}: TripProgressCardProps) {
  return (
    <View style={styles.progressCard}>
      <View style={styles.progressIconCircle}>
        <Ionicons name="navigate" size={20} color={COLORS.accent} />
      </View>

      <View style={styles.progressTextBlock}>
        <View style={styles.progressBadge}>
          <Text style={styles.progressBadgeText}>진행중 여행</Text>
        </View>
        <Text style={styles.progressTitle} numberOfLines={1}>
          {tripTitle}
        </Text>
        <View style={styles.recordRow}>
          <View style={styles.recordDot} />
          <Text style={styles.recordText}>Rec {elapsedLabel}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.stopButton}
        onPress={onStop}
        hitSlop={10}
      >
        <View style={styles.stopIcon} />
      </TouchableOpacity>
    </View>
  );
}

interface ClipMoment {
  id: string;
  durationLabel: string;
  caption: string;
  isNew?: boolean; // REC 배지가 붙는, 방금 찍은 클립
}

const TODAY_MOMENTS: ClipMoment[] = [
  { id: '1', durationLabel: '00:06', caption: '엠제 캐빈' },
  { id: '2', durationLabel: '00:12', caption: '카페 여진' },
  { id: '3', durationLabel: '00:08', caption: '전주 한옥마을', isNew: true },
  { id: '4', durationLabel: '00:09', caption: '오목오항' },
];

interface RecommendedPlace {
  id: string;
  name: string;
}

const RECOMMENDED_PLACES: RecommendedPlace[] = [
  { id: '1', name: '객리단길' },
  { id: '2', name: '팔복예술공장' },
];

/** "오늘의 순간들" 가로 스크롤에 들어가는 클립 하나. 실제 썸네일 이미지가
 * 없어서 지금은 색상 placeholder로 대체했어요 — 나중에
 * <Image source={{ uri: clip.thumbnailUrl }} /> 로 바꿔주시면 됩니다. */
function MomentThumbnail({ moment }: { moment: ClipMoment }) {
  return (
    <View style={styles.momentItem}>
      <View style={styles.momentThumb}>
        {moment.isNew && (
          <View style={styles.recBadge}>
            <Text style={styles.recBadgeText}>REC</Text>
          </View>
        )}
        <View style={styles.durationBadge}>
          <Text style={styles.durationBadgeText}>{moment.durationLabel}</Text>
        </View>
        <View style={styles.playButtonOverlay}>
          <Ionicons name="play" size={16} color={COLORS.white} />
        </View>
      </View>
      <Text style={styles.momentCaption} numberOfLines={1}>
        {moment.caption}
      </Text>
    </View>
  );
}

function RecommendedPlaceCard({ place }: { place: RecommendedPlace }) {
  return (
    <TouchableOpacity style={styles.placeCard} activeOpacity={0.85}>
      <View style={styles.placeImagePlaceholder}>
        <Ionicons name="image-outline" size={24} color={COLORS.textSecondary} />
        <View style={styles.placePinBadge}>
          <Ionicons name="location" size={12} color={COLORS.white} />
        </View>
      </View>
      <Text style={styles.placeName}>{place.name}</Text>
    </TouchableOpacity>
  );
}

/**
 * 위로 끌어올릴 수 있는 바텀시트.
 *
 * 핵심 아이디어: translateY 하나로 시트의 "숨은 정도"를 표현합니다.
 * - translateY = 0            → 완전히 펼쳐진 상태(화면 상단 근처까지)
 * - translateY = DRAG_RANGE   → 접힌 상태(오늘의 순간들/추천 장소만 peek)
 *
 * 드래그 핸들에는 항상 PanResponder를 붙여서 위/아래 어느 방향으로 끌어도
 * 반응하게 했고, 콘텐츠(ScrollView) 영역에도 별도의 PanResponder를 하나 더
 * 붙였습니다 — 단, 이건 "스크롤이 맨 위(0)에 있는 상태에서 아래로 끌 때"에만
 * 끼어들어서 시트를 접습니다. 그 외에는(스크롤할 내용이 남아있을 때) 평소처럼
 * ScrollView가 스크롤을 그대로 처리합니다. 이렇게 해야 핸들의 좁은 영역만
 * 잡았을 때뿐 아니라, 콘텐츠 아무 곳이나 아래로 끌어도 시트를 내릴 수 있어요.
 */
function PullUpSheet() {
  const DRAG_RANGE = SHEET_PEEK_HEIGHT - SHEET_EXPANDED_TOP_OFFSET;

  const translateY = useRef(new Animated.Value(DRAG_RANGE)).current; // 기본값: 접힌 상태
  const currentValueRef = useRef(DRAG_RANGE);
  const dragStartRef = useRef(DRAG_RANGE);
  const scrollOffsetRef = useRef(0); // 내부 ScrollView가 지금 맨 위(0)인지 추적

  useEffect(() => {
    const id = translateY.addListener(({ value }) => {
      currentValueRef.current = value;
    });
    return () => translateY.removeListener(id);
  }, [translateY]);

  const beginDrag = () => {
    dragStartRef.current = currentValueRef.current;
  };

  const moveDrag = (dy: number) => {
    const next = clamp(dragStartRef.current + dy, 0, DRAG_RANGE);
    translateY.setValue(next);
  };

  const endDrag = (dy: number, vy: number) => {
    const released = clamp(dragStartRef.current + dy, 0, DRAG_RANGE);
    // 빠르게 스와이프했으면 속도(vy)를 우선 보고,
    // 애매하게 멈췄으면 절반을 넘겼는지로 판단합니다.
    const shouldExpand = vy < -0.5 || released < DRAG_RANGE / 2;
    Animated.spring(translateY, {
      toValue: shouldExpand ? 0 : DRAG_RANGE,
      useNativeDriver: false,
      bounciness: 4,
    }).start();
  };

  // 손잡이 전용 PanResponder: 위아래 어느 방향이든 손잡이를 잡으면 바로 반응합니다.
  const handlePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dy) > 4,
      onPanResponderGrant: beginDrag,
      onPanResponderMove: (_, gesture) => moveDrag(gesture.dy),
      onPanResponderRelease: (_, gesture) => endDrag(gesture.dy, gesture.vy),
      onPanResponderTerminate: (_, gesture) => endDrag(gesture.dy, gesture.vy),
    }),
  ).current;

  // 콘텐츠 전용 PanResponder: 스크롤이 맨 위일 때 아래로 끄는 동작만 가로채서
  // 시트를 접는 제스처로 넘겨받습니다(그 외에는 ScrollView가 우선합니다).
  const contentPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, gesture) =>
        scrollOffsetRef.current <= 0 &&
        gesture.dy > 8 &&
        Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderGrant: beginDrag,
      onPanResponderMove: (_, gesture) => moveDrag(gesture.dy),
      onPanResponderRelease: (_, gesture) => endDrag(gesture.dy, gesture.vy),
      onPanResponderTerminate: (_, gesture) => endDrag(gesture.dy, gesture.vy),
    }),
  ).current;

  return (
    <Animated.View
      style={[
        styles.sheet,
        {
          top: SHEET_EXPANDED_TOP_OFFSET,
          height: SCREEN_HEIGHT - SHEET_EXPANDED_TOP_OFFSET,
          transform: [{ translateY }],
        },
      ]}
    >
      <View
        {...handlePanResponder.panHandlers}
        hitSlop={{ top: 10, bottom: 10, left: 40, right: 40 }}
        style={styles.sheetHandleArea}
      >
        <View style={styles.sheetHandle} />
      </View>

      <View style={styles.sheetScrollWrapper} {...contentPanResponder.panHandlers}>
        <ScrollView
          style={styles.sheetScroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.sheetContent}
          onScroll={(event) => {
            scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
        >
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>오늘의 순간들</Text>
            <TouchableOpacity>
              <Text style={styles.sectionLink}>전체 보기</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.momentRow}
          >
            {TODAY_MOMENTS.map((moment) => (
              <MomentThumbnail key={moment.id} moment={moment} />
            ))}
          </ScrollView>

          <View style={[styles.sectionHeaderRow, { marginTop: 24 }]}>
            <Text style={styles.sectionTitle}>추천 장소</Text>
            <TouchableOpacity>
              <Text style={styles.sectionLink}>전체 보기</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.placeRow}>
            {RECOMMENDED_PLACES.map((place) => (
              <RecommendedPlaceCard key={place.id} place={place} />
            ))}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Animated.View>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export default function TripHomeScreen() {
  const [elapsedSeconds] = useState(204); // 00:03:24 예시 값. 실제로는 타이머 state로 관리.

  const elapsedLabel = (() => {
    const h = Math.floor(elapsedSeconds / 3600);
    const m = Math.floor((elapsedSeconds % 3600) / 60);
    const s = elapsedSeconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(
      2,
      '0',
    )}:${String(s).padStart(2, '0')}`;
  })();

  return (
    <View style={styles.screen}>
      {/* 지도는 네모 박스 안에 갇히지 않고 화면 전체 폭을 그대로 채웁니다.
          검색바/진행 카드/시트는 전부 그 위에 떠 있는 오버레이예요. */}
      <MockMap />

      <SearchBar />

      <View style={styles.progressCardWrapper}>
        <TripProgressCard
          tripTitle="전주 한옥마을을 여행 중"
          elapsedLabel={elapsedLabel}
          onStop={() => {
            // TODO: 여행 종료 확인 다이얼로그 + 실제 종료 처리 연결
          }}
        />
      </View>

      <PullUpSheet />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.white,
  },

  // 지도
  map: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: MAP_HEIGHT,
    backgroundColor: COLORS.surface,
    overflow: 'hidden',
  },
  poiLabel: {
    position: 'absolute',
    alignItems: 'center',
    gap: 2,
  },
  poiLabelText: {
    fontSize: 10,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  pinWrapper: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    // 마커의 "끝"이 실제 좌표를 가리키도록 자기 크기의 절반만큼 당겨줍니다.
    marginLeft: -18,
    marginTop: -18,
    width: 36,
    height: 36,
  },
  pinPulseRing: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,177,52,0.25)',
  },
  pinCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },

  // 검색바
  searchBarWrapper: {
    position: 'absolute',
    left: 20,
    right: 20,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.white,
    borderRadius: 24,
    paddingHorizontal: 16,
    height: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textPrimary,
  },

  // 여행 진행 카드
  progressCardWrapper: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: MAP_HEIGHT - 40, // 지도/시트 경계에 걸쳐서 떠 있도록
  },
  progressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 6,
  },
  progressIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.accentTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTextBlock: {
    flex: 1,
    gap: 4,
  },
  progressBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.accentTint,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  progressBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.accent,
  },
  progressTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  recordDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.record,
  },
  recordText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  stopButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopIcon: {
    width: 12,
    height: 12,
    borderRadius: 2,
    backgroundColor: COLORS.record,
  },

  // 바텀시트
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 8,
  },
  sheetHandleArea: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
  },
  sheetScrollWrapper: {
    flex: 1,
  },
  sheetScroll: {
    flex: 1,
  },
  sheetContent: {
    paddingHorizontal: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  sectionLink: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },

  // 오늘의 순간들
  momentRow: {
    gap: 12,
  },
  momentItem: {
    width: 84,
    alignItems: 'flex-start',
  },
  momentThumb: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 42,
    backgroundColor: 'rgba(0,0,0,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recBadge: {
    position: 'absolute',
    top: -2,
    left: 18,
    zIndex: 2,
    backgroundColor: COLORS.record,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  recBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: COLORS.white,
  },
  durationBadge: {
    position: 'absolute',
    bottom: 6,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
    zIndex: 2,
  },
  durationBadgeText: {
    fontSize: 9,
    color: COLORS.white,
    fontWeight: '600',
  },
  momentCaption: {
    marginTop: 6,
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
    width: 84,
  },

  // 추천 장소
  placeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  placeCard: {
    flex: 1,
  },
  placeImagePlaceholder: {
    height: 90,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placePinBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeName: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
});
