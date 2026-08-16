import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    Animated,
    PanResponder,
    Dimensions,
    Modal,
    Pressable,
    Alert,
    TextInput,
    Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import KakaoMapView, {
    KakaoMapPin,
    KakaoMapCurrentLocation,
} from '@/components/KakaoMapView';
import NewTripModal from '@/components/NewTripModal';
import {
    getAllFolders,
    saveFolder,
    type FolderItem,
} from '@/services/folderService';
import {
    selectCurrentTrip,
    useTripStore,
} from '@/store/useTripStore';
import { getRecordingsByFolder } from '@/services/recordingService';
import type { RecordingData } from '@/types/recording';

const COLORS = {
    accent: '#FF7F5C', // Point/Accent — 메인 CTA, 강조 액션
    accentTint: '#FFF3DF', // 프로모션 배지, 태그 배경
    surface: '#F5F5F5', // 카드/섹션 구분용 연한 회색 배경
    white: '#FFFFFF', // 앱 전체 배경
    textPrimary: '#222222',
    textSecondary: '#8A8A8A',
    border: '#DDDDDD',
    record: '#E14D3F',
};

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// 지도 영역이 화면에서 차지하는 높이. 검색바는 이 위에 떠 있고,
// 진행 카드는 이 경계에 걸쳐서 떠 있습니다.
const MAP_HEIGHT = SCREEN_HEIGHT * 0.58;

// 바텀시트가 다 접혔을 때(peek) 화면에 보이는 높이,
// 다 펼쳤을 때(expanded) 화면 상단에서 남겨둘 여백.
const SHEET_PEEK_HEIGHT = SCREEN_HEIGHT * 0.46;
const SHEET_EXPANDED_TOP_OFFSET = 90;

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
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
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

/** 활성 여행의 클립 중 오늘 촬영된 것만 "오늘의 순간들"에 올립니다. */
function buildTodayMoments(recordings: RecordingData[]): ClipMoment[] {
    const todayRecordings = recordings
        .filter((r) => isToday(r.recordedAt))
        .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)); // 최신 촬영이 맨 앞

    return todayRecordings.map((r, index) => ({
        id: r.id,
        durationLabel: formatClipDuration(r.durationMs),
        caption: r.location.placeName ?? '장소 미지정',
        isNew: index === 0,
    }));
}

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



type SearchResultItem = {
    id: string;
    title: string;
    subtitle: string;
    latitude: number;
    longitude: number;
    category: string;
    distance?: number;
};

type SearchCategory = 'AI' | 'OL7' | 'FD6' | 'CE7' | 'CS2';

type HomeTopBarProps = {
    query: string;
    results: SearchResultItem[];
    searchFocused: boolean;
    isSearching: boolean;
    onChangeQuery: (text: string) => void;
    onFocusSearch: () => void;
    onBlurSearch: () => void;
    onSubmitSearch: () => void;
    onSelectResult: (item: SearchResultItem) => void;
    onClearSearch: () => void;
    onPressMyTrip: () => void;
    onPressCategory: (category: SearchCategory) => void;
};

