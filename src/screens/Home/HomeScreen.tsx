import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  Pressable,
  Modal,
  Alert,
  Keyboard,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter, useFocusEffect } from 'expo-router';
import KakaoMapView, {
  KakaoMapPin,
  KakaoMapCurrentLocation,
} from '@/components/KakaoMapView';
import { ClipPreviewModal } from '@/components/ClipPreview/ClipPreviewModal'
import MyLocationIcon from '@/assets/images/my-location.svg';
import { AppText as Text } from '@/components/AppText';
import { HapticPressable, TripSelector } from '@/components/common';
import { useTripStore } from '@/store/useTripStore';
import { getRecordingsByFolder } from '@/services/recordingService';
import type { FolderItem } from '@/services/folderService';
import { appendTripScheduleStops } from '@/services/trip-schedule-service';
import type { RecordingData } from '@/types/recording';
import { ClipItem } from '@/types/home';
import { COLORS as SHARED_COLORS } from '@/constants/color';

const COLORS = {
  accent: SHARED_COLORS.accent, // Point/Accent — 메인 CTA, 강조 액션
  accentTint: SHARED_COLORS.main, // 프로모션 배지, 태그 배경
  surface: SHARED_COLORS.surface, // 카드/섹션 구분용 연한 회색 배경
  white: SHARED_COLORS.background, // 앱 전체 배경
  textPrimary: SHARED_COLORS.textPrimary,
  textSecondary: SHARED_COLORS.textSecondary,
  border: SHARED_COLORS.border,
  record: SHARED_COLORS.danger,
};

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// 바텀시트가 다 접혔을 때(peek) 화면에 보이는 높이,
// 다 펼쳤을 때(expanded) 화면 상단에서 남겨둘 여백.
const SHEET_PEEK_HEIGHT = SCREEN_HEIGHT * 0.46;
// 콘텐츠 확장 상태에서도 검색 영역 일부가 남아 과도하게 답답하지 않게 합니다.
const SHEET_EXPANDED_TOP_OFFSET = 118;
// 지도 우선 상태에서 시트를 완전히 숨기지 않고, 헤더와 손잡이가 보일 정도로 남깁니다.
const SHEET_MAP_FOCUS_VISIBLE_HEIGHT = 245;

/** 활성 여행의 클립 중 실제 GPS 좌표가 찍힌 것만 지도 핀으로 씁니다.
 * (좌표 미기록 클립은 location이 (0,0) 더미값이라 지도에 올리면 왜곡됩니다.) */
function buildRoutePins(recordings: RecordingData[]): KakaoMapPin[] {
  return recordings
    .filter((r) => r.location.latitude !== 0 || r.location.longitude !== 0)
    .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))
    .map((r, index) => ({
      id: r.id,
      label: String(index + 1),
      lat: r.location.latitude,
      lng: r.location.longitude,
    }));
}

function isToday(isoString: string): boolean {
  const date = new Date(isoString);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function formatClipDuration(durationMs?: number): string {
  const totalSeconds = Math.floor((durationMs ?? 0) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** 활성 여행의 클립 중 오늘 촬영된 것만 "오늘의 순간들"에 올립니다. */
function buildTodayMoments(recordings: RecordingData[]): ClipItem[] {
  const todayRecordings = recordings
    .filter((r) => isToday(r.recordedAt))
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)); // 최신 촬영이 맨 앞

  return todayRecordings.map((r, index) => ({
    id: r.id,
    recordedAt: r.recordedAt ?? new Date().toISOString(),
    durationSeconds: Math.floor((r.durationMs ?? 0) / 1000),
    thumbnail: r.thumbnail ?? r.thumbnail,
    uri: r.videoUri ?? '',

    durationLabel: formatClipDuration(r.durationMs),
    caption: r.location.placeName ?? "장소 미지정",
    isNew: index === 0,
  }));
}

interface RecommendedPlace {
  id: string;
  name: string;
}

const RECOMMENDED_PLACES: RecommendedPlace[] = [
  { id: "1", name: "객리단길" },
  { id: "2", name: "팔복예술공장" },
];

/** "오늘의 순간들" 가로 스크롤에 들어가는 클립 하나. 실제 썸네일 이미지가
 * 없어서 지금은 색상 placeholder로 대체했어요 — 나중에
 * <Image source={{ uri: clip.thumbnailUrl }} /> 로 바꿔주시면 됩니다. */
function MomentThumbnail({
  moment,
  onSelect,
}: {
  moment: ClipItem;
  onSelect: (moment: ClipItem) => void; }) {
  return (
    <HapticPressable
      style={styles.cardContainer}
      onPress={() => onSelect(moment)}
    >
      <View style={styles.momentThumb}>
        {moment.thumbnail ? (
          <Image
            source={{ uri: moment.thumbnail }}
            style={styles.thumbnailImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.placeholderThumb} />
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
    </HapticPressable>
  );
}

type SearchResultItem = {
  id: string;
  title: string;
  subtitle: string;
  latitude: number;
  longitude: number;
  category: string;
  distance?: number;
};

type SearchCategory = "AI" | "OL7" | "FD6" | "CE7" | "CS2";

type HomeTopBarProps = {
  query: string;
  results: SearchResultItem[];
  searchFocused: boolean;
  isSearching: boolean;

  tripTitle: string;

  onChangeQuery: (text: string) => void;
  onFocusSearch: () => void;
  onBlurSearch: () => void;
  onSubmitSearch: () => void;
  onSelectResult: (item: SearchResultItem) => void;
  onClearSearch: () => void;
  onPressMyTrip: () => void;
  onPressCategory: (category: SearchCategory) => void;
};

// AI 추천 화면(AiRecommendationScreen) 안에서만 쓰는 검색바입니다. 홈 화면
// 기본 화면에서는 더 이상 안 쓰지만(여행 선택 UI로 교체됨), AI 추천 진입점을
// 나중에 다시 배치할 때 그대로 재사용할 수 있게 컴포넌트 자체는 남겨둡니다.
function HomeTopBar({
  query,
  results,
  searchFocused,
  isSearching,
  tripTitle,
  onChangeQuery,
  onFocusSearch,
  onBlurSearch,
  onSubmitSearch,
  onSelectResult,
  onClearSearch,
  onPressMyTrip,
  onPressCategory,
}: HomeTopBarProps) {
  const showResults =
    searchFocused && (query.trim().length > 0 || results.length > 0);

  const searchAnimation = useRef(
    new Animated.Value(searchFocused ? 1 : 0),
  ).current;

  useEffect(() => {
    Animated.timing(searchAnimation, {
      toValue: searchFocused ? 1 : 0,
      duration: 260,
      useNativeDriver: false,
    }).start();
  }, [searchFocused, searchAnimation]);

  const myTripWidth = searchAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [132, 0],
  });

  const myTripOpacity = searchAnimation.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 0, 0],
  });

  const myTripMarginLeft = searchAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [10, 0],
  });

  const categoryHeight = searchAnimation.interpolate({
    inputRange: [0, 1],
    // 흰색 카테고리 칩의 높이와 위 여백까지 포함합니다.
    outputRange: [0, 52],
  });

  const categoryOpacity = searchAnimation.interpolate({
    inputRange: [0, 0.55, 1],
    outputRange: [0, 0, 1],
  });

  const categoryTranslateY = searchAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [-8, 0],
  });

  return (
    <View style={styles.topBarWrapper}>
      <View style={styles.topBar}>
        <Animated.View style={styles.searchBar}>
          {searchFocused ? (
            <Pressable
              hitSlop={8}
              onPress={() => {
                Keyboard.dismiss();
                onBlurSearch();
              }}
              style={styles.searchBackButton}
            >
              <Ionicons
                name="chevron-back"
                size={25}
                color={COLORS.textPrimary}
              />
            </Pressable>
          ) : (
            <Ionicons
              name="search-outline"
              size={23}
              color={COLORS.textPrimary}
            />
          )}

          <TextInput
            value={query}
            onChangeText={onChangeQuery}
            onFocus={onFocusSearch}
            onSubmitEditing={onSubmitSearch}
            placeholder="장소·주소·버스 검색"
            placeholderTextColor="#6F7280"
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="never"
            style={styles.searchInput}
          />

          {query.length > 0 ? (
            <Pressable
              onPress={onClearSearch}
              hitSlop={8}
              style={styles.searchClearButton}
            >
              <Ionicons
                name="close-circle"
                size={19}
                color={COLORS.textSecondary}
              />
            </Pressable>
          ) : (
            <Ionicons name="mic-outline" size={23} color={COLORS.textPrimary} />
          )}
        </Animated.View>

        <Animated.View
          pointerEvents={searchFocused ? "none" : "auto"}
          style={[
            styles.myTripAnimatedWrapper,
            {
              width: myTripWidth,
              opacity: myTripOpacity,
              marginLeft: myTripMarginLeft,
            },
          ]}
        >
          <TouchableOpacity
            style={styles.myTripButton}
            activeOpacity={0.9}
            onPress={onPressMyTrip}
          >
            <Ionicons
              name="people-outline"
              size={23}
              color={COLORS.textPrimary}
            />
            <Text style={styles.myTripText} numberOfLines={1}>
              {tripTitle}
            </Text>
            <Ionicons
              name="chevron-forward"
              size={21}
              color={COLORS.textPrimary}
            />
          </TouchableOpacity>
        </Animated.View>
      </View>

      <Animated.View
        pointerEvents={searchFocused ? "auto" : "none"}
        style={[
          styles.categoryAnimatedWrapper,
          {
            height: categoryHeight,
            opacity: categoryOpacity,
            transform: [{ translateY: categoryTranslateY }],
          },
        ]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
          contentContainerStyle={styles.categoryRow}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            style={styles.categoryButton}
            activeOpacity={0.75}
            onPress={() => onPressCategory("AI")}
          >
            <View style={styles.aiIcon}>
              <View style={styles.aiIconInner} />
            </View>
            <Text style={styles.categoryText}>AI추천</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.categoryButton}
            activeOpacity={0.75}
            onPress={() => onPressCategory("OL7")}
          >
            <Ionicons name="car-sport" size={16} color={COLORS.textPrimary} />
            <Text style={styles.categoryText}>주유소</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.categoryButton}
            activeOpacity={0.75}
            onPress={() => onPressCategory("FD6")}
          >
            <Ionicons name="restaurant" size={16} color={COLORS.textPrimary} />
            <Text style={styles.categoryText}>음식점</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.categoryButton}
            activeOpacity={0.75}
            onPress={() => onPressCategory("CE7")}
          >
            <Ionicons name="cafe" size={16} color={COLORS.textPrimary} />
            <Text style={styles.categoryText}>카페</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.categoryButton}
            activeOpacity={0.75}
            onPress={() => onPressCategory("CS2")}
          >
            <Ionicons name="storefront" size={16} color={COLORS.textPrimary} />
            <Text style={styles.categoryText}>편의점</Text>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>

      {showResults ? (
        <View style={styles.searchResultPanel}>
          {isSearching ? (
            <View style={styles.searchEmpty}>
              <Ionicons
                name="search-outline"
                size={20}
                color={COLORS.textSecondary}
              />
              <Text style={styles.searchEmptyText}>
                장소를 불러오고 있어요...
              </Text>
            </View>
          ) : results.length > 0 ? (
            <ScrollView
              style={styles.searchResultList}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {results.map((item, index) => (
                <Pressable
                  key={item.id}
                  onPress={() => onSelectResult(item)}
                  style={({ pressed }) => [
                    styles.searchResultItem,
                    index !== results.length - 1 &&
                      styles.searchResultItemBorder,
                    pressed && styles.searchResultItemPressed,
                  ]}
                >
                  <View style={styles.searchResultIcon}>
                    <Ionicons
                      name="location-outline"
                      size={19}
                      color={COLORS.accent}
                    />
                  </View>

                  <View style={styles.searchResultTextArea}>
                    <Text style={styles.searchResultTitle} numberOfLines={1}>
                      {item.title}
                    </Text>

                    <Text style={styles.searchResultSubtitle} numberOfLines={1}>
                      {item.subtitle}
                    </Text>

                    <Text style={styles.searchResultMeta} numberOfLines={1}>
                      {item.category}
                      {item.distance !== undefined
                        ? ` · ${
                            item.distance < 1000
                              ? `${Math.round(item.distance)}m`
                              : `${(item.distance / 1000).toFixed(1)}km`
                          }`
                        : ""}
                    </Text>
                  </View>

                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={COLORS.textSecondary}
                  />
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.searchEmpty}>
              <Ionicons
                name="search-outline"
                size={20}
                color={COLORS.textSecondary}
              />
              <Text style={styles.searchEmptyText}>
                일치하는 검색 결과가 없어요
              </Text>
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}

function RecommendedPlaceCard({ place }: { place: RecommendedPlace }) {
  return (
    <HapticPressable style={styles.placeCard}>
      <View style={styles.placeImagePlaceholder}>
        <Ionicons name="image-outline" size={24} color={COLORS.textSecondary} />
        <View style={styles.placePinBadge}>
          <Ionicons name="location" size={12} color={COLORS.white} />
        </View>
      </View>
      <Text style={styles.placeName}>{place.name}</Text>
    </HapticPressable>
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
type PullUpSheetProps = {
  moments: ClipItem[];
  selectedCategory: Exclude<SearchCategory, "AI"> | null;
  categoryResults: SearchResultItem[];
  isSearchingCategory: boolean;
  onPressCategory: (category: Exclude<SearchCategory, "AI">) => void;
  onPressCompass: () => void;
};

const CATEGORY_TAGS: {
  id: Exclude<SearchCategory, "AI">;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
}[] = [
  { id: "OL7", label: "주유소", icon: "car-sport" },
  { id: "FD6", label: "음식점", icon: "restaurant" },
  { id: "CE7", label: "카페", icon: "cafe" },
  { id: "CS2", label: "편의점", icon: "storefront" },
];

function PullUpSheet({
  moments,
  selectedCategory,
  categoryResults,
  isSearchingCategory,
  onPressCategory,
  onPressCompass,
}: PullUpSheetProps) {
  // 0: 오늘의 순간들 확장, DRAG_RANGE: 기본 보기, MAP_FOCUS_TRANSLATE: 지도 크게 보기
  const DRAG_RANGE = SHEET_PEEK_HEIGHT - SHEET_EXPANDED_TOP_OFFSET;
  const MAP_FOCUS_TRANSLATE =
    SCREEN_HEIGHT - SHEET_EXPANDED_TOP_OFFSET - SHEET_MAP_FOCUS_VISIBLE_HEIGHT;
  const SNAP_POINTS = [0, DRAG_RANGE, MAP_FOCUS_TRANSLATE];

  const translateY = useRef(new Animated.Value(DRAG_RANGE)).current; // 기본값: 균형 보기
  const currentValueRef = useRef(DRAG_RANGE);
  const dragStartRef = useRef(DRAG_RANGE);
  const scrollOffsetRef = useRef(0); // 내부 ScrollView가 지금 맨 위(0)인지 추적

  const [previewClip, setPreviewClip] = useState<ClipItem | null>(null);

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
    const next = clamp(dragStartRef.current + dy, 0, MAP_FOCUS_TRANSLATE);
    translateY.setValue(next);
  };

  const snapTo = (target: number) => {
    Animated.spring(translateY, {
      toValue: target,
      useNativeDriver: false,
      bounciness: 4,
    }).start();
  };

  const endDrag = (dy: number, vy: number) => {
    const released = clamp(dragStartRef.current + dy, 0, MAP_FOCUS_TRANSLATE);
    const currentSnapIndex = SNAP_POINTS.reduce(
      (closestIndex, point, index) =>
        Math.abs(point - dragStartRef.current) <
        Math.abs(SNAP_POINTS[closestIndex] - dragStartRef.current)
          ? index
          : closestIndex,
      0,
    );

    // 충분히 끌었거나 빠르게 스와이프한 경우에도 바로 끝 단계로 보내지 않고,
    // 현재 위치에서 한 단계만 이동합니다. 기본 상태가 항상 중간 완충점이 됩니다.
    if (dy > 105 || vy > 0.72) {
      snapTo(
        SNAP_POINTS[Math.min(currentSnapIndex + 1, SNAP_POINTS.length - 1)],
      );
      return;
    }
    if (dy < -105 || vy < -0.72) {
      snapTo(SNAP_POINTS[Math.max(currentSnapIndex - 1, 0)]);
      return;
    }

    const nearestPoint = SNAP_POINTS.reduce((closest, point) =>
      Math.abs(point - released) < Math.abs(closest - released)
        ? point
        : closest,
    );
    snapTo(nearestPoint);
  };

  // 손잡이 전용 PanResponder: 위아래 어느 방향이든 손잡이를 잡으면 바로 반응합니다.
  const handlePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 4,
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
      onMoveShouldSetPanResponderCapture: (_, gesture) => {
        const isVertical = Math.abs(gesture.dy) > Math.abs(gesture.dx);
        // 목록을 읽는 동안의 스크롤은 유지하고, 목록 맨 위에서만 시트 드래그로 전환합니다.
        const pullingSheetDown = scrollOffsetRef.current <= 0 && gesture.dy > 8;
        const pushingSheetUp = currentValueRef.current > 0 && gesture.dy < -8;
        return isVertical && (pullingSheetDown || pushingSheetUp);
      },
      onPanResponderGrant: beginDrag,
      onPanResponderMove: (_, gesture) => moveDrag(gesture.dy),
      onPanResponderRelease: (_, gesture) => endDrag(gesture.dy, gesture.vy),
      onPanResponderTerminate: (_, gesture) => endDrag(gesture.dy, gesture.vy),
    }),
  ).current;

  return (
    <>
      {/* 시트와 같은 translateY를 공유해서, 시트를 어디까지 끌어올리든
          항상 시트 맨 위 가장자리보다 한 뼘 위에 떠 있게 합니다. */}
      <Animated.View
        style={[
          styles.compassButtonWrapper,
          { transform: [{ translateY }] },
        ]}
      >
        <HapticPressable style={styles.compassButton} onPress={onPressCompass}>
          <MyLocationIcon width={22} height={22} fill="#000000" />
        </HapticPressable>
      </Animated.View>

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

      <View
        style={styles.sheetScrollWrapper}
        {...contentPanResponder.panHandlers}
      >
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
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.momentRow}
          >
            {moments.length > 0 ? (
              moments.map((moment) => (
                <MomentThumbnail
                  key={moment.id}
                  moment={moment}
                  onSelect={() => setPreviewClip(moment)}
                />
              ))
            ) : (
              <Text style={styles.emptyMomentsText}>
                오늘 촬영한 클립이 아직 없어요
              </Text>
            )}
          </ScrollView>

          <View style={[styles.sectionHeaderRow, { marginTop: 24 }]}>
            <Text style={styles.sectionTitle}>추천 장소</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryTagRow}
          >
            {CATEGORY_TAGS.map((tag) => {
              const selected = selectedCategory === tag.id;
              return (
                <HapticPressable
                  key={tag.id}
                  onPress={() => onPressCategory(tag.id)}
                  style={[
                    styles.categoryTagButton,
                    selected && styles.categoryTagButtonSelected,
                  ]}
                >
                  <Ionicons
                    name={tag.icon}
                    size={16}
                    color={selected ? COLORS.white : COLORS.textPrimary}
                  />
                  <Text
                    style={[
                      styles.categoryTagText,
                      selected && styles.categoryTagTextSelected,
                    ]}
                  >
                    {tag.label}
                  </Text>
                </HapticPressable>
              );
            })}
          </ScrollView>

          {selectedCategory ? (
            <View style={styles.categoryResultList}>
              {isSearchingCategory ? (
                <Text style={styles.emptyMomentsText}>
                  주변 장소를 불러오는 중이에요...
                </Text>
              ) : categoryResults.length > 0 ? (
                categoryResults.map((place, index) => (
                  <View
                    key={place.id}
                    style={[
                      styles.categoryResultItem,
                      index !== categoryResults.length - 1 &&
                        styles.categoryResultItemBorder,
                    ]}
                  >
                    <View style={styles.categoryResultIcon}>
                      <Ionicons
                        name="location-outline"
                        size={18}
                        color={COLORS.accent}
                      />
                    </View>
                    <View style={styles.categoryResultTextArea}>
                      <Text style={styles.categoryResultTitle} numberOfLines={1}>
                        {place.title}
                      </Text>
                      <Text style={styles.categoryResultSubtitle} numberOfLines={1}>
                        {place.subtitle}
                        {place.distance !== undefined
                          ? ` · ${
                              place.distance < 1000
                                ? `${Math.round(place.distance)}m`
                                : `${(place.distance / 1000).toFixed(1)}km`
                            }`
                          : ""}
                      </Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyMomentsText}>
                  주변에 추천할 장소가 없어요
                </Text>
              )}
            </View>
          ) : null}

          <View style={styles.placeRow}>
            {RECOMMENDED_PLACES.map((place) => (
              <RecommendedPlaceCard key={place.id} place={place} />
            ))}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>

      <ClipPreviewModal
        clip={previewClip}
        onClose={() => setPreviewClip(null)}
      />
      </Animated.View>
    </>
  );
}

function getTripDisplayName(trip: FolderItem | null): string {
  if (!trip) return "여행 선택";

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

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

type AiPlanFilter = "all" | "food" | "cafe" | "attraction";

function formatPlaceDistance(distance?: number): string {
  if (distance === undefined) return "예시 코스";
  return distance < 1000
    ? `${Math.round(distance)}m`
    : `${(distance / 1000).toFixed(1)}km`;
}

// 위치 권한 또는 지도 연결 전에도 추천 화면의 흐름을 확인할 수 있는 예시 코스입니다.
// 위치가 연결되면 이 데이터는 Kakao 장소 검색 결과로 자동 교체됩니다.
function buildFallbackAiPlan(
  location: KakaoMapCurrentLocation | null,
): SearchResultItem[] {
  const baseLat = location?.lat ?? 37.5665;
  const baseLng = location?.lng ?? 126.978;

  return [
    {
      id: "sample-walk",
      title: "산책하기 좋은 주변 코스",
      subtitle: "위치 연결 후 실제 주변 장소로 바뀝니다",
      latitude: baseLat + 0.002,
      longitude: baseLng + 0.001,
      category: "관광",
      distance: location ? 280 : undefined,
    },
    {
      id: "sample-cafe",
      title: "잠시 쉬어가기 좋은 카페",
      subtitle: "위치 연결 후 실제 주변 장소로 바뀝니다",
      latitude: baseLat + 0.0035,
      longitude: baseLng - 0.0015,
      category: "카페",
      distance: location ? 520 : undefined,
    },
    {
      id: "sample-food",
      title: "식사 추천 장소",
      subtitle: "위치 연결 후 실제 주변 장소로 바뀝니다",
      latitude: baseLat + 0.005,
      longitude: baseLng + 0.002,
      category: "음식점",
      distance: location ? 860 : undefined,
    },
  ];
}

function getAiPlaceKind(place: SearchResultItem): {
  label: string;
  icon: "restaurant-outline" | "cafe-outline" | "camera-outline";
  color: string;
  softColor: string;
} {
  const source = `${place.category} ${place.title}`.toLowerCase();

  if (source.includes("카페")) {
    return {
      label: "카페",
      icon: "cafe-outline",
      color: "#7B61FF",
      softColor: "#F0EDFF",
    };
  }

  if (
    source.includes("음식") ||
    source.includes("식당") ||
    source.includes("맛집")
  ) {
    return {
      label: "맛집",
      icon: "restaurant-outline",
      color: "#F36E5B",
      softColor: "#FFF0ED",
    };
  }

  return {
    label: "관광",
    icon: "camera-outline",
    color: "#2CA98D",
    softColor: "#E8F8F2",
  };
}

type AiRecommendationScreenProps = {
  visible: boolean;
  loading: boolean;
  currentLocation: KakaoMapCurrentLocation | null;
  places: SearchResultItem[];
  selectedIds: string[];
  onExitAnimationComplete: () => void;
  onRefresh: () => void;
  onTogglePlace: (id: string) => void;
  onApplyPlan: () => void;
};

function AiRecommendationScreen({
  visible,
  loading,
  currentLocation,
  places,
  selectedIds,
  onExitAnimationComplete,
  onRefresh,
  onTogglePlace,
  onApplyPlan,
}: AiRecommendationScreenProps) {
  const [filter, setFilter] = useState<AiPlanFilter>("all");
  const [aiSearchTerm, setAiSearchTerm] = useState("");
  const [isAiTopBarFocused, setIsAiTopBarFocused] = useState(true);
  const [isAiExiting, setIsAiExiting] = useState(false);
  const aiExitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const AI_DEFAULT_TRANSLATE = SHEET_PEEK_HEIGHT - SHEET_EXPANDED_TOP_OFFSET;
  const AI_MAP_FOCUS_TRANSLATE =
    SCREEN_HEIGHT - SHEET_EXPANDED_TOP_OFFSET - SHEET_MAP_FOCUS_VISIBLE_HEIGHT;
  const AI_SNAP_POINTS = [0, AI_DEFAULT_TRANSLATE, AI_MAP_FOCUS_TRANSLATE];
  const aiSheetTranslateY = useRef(
    new Animated.Value(AI_DEFAULT_TRANSLATE),
  ).current;
  const aiSheetCurrentValueRef = useRef(AI_DEFAULT_TRANSLATE);
  const aiSheetDragStartRef = useRef(AI_DEFAULT_TRANSLATE);
  const aiSheetScrollOffsetRef = useRef(0);

  useEffect(() => {
    const listenerId = aiSheetTranslateY.addListener(({ value }) => {
      aiSheetCurrentValueRef.current = value;
    });
    return () => aiSheetTranslateY.removeListener(listenerId);
  }, [aiSheetTranslateY]);

  useEffect(() => {
    if (visible) {
      setFilter("all");
      setAiSearchTerm("");
      setIsAiTopBarFocused(true);
      setIsAiExiting(false);
      aiSheetTranslateY.setValue(AI_DEFAULT_TRANSLATE);
      aiSheetCurrentValueRef.current = AI_DEFAULT_TRANSLATE;
      aiSheetScrollOffsetRef.current = 0;
    }
  }, [AI_DEFAULT_TRANSLATE, aiSheetTranslateY, visible]);

  useEffect(
    () => () => {
      if (aiExitTimerRef.current) clearTimeout(aiExitTimerRef.current);
    },
    [],
  );

  const handleAiBackToHome = () => {
    if (isAiExiting) return;

    // AI 화면을 바로 닫지 않고, 홈과 동일한 260ms 축소 애니메이션을 먼저 보여줍니다.
    setIsAiExiting(true);
    Keyboard.dismiss();
    setIsAiTopBarFocused(false);
    aiExitTimerRef.current = setTimeout(() => {
      onExitAnimationComplete();
    }, 260);
  };

  const beginAiSheetDrag = () => {
    aiSheetDragStartRef.current = aiSheetCurrentValueRef.current;
  };

  const moveAiSheetDrag = (dy: number) => {
    aiSheetTranslateY.setValue(
      clamp(aiSheetDragStartRef.current + dy, 0, AI_MAP_FOCUS_TRANSLATE),
    );
  };

  const snapAiSheetTo = (target: number) => {
    Animated.spring(aiSheetTranslateY, {
      toValue: target,
      useNativeDriver: false,
      bounciness: 4,
    }).start();
  };

  const endAiSheetDrag = (dy: number, vy: number) => {
    const released = clamp(
      aiSheetDragStartRef.current + dy,
      0,
      AI_MAP_FOCUS_TRANSLATE,
    );
    const currentSnapIndex = AI_SNAP_POINTS.reduce(
      (closestIndex, point, index) =>
        Math.abs(point - aiSheetDragStartRef.current) <
        Math.abs(AI_SNAP_POINTS[closestIndex] - aiSheetDragStartRef.current)
          ? index
          : closestIndex,
      0,
    );

    // 홈 화면과 같이 큰 드래그도 인접 단계로만 이동해 극단적으로 튀지 않습니다.
    if (dy > 105 || vy > 0.72) {
      snapAiSheetTo(
        AI_SNAP_POINTS[
          Math.min(currentSnapIndex + 1, AI_SNAP_POINTS.length - 1)
        ],
      );
      return;
    }
    if (dy < -105 || vy < -0.72) {
      snapAiSheetTo(AI_SNAP_POINTS[Math.max(currentSnapIndex - 1, 0)]);
      return;
    }

    snapAiSheetTo(
      AI_SNAP_POINTS.reduce((closest, point) =>
        Math.abs(point - released) < Math.abs(closest - released)
          ? point
          : closest,
      ),
    );
  };

  const aiSheetHandlePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 4,
      onPanResponderGrant: beginAiSheetDrag,
      onPanResponderMove: (_, gesture) => moveAiSheetDrag(gesture.dy),
      onPanResponderRelease: (_, gesture) =>
        endAiSheetDrag(gesture.dy, gesture.vy),
      onPanResponderTerminate: (_, gesture) =>
        endAiSheetDrag(gesture.dy, gesture.vy),
    }),
  ).current;

  const aiSheetContentPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, gesture) => {
        const isVertical = Math.abs(gesture.dy) > Math.abs(gesture.dx);
        const pullingDown =
          aiSheetScrollOffsetRef.current <= 0 && gesture.dy > 8;
        const pushingUp = aiSheetCurrentValueRef.current > 0 && gesture.dy < -8;
        return isVertical && (pullingDown || pushingUp);
      },
      onPanResponderGrant: beginAiSheetDrag,
      onPanResponderMove: (_, gesture) => moveAiSheetDrag(gesture.dy),
      onPanResponderRelease: (_, gesture) =>
        endAiSheetDrag(gesture.dy, gesture.vy),
      onPanResponderTerminate: (_, gesture) =>
        endAiSheetDrag(gesture.dy, gesture.vy),
    }),
  ).current;

  if (!visible) return null;

  const visiblePlaces = places.filter((place) => {
    if (filter === "all") return true;
    const kind = getAiPlaceKind(place).label;
    return (
      (filter === "food" && kind === "맛집") ||
      (filter === "cafe" && kind === "카페") ||
      (filter === "attraction" && kind === "관광")
    );
  });

  const mapPins: KakaoMapPin[] = places.map((place, index) => ({
    id: `ai-${place.id}`,
    label: String(index + 1),
    lat: place.latitude,
    lng: place.longitude,
  }));

  const filters: { id: AiPlanFilter; label: string }[] = [
    { id: "all", label: "가까운 순" },
    { id: "attraction", label: "관광" },
    { id: "food", label: "맛집" },
    { id: "cafe", label: "카페" },
  ];

  return (
    <View style={styles.aiPlannerScreen}>
      <View style={styles.aiMapArea}>
        <KakaoMapView
          pins={mapPins}
          currentLocation={currentLocation}
          height={SCREEN_HEIGHT}
          pathColor="#7B61FF"
        />

        <HomeTopBar
          query={aiSearchTerm}
          results={[]}
          searchFocused={isAiTopBarFocused}
          isSearching={loading}
          tripTitle="나의 여행"
          onChangeQuery={setAiSearchTerm}
          onFocusSearch={() => {
            if (!isAiExiting) setIsAiTopBarFocused(true);
          }}
          // 뒤로가기는 검색창을 홈 기본 폭으로 축소한 뒤 AI 오버레이를 닫습니다.
          onBlurSearch={handleAiBackToHome}
          onSubmitSearch={() => undefined}
          onSelectResult={() => undefined}
          onClearSearch={() => setAiSearchTerm("")}
          onPressMyTrip={() => undefined}
          onPressCategory={(category) => {
            if (category === "AI") void onRefresh();
          }}
        />

        <View pointerEvents="none" style={styles.aiLocationPill}>
          <View style={styles.aiLocationDot} />
          <Text style={styles.aiLocationPillText}>
            {currentLocation
              ? "현재 위치 기준으로 가까운 순"
              : "위치 연결 전 · 예시 코스"}
          </Text>
        </View>
      </View>

      <Animated.View
        style={[
          styles.aiPlannerSheet,
          {
            top: SHEET_EXPANDED_TOP_OFFSET,
            height: SCREEN_HEIGHT - SHEET_EXPANDED_TOP_OFFSET,
            transform: [{ translateY: aiSheetTranslateY }],
          },
        ]}
      >
        <View
          {...aiSheetHandlePanResponder.panHandlers}
          hitSlop={{ top: 10, bottom: 10, left: 40, right: 40 }}
          style={styles.aiSheetHandleArea}
        >
          <View style={styles.aiSheetHandle} />
        </View>
        <View
          {...aiSheetContentPanResponder.panHandlers}
          style={styles.aiSheetContentWrapper}
        >
          <View style={styles.aiSheetTitleRow}>
            <View style={styles.aiSheetTitleArea}>
              <Text style={styles.aiSheetTitle}>오늘의 추천 동선</Text>
              <Text style={styles.aiSheetDescription}>
                {currentLocation
                  ? "이동 거리와 시간대에 맞춰 AI가 순서를 정했어요."
                  : "위치 권한을 연결하면 실제 주변 장소로 자동 갱신돼요."}
              </Text>
            </View>
            <View style={styles.aiRouteSummary}>
              <Ionicons name="navigate" size={15} color="#6A4CF5" />
              <Text style={styles.aiRouteSummaryText}>{places.length}곳</Text>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.aiFilterRow}
            style={styles.aiFilterScroll}
          >
            {filters.map((item) => {
              const selected = filter === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => setFilter(item.id)}
                  style={[
                    styles.aiFilterChip,
                    selected && styles.aiFilterChipSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.aiFilterText,
                      selected && styles.aiFilterTextSelected,
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {loading ? (
            <View style={styles.aiLoadingState}>
              <View style={styles.aiLoadingPulse} />
              <Text style={styles.aiLoadingTitle}>
                내 주변 장소를 살펴보고 있어요
              </Text>
              <Text style={styles.aiLoadingText}>
                이동 거리가 짧은 순으로 일정 후보를 정리하는 중입니다.
              </Text>
            </View>
          ) : visiblePlaces.length > 0 ? (
            <ScrollView
              style={styles.aiPlaceList}
              contentContainerStyle={styles.aiPlaceListContent}
              showsVerticalScrollIndicator={false}
              onScroll={(event) => {
                aiSheetScrollOffsetRef.current =
                  event.nativeEvent.contentOffset.y;
              }}
              scrollEventThrottle={16}
            >
              {visiblePlaces.map((place, index) => {
                const kind = getAiPlaceKind(place);
                const selected = selectedIds.includes(place.id);
                const routeOrder =
                  places.findIndex((item) => item.id === place.id) + 1;

                return (
                  <Pressable
                    key={place.id}
                    onPress={() => onTogglePlace(place.id)}
                    style={({ pressed }) => [
                      styles.aiPlaceCard,
                      selected && styles.aiPlaceCardSelected,
                      pressed && styles.aiPlaceCardPressed,
                    ]}
                  >
                    <View
                      style={[
                        styles.aiPlaceOrder,
                        selected && styles.aiPlaceOrderSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.aiPlaceOrderText,
                          selected && styles.aiPlaceOrderTextSelected,
                        ]}
                      >
                        {routeOrder}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.aiPlaceTypeIcon,
                        { backgroundColor: kind.softColor },
                      ]}
                    >
                      <Ionicons name={kind.icon} size={22} color={kind.color} />
                    </View>

                    <View style={styles.aiPlaceTextArea}>
                      <View style={styles.aiPlaceTitleRow}>
                        <Text numberOfLines={1} style={styles.aiPlaceTitle}>
                          {place.title}
                        </Text>
                        <View
                          style={[
                            styles.aiPlaceKindTag,
                            { backgroundColor: kind.softColor },
                          ]}
                        >
                          <Text
                            style={[
                              styles.aiPlaceKindText,
                              { color: kind.color },
                            ]}
                          >
                            {kind.label}
                          </Text>
                        </View>
                      </View>
                      <Text numberOfLines={1} style={styles.aiPlaceSubtitle}>
                        {place.subtitle}
                      </Text>
                      <View style={styles.aiPlaceMetaRow}>
                        <Ionicons
                          name="walk-outline"
                          size={14}
                          color={COLORS.textSecondary}
                        />
                        <Text style={styles.aiPlaceMetaText}>
                          현재 위치에서 {formatPlaceDistance(place.distance)}
                        </Text>
                      </View>
                    </View>

                    <View
                      style={[
                        styles.aiSelectButton,
                        selected && styles.aiSelectButtonSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.aiSelectButtonText,
                          selected && styles.aiSelectButtonTextSelected,
                        ]}
                      >
                        {selected ? "담김" : "선택"}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : (
            <View style={styles.aiEmptyState}>
              <Ionicons
                name="compass-outline"
                size={35}
                color={COLORS.textSecondary}
              />
              <Text style={styles.aiEmptyTitle}>추천할 장소가 없어요</Text>
              <Text style={styles.aiEmptyText}>
                다시 검색해 주변 장소를 불러와 주세요.
              </Text>
            </View>
          )}

          <View style={styles.aiPlannerFooter}>
            <Text style={styles.aiSelectionCaption}>
              {selectedIds.length > 0
                ? `선택한 ${selectedIds.length}곳을 내 일정에 저장할 수 있어요`
                : "장소를 선택하면 내 일정에 추가할 수 있어요"}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="선택한 장소를 내 일정에 추가하기"
              disabled={selectedIds.length === 0}
              onPress={onApplyPlan}
              style={({ pressed }) => [
                styles.aiApplyButton,
                selectedIds.length === 0 && styles.aiApplyButtonDisabled,
                pressed &&
                  selectedIds.length > 0 &&
                  styles.aiApplyButtonPressed,
              ]}
            >
              <Ionicons name="calendar-outline" size={19} color="#FFFFFF" />
              <Text style={styles.aiApplyButtonText}>
                {selectedIds.length > 0
                  ? `선택한 ${selectedIds.length}곳 일정에 추가`
                  : "일정에 추가"}
              </Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

type AiPlanConfirmModalProps = {
  visible: boolean;
  tripName: string;
  places: SearchResultItem[];
  saving: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

function AiPlanConfirmModal({
  visible,
  tripName,
  places,
  saving,
  onClose,
  onConfirm,
}: AiPlanConfirmModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={saving ? undefined : onClose}
    >
      <Pressable
        style={styles.aiConfirmBackdrop}
        onPress={saving ? undefined : onClose}
      >
        <Pressable style={styles.aiConfirmSheet} onPress={() => undefined}>
          <View style={styles.aiConfirmHandle} />
          <View style={styles.aiConfirmIcon}>
            <Ionicons name="calendar-outline" size={25} color="#6A4CF5" />
          </View>
          <Text style={styles.aiConfirmTitle}>내 일정에 추가할까요?</Text>
          <Text style={styles.aiConfirmDescription}>
            {tripName} 여행의 일정에 선택한 장소를 순서대로 저장합니다.
          </Text>

          <View style={styles.aiConfirmList}>
            {places.map((place, index) => (
              <View key={place.id} style={styles.aiConfirmPlaceRow}>
                <View style={styles.aiConfirmOrder}>
                  <Text style={styles.aiConfirmOrderText}>{index + 1}</Text>
                </View>
                <View style={styles.aiConfirmPlaceTextArea}>
                  <Text numberOfLines={1} style={styles.aiConfirmPlaceTitle}>
                    {place.title}
                  </Text>
                  <Text numberOfLines={1} style={styles.aiConfirmPlaceSubtitle}>
                    {place.category} · {formatPlaceDistance(place.distance)}
                  </Text>
                </View>
                <Ionicons name="checkmark-circle" size={20} color="#7B61FF" />
              </View>
            ))}
          </View>

          <View style={styles.aiConfirmActionRow}>
            <Pressable
              disabled={saving}
              onPress={onClose}
              style={({ pressed }) => [
                styles.aiConfirmCancelButton,
                pressed && !saving && styles.aiConfirmButtonPressed,
              ]}
            >
              <Text style={styles.aiConfirmCancelText}>더 고르기</Text>
            </Pressable>
            <Pressable
              disabled={saving}
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.aiConfirmSaveButton,
                saving && styles.aiConfirmSaveButtonDisabled,
                pressed && !saving && styles.aiConfirmButtonPressed,
              ]}
            >
              {saving ? (
                <Text style={styles.aiConfirmSaveText}>저장 중...</Text>
              ) : (
                <>
                  <Ionicons name="checkmark" size={19} color="#FFFFFF" />
                  <Text style={styles.aiConfirmSaveText}>일정에 담기</Text>
                </>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function TripHomeScreen() {
  const router = useRouter();
  const currentTrip = useTripStore((state) => state.currentTrip);

  const [currentLocation, setCurrentLocation] =
    useState<KakaoMapCurrentLocation | null>(null);
  const [recordings, setRecordings] = useState<RecordingData[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCategory, setSelectedCategory] =
    useState<Exclude<SearchCategory, "AI"> | null>(null);
  const [categoryResults, setCategoryResults] = useState<SearchResultItem[]>(
    [],
  );
  const [aiPlannerVisible, setAiPlannerVisible] = useState(false);
  const [aiPlanPlaces, setAiPlanPlaces] = useState<SearchResultItem[]>([]);
  const [aiPlanSelectedIds, setAiPlanSelectedIds] = useState<string[]>([]);
  const [aiRoutePins, setAiRoutePins] = useState<KakaoMapPin[]>([]);
  const [aiPlanConfirmVisible, setAiPlanConfirmVisible] = useState(false);
  const [isAiPlanSaving, setIsAiPlanSaving] = useState(false);

  // 활성 여행이 바뀔 때마다(전환/새 여행 생성 포함) 지도 핀·오늘의 순간들을
  // 그 여행의 실제 클립 데이터로 다시 채웁니다.
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
          console.error("[HomeScreen] 클립을 불러오지 못했습니다.", error);
          if (isActive) setRecordings([]);
        }
      })();

      return () => {
        isActive = false;
      };
    }, [currentTrip?.id]),
  );

  const routePins = buildRoutePins(recordings);
  const todayMoments = buildTodayMoments(recordings);

  const mapKakaoPlace = (place: any): SearchResultItem => ({
    id: String(place.id),
    title: place.place_name ?? "이름 없는 장소",
    subtitle:
      place.road_address_name ||
      place.address_name ||
      place.category_name ||
      "주소 정보 없음",
    latitude: Number(place.y),
    longitude: Number(place.x),
    category: place.category_group_name || place.category_name || "장소",
    distance: place.distance ? Number(place.distance) : undefined,
  });

  const searchCategoryAround = async (
    categoryCode: Exclude<SearchCategory, "AI">,
    size = 15,
    radius = 3000,
  ): Promise<SearchResultItem[]> => {
    const apiKey = process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY;

    if (!apiKey || !currentLocation) {
      return [];
    }

    const params = new URLSearchParams({
      category_group_code: categoryCode,
      x: String(currentLocation.lng),
      y: String(currentLocation.lat),
      radius: String(radius),
      sort: "distance",
      size: String(size),
    });

    const response = await fetch(
      `https://dapi.kakao.com/v2/local/search/category.json?${params.toString()}`,
      {
        headers: {
          Authorization: `KakaoAK ${apiKey}`,
        },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        "[HomeScreen] 카테고리 검색 실패:",
        response.status,
        errorText,
      );
      return [];
    }

    const data = await response.json();
    return (data.documents ?? []).map(mapKakaoPlace);
  };

  const handleCategorySearch = async (
    category: Exclude<SearchCategory, "AI">,
  ) => {
    if (!currentLocation) {
      Alert.alert("위치 확인 중", "현재 위치를 가져온 뒤 다시 시도해주세요.");
      return;
    }

    // 같은 태그를 다시 누르면 선택을 해제하고 목록을 비웁니다(토글).
    if (selectedCategory === category) {
      setSelectedCategory(null);
      setCategoryResults([]);
      return;
    }

    try {
      setIsSearching(true);
      setSelectedCategory(category);

      const places = await searchCategoryAround(category);
      setCategoryResults(places);
    } catch (error) {
      console.error("[HomeScreen] 카테고리 검색 실패:", error);
      Alert.alert("검색 실패", "주변 장소를 불러오지 못했습니다.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleAIRecommendation = async () => {
    // 지도 또는 위치 연결과 무관하게 추천 화면은 즉시 열립니다.
    setAiPlannerVisible(true);
    setAiPlanPlaces([]);
    setAiPlanSelectedIds([]);

    // 위치를 아직 받지 못한 경우에도 빈 화면 대신 예시 일정으로 흐름을 보여줍니다.
    if (!currentLocation) {
      const fallbackPlan = buildFallbackAiPlan(null);
      setAiPlanPlaces(fallbackPlan);
      setAiPlanSelectedIds(fallbackPlan.map((place) => place.id));
      setIsSearching(false);
      return;
    }

    try {
      setIsSearching(true);

      const [food, cafe] = await Promise.all([
        searchCategoryAround("FD6", 10, 3000),
        searchCategoryAround("CE7", 10, 3000),
      ]);

      const apiKey = process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY;
      let attractions: SearchResultItem[] = [];

      if (apiKey) {
        const params = new URLSearchParams({
          query: "관광명소",
          x: String(currentLocation.lng),
          y: String(currentLocation.lat),
          radius: "5000",
          sort: "distance",
          size: "10",
        });

        const response = await fetch(
          `https://dapi.kakao.com/v2/local/search/keyword.json?${params.toString()}`,
          {
            headers: {
              Authorization: `KakaoAK ${apiKey}`,
            },
          },
        );

        if (response.ok) {
          const data = await response.json();
          attractions = (data.documents ?? []).map(mapKakaoPlace);
        }
      }

      const hour = new Date().getHours();

      const merged = [...food, ...cafe, ...attractions].filter(
        (item, index, array) =>
          array.findIndex((other) => other.id === item.id) === index,
      );

      const recommended = merged
        .map((place) => {
          const distance = place.distance ?? 5000;
          let score = Math.max(0, 100 - distance / 40);
          const category = place.category.toLowerCase();

          if (hour >= 11 && hour <= 14 && category.includes("음식")) {
            score += 35;
          }

          if (hour >= 14 && hour <= 18 && category.includes("카페")) {
            score += 28;
          }

          if (hour >= 18 && hour <= 21 && category.includes("음식")) {
            score += 30;
          }

          if (
            category.includes("관광") ||
            place.title.includes("공원") ||
            place.title.includes("박물관") ||
            place.title.includes("미술관")
          ) {
            score += 18;
          }

          return { place, score };
        })
        // 추천 점수는 동률을 보정하는 용도이며, 기본 순서는 현재 위치와의 거리입니다.
        .sort((a, b) => {
          const distanceA = a.place.distance ?? Number.MAX_SAFE_INTEGER;
          const distanceB = b.place.distance ?? Number.MAX_SAFE_INTEGER;
          return distanceA - distanceB || b.score - a.score;
        })
        .slice(0, 8)
        .map(({ place }) => place);

      const planPlaces =
        recommended.length > 0
          ? recommended
          : buildFallbackAiPlan(currentLocation);

      setAiPlanPlaces(planPlaces);
      // 가까운 세 곳을 우선 선택해 첫 화면부터 하나의 일정처럼 제안합니다.
      setAiPlanSelectedIds(planPlaces.slice(0, 3).map((place) => place.id));
    } catch (error) {
      console.error("[HomeScreen] AI 추천 실패:", error);
      // 네트워크·지도 연결 실패여도 화면을 닫지 않고 예시 코스로 대체합니다.
      const fallbackPlan = buildFallbackAiPlan(currentLocation);
      setAiPlanPlaces(fallbackPlan);
      setAiPlanSelectedIds(fallbackPlan.map((place) => place.id));
    } finally {
      setIsSearching(false);
    }
  };

  const toggleAiPlanPlace = useCallback((placeId: string) => {
    setAiPlanSelectedIds((previous) =>
      previous.includes(placeId)
        ? previous.filter((id) => id !== placeId)
        : [...previous, placeId],
    );
  }, []);

  const applyAiPlan = useCallback(() => {
    if (!currentTrip) {
      Alert.alert(
        "여행을 먼저 선택해주세요",
        "상단의 나의 여행 버튼에서 일정을 담을 여행을 선택할 수 있어요.",
      );
      return;
    }

    const selectedPlaces = aiPlanPlaces.filter((place) =>
      aiPlanSelectedIds.includes(place.id),
    );

    if (selectedPlaces.length === 0) return;
    setAiPlanConfirmVisible(true);
  }, [aiPlanPlaces, aiPlanSelectedIds, currentTrip]);

  const confirmAiPlan = useCallback(async () => {
    if (!currentTrip || isAiPlanSaving) return;

    const selectedPlaces = aiPlanPlaces.filter((place) =>
      aiPlanSelectedIds.includes(place.id),
    );
    if (selectedPlaces.length === 0) return;

    try {
      setIsAiPlanSaving(true);
      await appendTripScheduleStops(
        currentTrip.id,
        selectedPlaces.map((place) => ({
          source: "ai-recommendation" as const,
          placeId: place.id,
          title: place.title,
          address: place.subtitle,
          category: place.category,
          latitude: place.latitude,
          longitude: place.longitude,
          distanceFromPreviousMeters: place.distance,
        })),
      );

      setAiRoutePins(
        selectedPlaces.map((place, index) => ({
          id: `saved-ai-route-${place.id}`,
          label: String(index + 1),
          lat: place.latitude,
          lng: place.longitude,
        })),
      );
      setAiPlanConfirmVisible(false);
      setAiPlannerVisible(false);

      // MyRoute가 이미 열려 있어도 일정 탭을 강제합니다.
      router.navigate({
        pathname: "/(tabs)/my-route",
        params: { view: "schedule", saved: String(Date.now()) },
      });
    } catch (error) {
      console.error("[HomeScreen] AI 추천 일정 저장 실패:", error);
      Alert.alert(
        "일정 저장 실패",
        "일정을 저장하지 못했습니다. 다시 시도해주세요.",
      );
    } finally {
      setIsAiPlanSaving(false);
    }
  }, [aiPlanPlaces, aiPlanSelectedIds, currentTrip, isAiPlanSaving, router]);


  const fetchCurrentLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("위치 권한 필요", "설정에서 위치 접근을 허용해주세요.");
        return;
      }

      const { coords } = await Location.getCurrentPositionAsync({});
      setCurrentLocation({ lat: coords.latitude, lng: coords.longitude });
    } catch (error) {
      // 위치는 지도를 보정하는 용도라, 실패해도 화면 자체는 그대로 동작해야 해서
      // 조용히 무시합니다(경로 핀 기준으로 지도가 뜹니다).
      console.warn("현재 위치를 가져오지 못했습니다:", error);
    }
  }, []);

  useEffect(() => {
    void fetchCurrentLocation();
  }, [fetchCurrentLocation]);

  return (
    <View style={styles.screen}>
      {/* 지도는 네모 박스 안에 갇히지 않고 화면 전체 폭을 그대로 채웁니다.
          여행 선택 바/시트는 전부 그 위에 떠 있는 오버레이예요. */}
      <View style={styles.map}>
        <KakaoMapView
          pins={aiRoutePins.length > 0 ? aiRoutePins : routePins}
          currentLocation={currentLocation}
          height={SCREEN_HEIGHT}
          pathColor={COLORS.accent}
        />
      </View>

      <TripSelector />

      <PullUpSheet
        moments={todayMoments}
        selectedCategory={selectedCategory}
        categoryResults={categoryResults}
        isSearchingCategory={isSearching}
        onPressCategory={(category) => void handleCategorySearch(category)}
        onPressCompass={() => void fetchCurrentLocation()}
      />

      <AiRecommendationScreen
        visible={aiPlannerVisible}
        loading={isSearching}
        currentLocation={currentLocation}
        places={aiPlanPlaces}
        selectedIds={aiPlanSelectedIds}
        onExitAnimationComplete={() => setAiPlannerVisible(false)}
        onRefresh={() => void handleAIRecommendation()}
        onTogglePlace={toggleAiPlanPlace}
        onApplyPlan={applyAiPlan}
      />

      <AiPlanConfirmModal
        visible={aiPlanConfirmVisible}
        tripName={getTripDisplayName(currentTrip)}
        places={aiPlanPlaces.filter((place) =>
          aiPlanSelectedIds.includes(place.id),
        )}
        saving={isAiPlanSaving}
        onClose={() => setAiPlanConfirmVisible(false)}
        onConfirm={() => void confirmAiPlan()}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.white,
  },

  // 상단 검색 + 나의 여행 + 빠른 카테고리
  topBarWrapper: {
    position: "absolute",
    top: 54,
    left: 16,
    right: 16,
    // 지도 WebView보다 항상 위에 떠 있고, 터치도 우선 받도록 합니다.
    zIndex: 100,
    elevation: 100,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },
  searchBar: {
    flex: 1,
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 17,
    paddingRight: 15,
    gap: 10,
    // 여행 버튼과 동일한 흰색 표면과 스트로크 규칙을 사용합니다.
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#D8DCE3",
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  searchInput: {
    flex: 1,
    height: "100%",
    paddingVertical: 0,
    fontSize: 16,
    fontWeight: "500",
    color: COLORS.textPrimary,
  },
  searchClearButton: {
    width: 28,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBackButton: {
    width: 28,
    height: 38,
    marginLeft: -6,
    alignItems: "center",
    justifyContent: "center",
  },
  myTripAnimatedWrapper: {
    height: 60,
    overflow: "hidden",
  },
  myTripButton: {
    width: 132,
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    gap: 6,
    // 검색창과 동일한 표면·모서리·스트로크 규칙을 적용합니다.
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#D8DCE3",
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  myTripText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#252A34",
  },
  categoryAnimatedWrapper: {
    overflow: "hidden",
  },
  categoryScroll: {
    marginTop: 10,
  },
  categoryRow: {
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 1,
    paddingRight: 18,
  },
  // 각 항목을 독립된 흰색 칩으로 만들어 복잡한 지도 위에서도 구분합니다.
  categoryButton: {
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.98)",
    borderRadius: 18,
    shadowColor: "#172033",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 5,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#252A34",
  },
  aiIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2.5,
    borderColor: "#FF3CAC",
    alignItems: "center",
    justifyContent: "center",
  },
  aiIconInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FFB13B",
  },
  searchResultPanel: {
    marginTop: 8,
    maxHeight: 410,
    overflow: "hidden",
    backgroundColor: COLORS.white,
    borderRadius: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 9,
  },
  searchResultList: {
    maxHeight: 410,
  },
  searchResultItem: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchResultItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  searchResultItemPressed: {
    backgroundColor: COLORS.surface,
  },
  searchResultIcon: {
    width: 40,
    height: 40,
    marginRight: 11,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.accentTint,
  },
  searchResultTextArea: {
    flex: 1,
    marginRight: 8,
  },
  searchResultTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.textPrimary,
  },
  searchResultSubtitle: {
    marginTop: 3,
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  searchResultMeta: {
    marginTop: 3,
    fontSize: 10,
    fontWeight: "600",
    color: COLORS.accent,
  },
  searchEmpty: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 14,
  },
  searchEmptyText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },

  nearbyPanel: {
    position: "absolute",
    top: 158,
    left: 20,
    right: 20,
    zIndex: 25,
    maxHeight: 320,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    backgroundColor: COLORS.white,
    borderRadius: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 9,
  },
  nearbyHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 10,
  },
  nearbyHeaderTextArea: {
    flex: 1,
  },
  nearbyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.textPrimary,
  },
  nearbySubtitle: {
    marginTop: 3,
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  nearbySectionLabel: {
    marginBottom: 6,
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  nearbyList: {
    maxHeight: 220,
  },
  nearbyItem: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  nearbyItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  nearbyIcon: {
    width: 34,
    height: 34,
    marginRight: 10,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.accentTint,
  },
  nearbyTextArea: {
    flex: 1,
  },
  nearbyItemTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  nearbyItemSubtitle: {
    marginTop: 2,
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  nearbyEmptyText: {
    paddingVertical: 14,
    fontSize: 12,
    color: COLORS.textSecondary,
  },

  // 지도
  map: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    // 시트가 아래로 내려가도 지도가 화면 전체를 계속 채웁니다.
    height: SCREEN_HEIGHT,
    backgroundColor: COLORS.surface,
    overflow: "hidden",
  },
  // 현재 위치로 지도를 되돌리는 나침반 버튼. PullUpSheet의 translateY를
  // 그대로 공유해서(같은 Animated.Value), 시트를 어디까지 끌어올리든
  // 항상 시트 맨 위 가장자리보다 위에 떠 있습니다. top 값은 시트가 완전히
  // 펼쳐졌을 때(translateY=0) 기준 위치입니다.
  compassButtonWrapper: {
    position: "absolute",
    right: 16,
    top: SHEET_EXPANDED_TOP_OFFSET - 44 - 16,
    zIndex: 5,
  },
  compassButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },

  // 바텀시트
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 8,
  },
  sheetHandleArea: {
    paddingVertical: 12,
    alignItems: "center",
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.textPrimary,
  },
  sectionLink: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },

  // 오늘의 순간들
  momentRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  cardContainer: {
    alignItems: 'center',
    width: 80,
  },
  momentThumb: {
    width: 81,
    height: 81,
    borderRadius: 40.5,
    borderWidth: 2.7,
    borderColor: COLORS.accent,
    position: 'relative',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    borderRadius: 32.4,
  },
  placeholderThumb: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E0E0E0',
    borderRadius: 32.4,
  },
  playButtonOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 42,
    backgroundColor: "rgba(0,0,0,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  recBadge: {
    position: "absolute",
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
    fontWeight: "800",
    color: COLORS.white,
  },
  durationBadge: {
    position: "absolute",
    bottom: 6,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
    zIndex: 2,
  },
  durationBadgeText: {
    fontSize: 9,
    color: COLORS.white,
    fontWeight: "600",
  },
  momentCaption: {
    marginTop: 6,
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: "center",
    width: 84,
  },
  emptyMomentsText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    paddingVertical: 20,
  },

  // 추천 장소
  placeRow: {
    marginTop: 16,
    flexDirection: "row",
    gap: 12,
  },
  placeCard: {
    flex: 1,
  },
  placeImagePlaceholder: {
    height: 90,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  placePinBadge: {
    position: "absolute",
    bottom: 8,
    left: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  placeName: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },

  // 추천 장소 아래 카테고리 태그(주유소/음식점/카페/편의점) — 원래 검색창
  // 포커스 시에만 보이던 태그들을 바텀시트 쪽으로 옮겨왔습니다.
  categoryTagRow: {
    marginTop: 5,
    flexDirection: "row",
    gap: 8,
  },
  categoryTagButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
  },
  categoryTagButtonSelected: {
    backgroundColor: COLORS.accent,
  },
  categoryTagText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  categoryTagTextSelected: {
    color: COLORS.white,
  },
  categoryResultList: {
    marginTop: 12,
  },
  categoryResultItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  categoryResultItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  categoryResultIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.accentTint,
  },
  categoryResultTextArea: {
    flex: 1,
  },
  categoryResultTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  categoryResultSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: COLORS.textSecondary,
  },

  // 여행 선택 모달
  tripModalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.32)",
  },
  tripModalCard: {
    maxHeight: "68%",
    minHeight: 280,
    paddingHorizontal: 28,
    paddingTop: 12,
    paddingBottom: 28,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  tripModalHandle: {
    alignSelf: "center",
    width: 62,
    height: 6,
    marginBottom: 24,
    borderRadius: 3,
    backgroundColor: COLORS.border,
  },
  tripModalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  tripModalTitle: {
    fontSize: 23,
    fontWeight: "800",
    color: COLORS.textPrimary,
  },
  tripModalSubtitle: {
    marginTop: 6,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  tripModalClose: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  tripModalList: {
    maxHeight: 280,
  },
  tripOption: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 16,
  },
  tripOptionSelected: {
    backgroundColor: COLORS.accentTint,
  },
  tripOptionPressed: {
    opacity: 0.65,
  },
  tripOptionIcon: {
    width: 48,
    height: 48,
    marginRight: 14,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surface,
  },
  tripOptionIconSelected: {
    backgroundColor: "#FFE4DC",
  },
  tripOptionTextArea: {
    flex: 1,
  },
  tripOptionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  tripOptionTitleSelected: {
    color: COLORS.accent,
  },
  tripOptionSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  newTripButton: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    paddingHorizontal: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  newTripIcon: {
    width: 48,
    height: 48,
    marginRight: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surface,
  },
  newTripText: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textSecondary,
  },

  // AI 근접 일정 추천 화면
  aiPlannerScreen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.white,
    elevation: 300,
    zIndex: 300,
  },
  aiMapArea: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
    backgroundColor: "#EAF3F1",
  },
  // 홈 화면과 동일한 표면·테두리 규칙을 쓰는 AI 추천 검색창입니다.
  aiSearchBar: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#D8DCE3",
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: "row",
    height: 60,
    left: 16,
    paddingHorizontal: 12,
    position: "absolute",
    right: 16,
    top: 54,
  },
  aiSearchBackButton: {
    alignItems: "center",
    height: 40,
    justifyContent: "center",
    width: 34,
  },
  aiSearchInput: {
    color: COLORS.textPrimary,
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    height: "100%",
    marginLeft: 4,
  },
  aiSearchActionButton: {
    alignItems: "center",
    height: 40,
    justifyContent: "center",
    width: 36,
  },
  aiLocationPill: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "rgba(34,34,34,0.88)",
    borderRadius: 18,
    bottom: 26,
    flexDirection: "row",
    paddingHorizontal: 13,
    paddingVertical: 9,
    position: "absolute",
  },
  aiLocationDot: {
    backgroundColor: "#8D78FF",
    borderColor: "#FFFFFF",
    borderRadius: 5,
    borderWidth: 2,
    height: 10,
    marginRight: 7,
    width: 10,
  },
  aiLocationPillText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  aiPlannerSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    left: 0,
    position: "absolute",
    right: 0,
  },
  aiSheetHandleArea: {
    alignItems: "center",
    paddingVertical: 12,
  },
  aiSheetHandle: {
    backgroundColor: "#D9D9D9",
    borderRadius: 3,
    height: 5,
    width: 48,
  },
  aiSheetContentWrapper: {
    flex: 1,
  },
  aiSheetTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 15,
    paddingHorizontal: 20,
  },
  aiSheetTitleArea: {
    flex: 1,
    paddingRight: 12,
  },
  aiSheetTitle: {
    color: COLORS.textPrimary,
    fontSize: 21,
    fontWeight: "800",
  },
  aiSheetDescription: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 5,
  },
  aiRouteSummary: {
    alignItems: "center",
    backgroundColor: "#F1EEFF",
    borderRadius: 15,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  aiRouteSummaryText: {
    color: "#6047E6",
    fontSize: 12,
    fontWeight: "800",
  },
  aiFilterScroll: {
    flexGrow: 0,
    marginTop: 16,
  },
  aiFilterRow: {
    gap: 8,
    paddingHorizontal: 20,
    paddingRight: 30,
  },
  aiFilterChip: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E3E5E8",
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  aiFilterChipSelected: {
    backgroundColor: "#F1EEFF",
    borderColor: "#8D78FF",
  },
  aiFilterText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: "700",
  },
  aiFilterTextSelected: {
    color: "#6047E6",
  },
  aiPlaceList: {
    // 기본 시트 위치에서도 확정 버튼이 화면 안에 바로 보이도록 목록 높이를 제한합니다.
    flexGrow: 0,
    flexShrink: 1,
    marginTop: 14,
    maxHeight: 330,
  },
  aiPlaceListContent: {
    gap: 10,
    paddingBottom: 12,
    paddingHorizontal: 20,
  },
  aiPlaceCard: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#E9EAED",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 91,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  aiPlaceCardSelected: {
    backgroundColor: "#FBFAFF",
    borderColor: "#9B88FF",
  },
  aiPlaceCardPressed: {
    opacity: 0.74,
  },
  aiPlaceOrder: {
    alignItems: "center",
    backgroundColor: "#F1F2F4",
    borderRadius: 12,
    height: 24,
    justifyContent: "center",
    marginRight: 9,
    width: 24,
  },
  aiPlaceOrderSelected: {
    backgroundColor: "#7B61FF",
  },
  aiPlaceOrderText: {
    color: "#737780",
    fontSize: 12,
    fontWeight: "800",
  },
  aiPlaceOrderTextSelected: {
    color: "#FFFFFF",
  },
  aiPlaceTypeIcon: {
    alignItems: "center",
    borderRadius: 16,
    height: 48,
    justifyContent: "center",
    marginRight: 11,
    width: 48,
  },
  aiPlaceTextArea: {
    flex: 1,
    minWidth: 0,
  },
  aiPlaceTitleRow: {
    alignItems: "center",
    flexDirection: "row",
  },
  aiPlaceTitle: {
    color: COLORS.textPrimary,
    flexShrink: 1,
    fontSize: 15,
    fontWeight: "800",
  },
  aiPlaceKindTag: {
    borderRadius: 9,
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  aiPlaceKindText: {
    fontSize: 9,
    fontWeight: "800",
  },
  aiPlaceSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 4,
  },
  aiPlaceMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    marginTop: 6,
  },
  aiPlaceMetaText: {
    color: "#747881",
    fontSize: 11,
    marginLeft: 4,
  },
  aiSelectButton: {
    alignItems: "center",
    backgroundColor: "#F4F4F5",
    borderRadius: 15,
    justifyContent: "center",
    marginLeft: 8,
    minWidth: 48,
    paddingHorizontal: 9,
    paddingVertical: 8,
  },
  aiSelectButtonSelected: {
    backgroundColor: "#7B61FF",
  },
  aiSelectButtonText: {
    color: "#676B73",
    fontSize: 11,
    fontWeight: "800",
  },
  aiSelectButtonTextSelected: {
    color: "#FFFFFF",
  },
  aiLoadingState: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  aiLoadingPulse: {
    backgroundColor: "#EDE9FF",
    borderColor: "#9B88FF",
    borderRadius: 24,
    borderWidth: 7,
    height: 48,
    marginBottom: 15,
    width: 48,
  },
  aiLoadingTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: "800",
  },
  aiLoadingText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 19,
    marginTop: 7,
    textAlign: "center",
  },
  aiEmptyState: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  aiEmptyTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: "800",
    marginTop: 10,
  },
  aiEmptyText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 6,
  },
  aiPlannerFooter: {
    backgroundColor: "#FFFFFF",
    borderTopColor: "#EEF0F2",
    borderTopWidth: 1,
    flexShrink: 0,
    paddingBottom: 18,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  aiSelectionCaption: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginBottom: 9,
    textAlign: "center",
  },
  aiApplyButton: {
    alignItems: "center",
    backgroundColor: "#7B61FF",
    borderRadius: 15,
    flexDirection: "row",
    gap: 7,
    height: 50,
    justifyContent: "center",
  },
  aiApplyButtonDisabled: {
    backgroundColor: "#C8C3E6",
  },
  aiApplyButtonPressed: {
    opacity: 0.76,
  },
  aiApplyButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },

  // AI 추천 장소 확정 및 내 일정 저장 모달
  aiConfirmBackdrop: {
    alignItems: "center",
    backgroundColor: "rgba(20, 20, 24, 0.36)",
    flex: 1,
    justifyContent: "flex-end",
    padding: 16,
  },
  aiConfirmSheet: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    maxWidth: 520,
    paddingBottom: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
    width: "100%",
  },
  aiConfirmHandle: {
    alignSelf: "center",
    backgroundColor: "#D9D9D9",
    borderRadius: 3,
    height: 5,
    width: 46,
  },
  aiConfirmIcon: {
    alignItems: "center",
    backgroundColor: "#F1EEFF",
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    marginTop: 16,
    width: 44,
  },
  aiConfirmTitle: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontWeight: "800",
    marginTop: 12,
  },
  aiConfirmDescription: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
  },
  aiConfirmList: {
    backgroundColor: "#FAFAFC",
    borderColor: "#ECECF1",
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  aiConfirmPlaceRow: {
    alignItems: "center",
    borderBottomColor: "#ECECF1",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    minHeight: 58,
  },
  aiConfirmOrder: {
    alignItems: "center",
    backgroundColor: "#7B61FF",
    borderRadius: 11,
    height: 22,
    justifyContent: "center",
    marginRight: 10,
    width: 22,
  },
  aiConfirmOrderText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  aiConfirmPlaceTextArea: {
    flex: 1,
    minWidth: 0,
  },
  aiConfirmPlaceTitle: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: "800",
  },
  aiConfirmPlaceSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 3,
  },
  aiConfirmActionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  aiConfirmCancelButton: {
    alignItems: "center",
    backgroundColor: "#F3F3F5",
    borderRadius: 14,
    flex: 1,
    height: 50,
    justifyContent: "center",
  },
  aiConfirmCancelText: {
    color: "#626671",
    fontSize: 14,
    fontWeight: "800",
  },
  aiConfirmSaveButton: {
    alignItems: "center",
    backgroundColor: "#7B61FF",
    borderRadius: 14,
    flex: 1.35,
    flexDirection: "row",
    gap: 7, 
    height: 50,
    justifyContent: "center",
  },
  aiConfirmSaveButtonDisabled: {
    backgroundColor: "#C9C3EA",
  },
  aiConfirmSaveText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  aiConfirmButtonPressed: {
    opacity: 0.74,
  },
});