function HomeTopBar({
    query,
    results,
    searchFocused,
    isSearching,
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
        outputRange: [0, 40],
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
                        placeholderTextColor="#8A8A8A"
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
                        <Ionicons
                            name="mic-outline"
                            size={23}
                            color={COLORS.textPrimary}
                        />
                    )}
                </Animated.View>

                <Animated.View
                    pointerEvents={searchFocused ? 'none' : 'auto'}
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
                        <Text style={styles.myTripText}>나의 여행</Text>
                        <Ionicons
                            name="chevron-forward"
                            size={21}
                            color={COLORS.textPrimary}
                        />
                    </TouchableOpacity>
                </Animated.View>
            </View>

            <Animated.View
                pointerEvents={searchFocused ? 'auto' : 'none'}
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
                        onPress={() => onPressCategory('AI')}
                    >
                        <View style={styles.aiIcon}>
                            <View style={styles.aiIconInner} />
                        </View>
                        <Text style={styles.categoryText}>AI추천</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.categoryButton}
                        activeOpacity={0.75}
                        onPress={() => onPressCategory('OL7')}
                    >
                        <Ionicons
                            name="car-sport"
                            size={16}
                            color={COLORS.textPrimary}
                        />
                        <Text style={styles.categoryText}>주유소</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.categoryButton}
                        activeOpacity={0.75}
                        onPress={() => onPressCategory('FD6')}
                    >
                        <Ionicons
                            name="restaurant"
                            size={16}
                            color={COLORS.textPrimary}
                        />
                        <Text style={styles.categoryText}>음식점</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.categoryButton}
                        activeOpacity={0.75}
                        onPress={() => onPressCategory('CE7')}
                    >
                        <Ionicons
                            name="cafe"
                            size={16}
                            color={COLORS.textPrimary}
                        />
                        <Text style={styles.categoryText}>카페</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.categoryButton}
                        activeOpacity={0.75}
                        onPress={() => onPressCategory('CS2')}
                    >
                        <Ionicons
                            name="storefront"
                            size={16}
                            color={COLORS.textPrimary}
                        />
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
                                        <Text
                                            style={styles.searchResultTitle}
                                            numberOfLines={1}
                                        >
                                            {item.title}
                                        </Text>

                                        <Text
                                            style={styles.searchResultSubtitle}
                                            numberOfLines={1}
                                        >
                                            {item.subtitle}
                                        </Text>

                                        <Text
                                            style={styles.searchResultMeta}
                                            numberOfLines={1}
                                        >
                                            {item.category}
                                            {item.distance !== undefined
                                                ? ` · ${item.distance < 1000
                                                    ? `${Math.round(
                                                        item.distance,
                                                    )}m`
                                                    : `${(
                                                        item.distance /
                                                        1000
                                                    ).toFixed(1)}km`
                                                }`
                                                : ''}
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
function PullUpSheet({ moments }: { moments: ClipMoment[] }) {
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
                        {moments.length > 0 ? (
                            moments.map((moment) => (
                                <MomentThumbnail key={moment.id} moment={moment} />
                            ))
                        ) : (
                            <Text style={styles.emptyMomentsText}>
                                오늘 촬영한 클립이 아직 없어요
                            </Text>
                        )}
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


function getTripDisplayName(trip: FolderItem | null): string {
    if (!trip) return '여행 선택';

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

type TripSelectorModalProps = {
    visible: boolean;
    trips: FolderItem[];
    currentTrip: FolderItem | null;
    onSelect: (trip: FolderItem) => void | Promise<void>;
    onClose: () => void;
    onCreateTrip: () => void;
};

function TripSelectorModal({
    visible,
    trips,
    currentTrip,
    onSelect,
    onClose,
    onCreateTrip,
}: TripSelectorModalProps) {
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <Pressable style={styles.tripModalBackdrop} onPress={onClose}>
                <Pressable
                    style={styles.tripModalCard}
                    onPress={(event) => event.stopPropagation()}
                >
                    <View style={styles.tripModalHandle} />

                    <View style={styles.tripModalHeader}>
                        <View>
                            <Text style={styles.tripModalTitle}>여행 선택</Text>
                            <Text style={styles.tripModalSubtitle}>
                                확인하거나 기록할 여행을 선택해주세요.
                            </Text>
                        </View>

                        <Pressable
                            hitSlop={10}
                            onPress={onClose}
                            style={styles.tripModalClose}
                        >
                            <Ionicons
                                name="close"
                                size={21}
                                color={COLORS.textSecondary}
                            />
                        </Pressable>
                    </View>

                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        style={styles.tripModalList}
                    >
                        {trips.map((trip) => {
                            const selected = currentTrip?.id === trip.id;

                            return (
                                <Pressable
                                    key={trip.id}
                                    onPress={() => void onSelect(trip)}
                                    style={({ pressed }) => [
                                        styles.tripOption,
                                        selected && styles.tripOptionSelected,
                                        pressed && styles.tripOptionPressed,
                                    ]}
                                >
                                    <View
                                        style={[
                                            styles.tripOptionIcon,
                                            selected && styles.tripOptionIconSelected,
                                        ]}
                                    >
                                        <Ionicons
                                            name="airplane"
                                            size={20}
                                            color={
                                                selected ? COLORS.accent : COLORS.textSecondary
                                            }
                                        />
                                    </View>

                                    <View style={styles.tripOptionTextArea}>
                                        <Text
                                            numberOfLines={1}
                                            style={[
                                                styles.tripOptionTitle,
                                                selected && styles.tripOptionTitleSelected,
                                            ]}
                                        >
                                            {getTripDisplayName(trip)}
                                        </Text>
                                        <Text style={styles.tripOptionSubtitle}>
                                            여행 기록 보기
                                        </Text>
                                    </View>

                                    {selected ? (
                                        <Ionicons
                                            name="checkmark-circle"
                                            size={23}
                                            color={COLORS.accent}
                                        />
                                    ) : (
                                        <Ionicons
                                            name="chevron-forward"
                                            size={19}
                                            color={COLORS.textSecondary}
                                        />
                                    )}
                                </Pressable>
                            );
                        })}
                    </ScrollView>

                    <Pressable
                        style={({ pressed }) => [
                            styles.newTripButton,
                            pressed && styles.tripOptionPressed,
                        ]}
                        onPress={onCreateTrip}
                    >
                        <View style={styles.newTripIcon}>
                            <Ionicons
                                name="add"
                                size={22}
                                color={COLORS.textSecondary}
                            />
                        </View>
                        <Text style={styles.newTripText}>새 여행</Text>
                    </Pressable>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

export default function TripHomeScreen() {
    const currentTrip = useTripStore((state) => state.currentTrip);

    const [elapsedSeconds] = useState(204); // 00:03:24 예시 값. 실제로는 타이머 state로 관리.
    const [currentLocation, setCurrentLocation] =
        useState<KakaoMapCurrentLocation | null>(null);
    const [recordings, setRecordings] = useState<RecordingData[]>([]);
    const [trips, setTrips] = useState<FolderItem[]>([]);
    const [tripSelectorVisible, setTripSelectorVisible] = useState(false);
    const [newTripModalVisible, setNewTripModalVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchFocused, setSearchFocused] = useState(false);
    const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
    const [nearbyPlaces, setNearbyPlaces] = useState<SearchResultItem[]>([]);
    const [selectedPlace, setSelectedPlace] = useState<SearchResultItem | null>(null);
    const [isSearching, setIsSearching] = useState(false);

    const loadTrips = useCallback(async () => {
        try {
            const folders = await getAllFolders();
            setTrips(folders);
        } catch (error) {
            console.error('[HomeScreen] 여행 목록을 불러오지 못했습니다.', error);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            void loadTrips();
        }, [loadTrips]),
    );

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
                    console.error('[HomeScreen] 클립을 불러오지 못했습니다.', error);
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

    const searchKakaoPlaces = async (
        keyword: string,
    ): Promise<SearchResultItem[]> => {
        const apiKey = process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY;

        if (!apiKey) {
            console.error(
                '[HomeScreen] EXPO_PUBLIC_KAKAO_REST_API_KEY가 설정되지 않았습니다.',
            );
            return [];
        }

        const trimmedKeyword = keyword.trim();

        if (!trimmedKeyword) {
            return [];
        }

        const params = new URLSearchParams({
            query: trimmedKeyword,
            size: '10',
        });

        if (currentLocation) {
            params.append('x', String(currentLocation.lng));
            params.append('y', String(currentLocation.lat));
            params.append('sort', 'distance');
        }

        const response = await fetch(
            `https://dapi.kakao.com/v2/local/search/keyword.json?${params.toString()}`,
            {
                headers: {
                    Authorization: `KakaoAK ${apiKey}`,
                },
            },
        );

        if (!response.ok) {
            const errorText = await response.text();

            console.error(
                '[HomeScreen] 카카오 장소 검색 실패:',
                response.status,
                errorText,
            );

            throw new Error(`카카오 장소 검색 실패: ${response.status}`);
        }

        const data = await response.json();

        return (data.documents ?? []).map((place: any) => ({
            id: String(place.id),
            title: place.place_name ?? '이름 없는 장소',
            subtitle:
                place.road_address_name ||
                place.address_name ||
                place.category_name ||
                '주소 정보 없음',
            latitude: Number(place.y),
            longitude: Number(place.x),
            category:
                place.category_group_name ||
                place.category_name ||
                '장소',
            distance: place.distance ? Number(place.distance) : undefined,
        }));
    };

    const searchNearbyPlaces = async (
        place: SearchResultItem,
    ): Promise<SearchResultItem[]> => {
        const apiKey = process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY;

        if (!apiKey) {
            return [];
        }

        const categoryCodes = ['FD6', 'CE7', 'AT4'];

        const responses = await Promise.all(
            categoryCodes.map(async (categoryCode) => {
                const params = new URLSearchParams({
                    category_group_code: categoryCode,
                    x: String(place.longitude),
                    y: String(place.latitude),
                    radius: '1500',
                    sort: 'distance',
                    size: '5',
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
                    return [];
                }

                const data = await response.json();
                return data.documents ?? [];
            }),
        );

        const flattened = responses.flat();

        const unique = flattened.filter(
            (item: any, index: number, array: any[]) =>
                array.findIndex((other) => other.id === item.id) === index,
        );

        return unique
            .map((item: any) => ({
                id: String(item.id),
                title: item.place_name ?? '이름 없는 장소',
                subtitle:
                    item.road_address_name ||
                    item.address_name ||
                    item.category_name ||
                    '주소 정보 없음',
                latitude: Number(item.y),
                longitude: Number(item.x),
                category:
                    item.category_group_name ||
                    item.category_name ||
                    '장소',
                distance: item.distance ? Number(item.distance) : undefined,
            }))
            .sort(
                (a: SearchResultItem, b: SearchResultItem) =>
                    (a.distance ?? Number.POSITIVE_INFINITY) -
                    (b.distance ?? Number.POSITIVE_INFINITY),
            )
            .filter((item: SearchResultItem) => item.id !== place.id)
            .slice(0, 10);
    };

    const mapKakaoPlace = (place: any): SearchResultItem => ({
        id: String(place.id),
        title: place.place_name ?? '이름 없는 장소',
        subtitle:
            place.road_address_name ||
            place.address_name ||
            place.category_name ||
            '주소 정보 없음',
        latitude: Number(place.y),
        longitude: Number(place.x),
        category:
            place.category_group_name ||
            place.category_name ||
            '장소',
        distance: place.distance ? Number(place.distance) : undefined,
    });

    const searchCategoryAround = async (
        categoryCode: Exclude<SearchCategory, 'AI'>,
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
            sort: 'distance',
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
                '[HomeScreen] 카테고리 검색 실패:',
                response.status,
                errorText,
            );
            return [];
        }

        const data = await response.json();
        return (data.documents ?? []).map(mapKakaoPlace);
    };

    const handleCategorySearch = async (
        category: Exclude<SearchCategory, 'AI'>,
    ) => {
        if (!currentLocation) {
            Alert.alert(
                '위치 확인 중',
                '현재 위치를 가져온 뒤 다시 시도해주세요.',
            );
            return;
        }

        const categoryLabel: Record<
            Exclude<SearchCategory, 'AI'>,
            string
        > = {
            OL7: '주유소',
            FD6: '음식점',
            CE7: '카페',
            CS2: '편의점',
        };

        try {
            setIsSearching(true);
            setSelectedPlace(null);
            setNearbyPlaces([]);
            setSearchFocused(true);
            setSearchQuery(categoryLabel[category]);

            const places = await searchCategoryAround(category);
            setSearchResults(places);
        } catch (error) {
            console.error('[HomeScreen] 카테고리 검색 실패:', error);
            Alert.alert('검색 실패', '주변 장소를 불러오지 못했습니다.');
        } finally {
            setIsSearching(false);
        }
    };

    const handleAIRecommendation = async () => {
        if (!currentLocation) {
            Alert.alert(
                '위치 확인 중',
                '현재 위치를 가져온 뒤 AI 추천을 이용해주세요.',
            );
            return;
        }

        try {
            setIsSearching(true);
            setSelectedPlace(null);
            setNearbyPlaces([]);
            setSearchFocused(true);
            setSearchQuery('AI추천');

            const [food, cafe] = await Promise.all([
                searchCategoryAround('FD6', 10, 3000),
                searchCategoryAround('CE7', 10, 3000),
            ]);

            const apiKey = process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY;
            let attractions: SearchResultItem[] = [];

            if (apiKey) {
                const params = new URLSearchParams({
                    query: '관광명소',
                    x: String(currentLocation.lng),
                    y: String(currentLocation.lat),
                    radius: '5000',
                    sort: 'distance',
                    size: '10',
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

                    if (hour >= 11 && hour <= 14 && category.includes('음식')) {
                        score += 35;
                    }

                    if (hour >= 14 && hour <= 18 && category.includes('카페')) {
                        score += 28;
                    }

                    if (hour >= 18 && hour <= 21 && category.includes('음식')) {
                        score += 30;
                    }

                    if (
                        category.includes('관광') ||
                        place.title.includes('공원') ||
                        place.title.includes('박물관') ||
                        place.title.includes('미술관')
                    ) {
                        score += 18;
                    }

                    return { place, score };
                })
                .sort((a, b) => b.score - a.score)
                .slice(0, 12)
                .map(({ place }) => place);

            setSearchResults(recommended);
        } catch (error) {
            console.error('[HomeScreen] AI 추천 실패:', error);
            Alert.alert('AI 추천 실패', '추천 장소를 불러오지 못했습니다.');
        } finally {
            setIsSearching(false);
        }
    };

    const handleSubmitSearch = async () => {
        const keyword = searchQuery.trim();

        if (!keyword) return;

        try {
            setIsSearching(true);
            setSelectedPlace(null);
            setNearbyPlaces([]);

            const results = await searchKakaoPlaces(keyword);
            setSearchResults(results);
            setSearchFocused(true);

            if (results.length === 0) {
                Alert.alert(
                    '검색 결과 없음',
                    `"${keyword}"에 대한 장소를 찾지 못했습니다.`,
                );
            }
        } catch (error) {
            console.error('[HomeScreen] 검색 실패:', error);
            Alert.alert('검색 실패', '카카오 장소 검색 중 오류가 발생했습니다.');
        } finally {
            setIsSearching(false);
        }
    };

    const handleSelectSearchResult = async (item: SearchResultItem) => {
        try {
            setSearchQuery(item.title);
            setSelectedPlace(item);
            setSearchResults([]);
            setSearchFocused(false);
            Keyboard.dismiss();
            setIsSearching(true);

            const nearby = await searchNearbyPlaces(item);
            setNearbyPlaces(nearby);
        } catch (error) {
            console.error('[HomeScreen] 주변 장소 검색 실패:', error);
            Alert.alert(
                '주변 장소 검색 실패',
                '선택한 장소 주변 정보를 불러오지 못했습니다.',
            );
        } finally {
            setIsSearching(false);
        }
    };

    useEffect(() => {
        let isMounted = true;

        (async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') return;

                const { coords } = await Location.getCurrentPositionAsync({});
                if (isMounted) {
                    setCurrentLocation({ lat: coords.latitude, lng: coords.longitude });
                }
            } catch (error) {
                // 위치는 지도를 보정하는 용도라, 실패해도 화면 자체는 그대로 동작해야 해서
                // 조용히 무시합니다(경로 핀 기준으로 지도가 뜹니다).
                console.warn('현재 위치를 가져오지 못했습니다:', error);
            }
        })();

        return () => {
            isMounted = false;
        };
    }, []);

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
            <View style={styles.map}>
                <KakaoMapView
                    pins={routePins}
                    currentLocation={currentLocation}
                    height={MAP_HEIGHT}
                    pathColor={COLORS.accent}
                />
            </View>

            <HomeTopBar
                query={searchQuery}
                results={searchResults}
                searchFocused={searchFocused}
                isSearching={isSearching}
                onChangeQuery={(value) => {
                    setSearchQuery(value);

                    if (!value.trim()) {
                        setSearchResults([]);
                        setNearbyPlaces([]);
                        setSelectedPlace(null);
                    }
                }}
                onFocusSearch={() => setSearchFocused(true)}
                onBlurSearch={() => {
                    // 결과 항목을 누르는 터치 이벤트가 먼저 처리될 수 있도록 약간 늦게 닫습니다.
                    setTimeout(() => setSearchFocused(false), 150);
                }}
                onSubmitSearch={handleSubmitSearch}
                onSelectResult={handleSelectSearchResult}
                onClearSearch={() => {
                    setSearchQuery('');
                    setSearchResults([]);
                    setNearbyPlaces([]);
                    setSelectedPlace(null);
                    setSearchFocused(true);
                }}
                onPressCategory={(category) => {
                    Keyboard.dismiss();

                    if (category === 'AI') {
                        void handleAIRecommendation();
                        return;
                    }

                    void handleCategorySearch(category);
                }}
                onPressMyTrip={() => {
                    Keyboard.dismiss();
                    setSearchFocused(false);
                    void loadTrips();
                    setTripSelectorVisible(true);
                }}
            />

            {selectedPlace ? (
                <View style={styles.nearbyPanel}>
                    <View style={styles.nearbyHeader}>
                        <View style={styles.nearbyHeaderTextArea}>
                            <Text style={styles.nearbyTitle} numberOfLines={1}>
                                {selectedPlace.title}
                            </Text>
                            <Text style={styles.nearbySubtitle} numberOfLines={1}>
                                {selectedPlace.subtitle}
                            </Text>
                        </View>
                        <Pressable
                            hitSlop={8}
                            onPress={() => {
                                setSelectedPlace(null);
                                setNearbyPlaces([]);
                            }}
                        >
                            <Ionicons
                                name="close"
                                size={20}
                                color={COLORS.textSecondary}
                            />
                        </Pressable>
                    </View>

                    <Text style={styles.nearbySectionLabel}>주변 추천</Text>

                    {isSearching ? (
                        <Text style={styles.nearbyEmptyText}>
                            주변 장소를 불러오는 중이에요...
                        </Text>
                    ) : nearbyPlaces.length > 0 ? (
                        <ScrollView
                            style={styles.nearbyList}
                            showsVerticalScrollIndicator={false}
                        >
                            {nearbyPlaces.map((place, index) => (
                                <Pressable
                                    key={place.id}
                                    onPress={() => {
                                        setSearchQuery(place.title);
                                        setSelectedPlace(place);
                                    }}
                                    style={({ pressed }) => [
                                        styles.nearbyItem,
                                        index !== nearbyPlaces.length - 1 &&
                                        styles.nearbyItemBorder,
                                        pressed && styles.searchResultItemPressed,
                                    ]}
                                >
                                    <View style={styles.nearbyIcon}>
                                        <Ionicons
                                            name="location-outline"
                                            size={18}
                                            color={COLORS.accent}
                                        />
                                    </View>

                                    <View style={styles.nearbyTextArea}>
                                        <Text
                                            style={styles.nearbyItemTitle}
                                            numberOfLines={1}
                                        >
                                            {place.title}
                                        </Text>
                                        <Text
                                            style={styles.nearbyItemSubtitle}
                                            numberOfLines={1}
                                        >
                                            {place.category}
                                            {place.distance !== undefined
                                                ? ` · ${place.distance < 1000
                                                    ? `${Math.round(place.distance)}m`
                                                    : `${(place.distance / 1000).toFixed(1)}km`
                                                }`
                                                : ''}
                                        </Text>
                                    </View>
                                </Pressable>
                            ))}
                        </ScrollView>
                    ) : (
                        <Text style={styles.nearbyEmptyText}>
                            주변 추천 장소가 없어요.
                        </Text>
                    )}
                </View>
            ) : null}

            <View style={styles.progressCardWrapper}>
                {currentTrip ? (
                    <TripProgressCard
                        tripTitle={`${currentTrip.title}을(를) 여행 중`}
                        elapsedLabel={elapsedLabel}
                        onStop={() => {
                            // TODO: 여행 종료 확인 다이얼로그 + 실제 종료 처리 연결
                        }}
                    />
                ) : null}
            </View>

            <PullUpSheet moments={todayMoments} />

            <TripSelectorModal
                visible={tripSelectorVisible}
                trips={trips}
                currentTrip={currentTrip}
                onClose={() => setTripSelectorVisible(false)}
                onSelect={async (trip) => {
                    try {
                        await selectCurrentTrip(trip);
                        setTripSelectorVisible(false);
                    } catch (error) {
                        console.error('[HomeScreen] 여행 변경에 실패했습니다.', error);
                        Alert.alert('여행 변경 실패', '여행을 변경하지 못했습니다.');
                    }
                }}
                onCreateTrip={() => {
                    setTripSelectorVisible(false);
                    setTimeout(() => setNewTripModalVisible(true), 250);
                }}
            />

            <NewTripModal
                visible={newTripModalVisible}
                onClose={() => setNewTripModalVisible(false)}
                onCreated={async (trip) => {
                    const formatDate = (date: Date) => {
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const day = String(date.getDate()).padStart(2, '0');
                        return `${year}.${month}.${day}.`;
                    };

                    const folder: FolderItem = {
                        id: `folder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                        title: trip.name.trim(),
                        dateRange: `${formatDate(trip.startDate)} ~ ${formatDate(trip.endDate)}`,
                        // clipCount: 0,
                        thumbnail: '',
                        region: trip.region,
                        memo: trip.memo,
                        partySize: trip.partySize,
                        themes: trip.themes,
                        clipLengthSeconds: trip.clipLengthSeconds,
                        shootingStyle: trip.shootingStyle,
                        gridTemplateId: trip.gridTemplateId,
                    };

                    try {
                        await saveFolder(folder);
                        await selectCurrentTrip(folder);
                        await loadTrips();
                        setNewTripModalVisible(false);
                    } catch (error) {
                        console.error('[HomeScreen] 새 여행 저장에 실패했습니다.', error);
                        Alert.alert('여행 생성 실패', '새 여행을 저장하지 못했습니다.');
                    }
                }}
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
        position: 'absolute',
        top: 54,
        left: 16,
        right: 16,
        zIndex: 30,
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
    },
    searchBar: {
        flex: 1,
        height: 58,
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: 16,
        paddingRight: 14,
        gap: 10,
        backgroundColor: COLORS.white,
        borderRadius: 22,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#D7D7D7',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.07,
        shadowRadius: 9,
        elevation: 4,
    },
    searchInput: {
        flex: 1,
        height: '100%',
        paddingVertical: 0,
        fontSize: 16,
        fontWeight: '500',
        color: COLORS.textPrimary,
    },
    searchClearButton: {
        width: 28,
        height: 38,
        alignItems: 'center',
        justifyContent: 'center',
    },
    searchBackButton: {
        width: 28,
        height: 38,
        marginLeft: -6,
        alignItems: 'center',
        justifyContent: 'center',
    },
    myTripAnimatedWrapper: {
        height: 58,
        overflow: 'hidden',
    },
    myTripButton: {
        width: 132,
        height: 58,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 14,
        gap: 6,
        backgroundColor: COLORS.white,
        borderRadius: 22,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.07,
        shadowRadius: 9,
        elevation: 4,
    },
    myTripText: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    categoryAnimatedWrapper: {
        overflow: 'hidden',
    },
    categoryScroll: {
        marginTop: 6,
    },
    categoryRow: {
        alignItems: 'center',
        gap: 18,
        paddingHorizontal: 3,
        paddingRight: 18,
    },
    categoryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingVertical: 4,
    },
    categoryText: {
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    aiIcon: {
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 2.5,
        borderColor: '#FF3CAC',
        alignItems: 'center',
        justifyContent: 'center',
    },
    aiIconInner: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#FFB13B',
    },
    searchResultPanel: {
        marginTop: 8,
        maxHeight: 410,
        overflow: 'hidden',
        backgroundColor: COLORS.white,
        borderRadius: 18,
        shadowColor: '#000',
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
        flexDirection: 'row',
        alignItems: 'center',
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
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.accentTint,
    },
    searchResultTextArea: {
        flex: 1,
        marginRight: 8,
    },
    searchResultTitle: {
        fontSize: 14,
        fontWeight: '800',
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
        fontWeight: '600',
        color: COLORS.accent,
    },
    searchEmpty: {
        minHeight: 72,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingHorizontal: 14,
    },
    searchEmptyText: {
        fontSize: 13,
        color: COLORS.textSecondary,
    },

    nearbyPanel: {
        position: 'absolute',
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
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 9,
    },
    nearbyHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 10,
    },
    nearbyHeaderTextArea: {
        flex: 1,
    },
    nearbyTitle: {
        fontSize: 16,
        fontWeight: '800',
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
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    nearbyList: {
        maxHeight: 220,
    },
    nearbyItem: {
        minHeight: 58,
        flexDirection: 'row',
        alignItems: 'center',
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
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.accentTint,
    },
    nearbyTextArea: {
        flex: 1,
    },
    nearbyItemTitle: {
        fontSize: 14,
        fontWeight: '700',
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
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: MAP_HEIGHT,
        backgroundColor: COLORS.surface,
        overflow: 'hidden',
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
    emptyMomentsText: {
        fontSize: 12,
        color: COLORS.textSecondary,
        paddingVertical: 20,
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

    // 여행 선택 모달
    tripModalBackdrop: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.32)',
    },
    tripModalCard: {
        maxHeight: '68%',
        minHeight: 280,
        paddingHorizontal: 28,
        paddingTop: 12,
        paddingBottom: 28,
        backgroundColor: COLORS.white,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
    },
    tripModalHandle: {
        alignSelf: 'center',
        width: 62,
        height: 6,
        marginBottom: 24,
        borderRadius: 3,
        backgroundColor: COLORS.border,
    },
    tripModalHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 18,
    },
    tripModalTitle: {
        fontSize: 23,
        fontWeight: '800',
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
        alignItems: 'center',
        justifyContent: 'center',
    },
    tripModalList: {
        maxHeight: 280,
    },
    tripOption: {
        minHeight: 72,
        flexDirection: 'row',
        alignItems: 'center',
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
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.surface,
    },
    tripOptionIconSelected: {
        backgroundColor: '#FFE4DC',
    },
    tripOptionTextArea: {
        flex: 1,
    },
    tripOptionTitle: {
        fontSize: 16,
        fontWeight: '700',
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
        flexDirection: 'row',
        alignItems: 'center',
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
        borderStyle: 'dashed',
        borderColor: COLORS.border,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.surface,
    },
    newTripText: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.textSecondary,
    },

});