import React, { useMemo } from 'react';
import {
    Pressable,
    StyleSheet,
    View,
    type TextStyle,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';

import { AppText as Text } from '@/components/AppText';
import { COLORS as SHARED_COLORS } from '@/constants/color';
import type { PlanStop } from '@/services/tripPlanService';

/* ============================================================
 * TYPES
 * ============================================================ */

type TravelIllustratedMapProps = {
    stops: PlanStop[];
    height?: number;

    selectedStopId?: string | null;
    onSelectStop?: (stopId: string) => void;

    onPressLocate?: () => void;
    onPressLayers?: () => void;

    // 공유/이미지 저장용 모드
    exportMode?: boolean;
};
type MapPoint = {
    id: string;
    order: number;
    name: string;

    x: number;
    y: number;

    icon: React.ComponentProps<typeof Ionicons>['name'];

    cardSide: 'left' | 'right';
};

type MapTheme = {
    background: string;

    water: string;
    waterSoft: string;

    green: string;
    greenSoft: string;

    road: string;

    emojiOne: string;
    emojiTwo: string;
    emojiThree: string;
    emojiFour: string;
    emojiFive: string;
    emojiSix: string;
};

type DecorationPositionKey =
    | 'one'
    | 'two'
    | 'three'
    | 'four'
    | 'five'
    | 'six';

/* ============================================================
 * COLORS
 * ============================================================ */

const COLORS = {
    accent: SHARED_COLORS.accent,

    textPrimary: SHARED_COLORS.textPrimary,
    textSecondary: SHARED_COLORS.textSecondary,

    route: '#FF7657',
    routeSoft: '#FFD7CB',

    shadow: '#55483D',
};

/* ============================================================
 * MAP THEMES
 *
 * 선택한 장소의 성격에 따라 지도 분위기가 달라집니다.
 * ============================================================ */

const MAP_THEMES: Record<string, MapTheme> = {
    city: {
        background: '#FAF4E9',

        water: '#D8EAED',
        waterSoft: '#E4F1F1',

        green: '#DFE8D8',
        greenSoft: '#EDF1E7',

        road: 'rgba(255,255,255,0.95)',

        emojiOne: '🌳',
        emojiTwo: '🏠',
        emojiThree: '☕',
        emojiFour: '🌼',
        emojiFive: '🚲',
        emojiSix: '🌲',
    },

    cafe: {
        background: '#FBF1E8',

        water: '#D9EAEC',
        waterSoft: '#E7F1F1',

        green: '#E2E8D8',
        greenSoft: '#EFF1E8',

        road: 'rgba(255,255,255,0.94)',

        emojiOne: '☕',
        emojiTwo: '🥐',
        emojiThree: '🌳',
        emojiFour: '🌷',
        emojiFive: '🏠',
        emojiSix: '🪴',
    },

    nature: {
        background: '#F4F4E8',

        water: '#D5E9E7',
        waterSoft: '#E3F0ED',

        green: '#D5E4CC',
        greenSoft: '#E5EDD9',

        road: 'rgba(255,255,255,0.91)',

        emojiOne: '🌲',
        emojiTwo: '🌳',
        emojiThree: '🌿',
        emojiFour: '🌼',
        emojiFive: '🍃',
        emojiSix: '🌱',
    },

    traditional: {
        background: '#FBF0E3',

        water: '#D5E8E9',
        waterSoft: '#E5F0EF',

        green: '#DEE6D3',
        greenSoft: '#EBEEDF',

        road: 'rgba(255,255,255,0.94)',

        emojiOne: '🏯',
        emojiTwo: '⛩️',
        emojiThree: '🌸',
        emojiFour: '🌳',
        emojiFive: '🏠',
        emojiSix: '🌼',
    },

    market: {
        background: '#FBF2E6',

        water: '#D9E9E9',
        waterSoft: '#E7F0EF',

        green: '#E0E7D6',
        greenSoft: '#ECF0E5',

        road: 'rgba(255,255,255,0.94)',

        emojiOne: '🏪',
        emojiTwo: '🍜',
        emojiThree: '☕',
        emojiFour: '🌳',
        emojiFive: '🥟',
        emojiSix: '🌼',
    },

    coast: {
        background: '#F9F3E9',

        water: '#CFE8EC',
        waterSoft: '#DCEFF1',

        green: '#DCE8D5',
        greenSoft: '#EAF0E4',

        road: 'rgba(255,255,255,0.94)',

        emojiOne: '⛵',
        emojiTwo: '🌴',
        emojiThree: '🌊',
        emojiFour: '🌳',
        emojiFive: '🐚',
        emojiSix: '🌺',
    },

    medical: {
        background: '#F7F3EB',

        water: '#D9EAED',
        waterSoft: '#E7F1F2',

        green: '#DCE8D8',
        greenSoft: '#EAF0E6',

        road: 'rgba(255,255,255,0.95)',

        emojiOne: '🌳',
        emojiTwo: '🏥',
        emojiThree: '🌿',
        emojiFour: '☕',
        emojiFive: '🌼',
        emojiSix: '🏠',
    },
};

/* ============================================================
 * HASH
 *
 * Math.random()을 쓰지 않습니다.
 *
 * 같은 장소:
 * 항상 같은 테마 / 장식 배치
 *
 * 다른 장소:
 * 다른 테마 / 장식 배치 가능
 * ============================================================ */

function hashString(value: string): number {
    let hash = 0;

    for (let index = 0; index < value.length; index += 1) {
        hash = (hash * 31 + value.charCodeAt(index)) | 0;
    }

    return Math.abs(hash);
}

/* ============================================================
 * PLACE → THEME
 * ============================================================ */

function getThemeKey(stop?: PlanStop | null): keyof typeof MAP_THEMES {
    if (!stop) {
        return 'city';
    }

    const value = stop.name.toLowerCase();

    /* 전통 / 관광 */

    if (
        value.includes('한옥') ||
        value.includes('궁') ||
        value.includes('사찰') ||
        value.includes('절') ||
        value.includes('향교') ||
        value.includes('전통') ||
        value.includes('문화재') ||
        value.includes('성당') ||
        value.includes('전동성당')
    ) {
        return 'traditional';
    }

    /* 바다 / 물 */

    if (
        value.includes('바다') ||
        value.includes('해변') ||
        value.includes('해수욕장') ||
        value.includes('항구') ||
        value.includes('항') ||
        value.includes('강변') ||
        value.includes('호수') ||
        value.includes('천변')
    ) {
        return 'coast';
    }

    /* 자연 */

    if (
        value.includes('공원') ||
        value.includes('숲') ||
        value.includes('산') ||
        value.includes('정원') ||
        value.includes('수목원') ||
        value.includes('둘레길') ||
        value.includes('생태')
    ) {
        return 'nature';
    }

    /* 카페 */

    if (
        value.includes('카페') ||
        value.includes('커피') ||
        value.includes('스타벅스') ||
        value.includes('베이커리') ||
        value.includes('디저트')
    ) {
        return 'cafe';
    }

    /* 시장 / 음식 */

    if (
        value.includes('시장') ||
        value.includes('맛집') ||
        value.includes('식당') ||
        value.includes('분식') ||
        value.includes('치킨') ||
        value.includes('국밥') ||
        value.includes('레스토랑') ||
        value.includes('포차')
    ) {
        return 'market';
    }

    /* 병원 */

    if (
        value.includes('병원') ||
        value.includes('의원') ||
        value.includes('약국')
    ) {
        return 'medical';
    }

    /*
     * 카테고리 판단이 어려운 장소.
     *
     * 장소 ID + 이름으로 결정하기 때문에
     * 화면을 다시 열어도 같은 테마가 나옵니다.
     */

    const fallbackThemes: (keyof typeof MAP_THEMES)[] = [
        'city',
        'cafe',
        'nature',
        'traditional',
    ];

    const index =
        hashString(`${stop.id}-${stop.name}`) % fallbackThemes.length;

    return fallbackThemes[index];
}

/* ============================================================
 * DECORATION VARIANT
 * ============================================================ */

function getDecorationVariant(stop?: PlanStop | null): number {
    if (!stop) {
        return 0;
    }

    return hashString(`${stop.id}-${stop.name}-decoration`) % 3;
}

/* ============================================================
 * PLACE ICON
 * ============================================================ */

function getPlaceIcon(
    name: string,
): React.ComponentProps<typeof Ionicons>['name'] {
    const normalized = name.toLowerCase();

    if (
        normalized.includes('카페') ||
        normalized.includes('커피') ||
        normalized.includes('스타벅스') ||
        normalized.includes('베이커리')
    ) {
        return 'cafe-outline';
    }

    if (
        normalized.includes('시장') ||
        normalized.includes('마트') ||
        normalized.includes('상가')
    ) {
        return 'storefront-outline';
    }

    if (
        normalized.includes('해변') ||
        normalized.includes('바다') ||
        normalized.includes('항구')
    ) {
        return 'boat-outline';
    }

    if (
        normalized.includes('식당') ||
        normalized.includes('스시') ||
        normalized.includes('치킨') ||
        normalized.includes('맛집')
    ) {
        return 'restaurant-outline';
    }

    if (
        normalized.includes('공원') ||
        normalized.includes('숲') ||
        normalized.includes('산')
    ) {
        return 'leaf-outline';
    }

    if (
        normalized.includes('병원') ||
        normalized.includes('의원')
    ) {
        return 'medkit-outline';
    }

    if (
        normalized.includes('학교') ||
        normalized.includes('대학교')
    ) {
        return 'school-outline';
    }

    if (
        normalized.includes('한옥') ||
        normalized.includes('궁') ||
        normalized.includes('성당')
    ) {
        return 'camera-outline';
    }

    return 'location-outline';
}

/* ============================================================
 * GPS → MAP POINT
 * ============================================================ */

function buildMapPoints(stops: PlanStop[]): MapPoint[] {
    const validStops = stops
        .filter(
            (
                stop,
            ): stop is PlanStop & {
                latitude: number;
                longitude: number;
            } =>
                typeof stop.latitude === 'number' &&
                typeof stop.longitude === 'number' &&
                Number.isFinite(stop.latitude) &&
                Number.isFinite(stop.longitude) &&
                !(stop.latitude === 0 && stop.longitude === 0),
        )
        .sort((a, b) => a.order - b.order);

    if (validStops.length === 0) {
        return [];
    }

    const latitudes = validStops.map((stop) => stop.latitude);
    const longitudes = validStops.map((stop) => stop.longitude);

    let minLat = Math.min(...latitudes);
    let maxLat = Math.max(...latitudes);

    let minLng = Math.min(...longitudes);
    let maxLng = Math.max(...longitudes);

    /*
     * 모든 장소의 좌표가 거의 같은 경우
     * 0으로 나누는 문제 방지
     */

    if (Math.abs(maxLat - minLat) < 0.0001) {
        minLat -= 0.001;
        maxLat += 0.001;
    }

    if (Math.abs(maxLng - minLng) < 0.0001) {
        minLng -= 0.001;
        maxLng += 0.001;
    }

    /*
     * 지도 끝에 마커가 붙지 않도록 여백 확보.
     *
     * 장소가 많아져도 최대한 지도 내부에서
     * 전체 경로가 한눈에 보이게 합니다.
     */

    const LEFT = 22;
    const RIGHT = 78;

    const TOP = 22;
    const BOTTOM = 76;

    return validStops.map((stop) => {
        const x =
            LEFT +
            ((stop.longitude - minLng) / (maxLng - minLng)) *
            (RIGHT - LEFT);

        const y =
            TOP +
            ((maxLat - stop.latitude) / (maxLat - minLat)) *
            (BOTTOM - TOP);

        return {
            id: stop.id,
            order: stop.order,
            name: stop.name,

            x,
            y,

            icon: getPlaceIcon(stop.name),

            cardSide: x > 58 ? 'left' : 'right',
        };
    });
}

/* ============================================================
 * ROUTE PATH
 * ============================================================ */

function buildRoutePath(points: MapPoint[]): string {
    if (points.length < 2) {
        return '';
    }

    let path = `M ${points[0].x} ${points[0].y}`;

    for (let index = 1; index < points.length; index += 1) {
        const previous = points[index - 1];
        const current = points[index];

        const middleX = (previous.x + current.x) / 2;

        path +=
            ` C ${middleX} ${previous.y}, ` +
            `${middleX} ${current.y}, ` +
            `${current.x} ${current.y}`;
    }

    return path;
}

/* ============================================================
 * MAP DECORATION
 * ============================================================ */

function MapDecoration({
    theme,
    variant,
}: {
    theme: MapTheme;
    variant: number;
}) {
    /*
     * 중요:
     *
     * ViewStyle 타입을 명시해서
     * left: '18%'
     * top: '20%'
     *
     * 등의 percentage 값을 React Native가
     * 올바른 DimensionValue로 인식하도록 합니다.
     */

    const variantStyles: Record<
        DecorationPositionKey,
        TextStyle
    > =
        variant === 0
            ? {
                one: {
                    left: '18%',
                    top: '18%',
                },

                two: {
                    right: '24%',
                    top: '10%',
                },

                three: {
                    left: '30%',
                    bottom: '14%',
                },

                four: {
                    right: '13%',
                    bottom: '23%',
                },

                five: {
                    left: '13%',
                    top: '45%',
                },

                six: {
                    right: '8%',
                    bottom: '6%',
                },
            }
            : variant === 1
                ? {
                    one: {
                        left: '12%',
                        top: '29%',
                    },

                    two: {
                        right: '18%',
                        top: '13%',
                    },

                    three: {
                        left: '24%',
                        bottom: '8%',
                    },

                    four: {
                        right: '29%',
                        bottom: '28%',
                    },

                    five: {
                        left: '10%',
                        top: '57%',
                    },

                    six: {
                        right: '9%',
                        bottom: '9%',
                    },
                }
                : {
                    one: {
                        left: '23%',
                        top: '12%',
                    },

                    two: {
                        right: '31%',
                        top: '22%',
                    },

                    three: {
                        left: '15%',
                        bottom: '14%',
                    },

                    four: {
                        right: '11%',
                        bottom: '31%',
                    },

                    five: {
                        left: '35%',
                        top: '42%',
                    },

                    six: {
                        right: '7%',
                        bottom: '7%',
                    },
                };

    return (
        <>
            {/* WATER */}

            <View
                style={[
                    styles.waterLeft,
                    {
                        backgroundColor: theme.water,
                    },
                ]}
            />

            <View
                style={[
                    styles.waterRightBottom,
                    {
                        backgroundColor: theme.waterSoft,
                    },
                ]}
            />

            {/* GREEN AREAS */}

            <View
                style={[
                    styles.greenArea,
                    styles.greenAreaOne,
                    {
                        backgroundColor: theme.green,
                    },
                ]}
            />

            <View
                style={[
                    styles.greenArea,
                    styles.greenAreaTwo,
                    {
                        backgroundColor: theme.greenSoft,
                    },
                ]}
            />

            <View
                style={[
                    styles.greenArea,
                    styles.greenAreaThree,
                    {
                        backgroundColor: theme.green,
                    },
                ]}
            />

            <View
                style={[
                    styles.greenArea,
                    styles.greenAreaFour,
                    {
                        backgroundColor: theme.greenSoft,
                    },
                ]}
            />

            {/* ROADS */}

            <View
                style={[
                    styles.road,
                    styles.roadOne,
                    {
                        backgroundColor: theme.road,
                    },
                ]}
            />

            <View
                style={[
                    styles.road,
                    styles.roadTwo,
                    {
                        backgroundColor: theme.road,
                    },
                ]}
            />

            <View
                style={[
                    styles.road,
                    styles.roadThree,
                    {
                        backgroundColor: theme.road,
                    },
                ]}
            />

            <View
                style={[
                    styles.road,
                    styles.roadFour,
                    {
                        backgroundColor: theme.road,
                    },
                ]}
            />

            <View
                style={[
                    styles.road,
                    styles.roadFive,
                    {
                        backgroundColor: theme.road,
                    },
                ]}
            />

            <View
                style={[
                    styles.road,
                    styles.roadSix,
                    {
                        backgroundColor: theme.road,
                    },
                ]}
            />

            <View
                style={[
                    styles.road,
                    styles.roadSeven,
                    {
                        backgroundColor: theme.road,
                    },
                ]}
            />

            <View
                style={[
                    styles.road,
                    styles.roadEight,
                    {
                        backgroundColor: theme.road,
                    },
                ]}
            />

            <View
                style={[
                    styles.road,
                    styles.roadNine,
                    {
                        backgroundColor: theme.road,
                    },
                ]}
            />

            {/* DECORATIONS */}

            <Text
                style={[
                    styles.mapEmoji,
                    variantStyles.one,
                ]}
            >
                {theme.emojiOne}
            </Text>

            <Text
                style={[
                    styles.mapEmoji,
                    variantStyles.two,
                ]}
            >
                {theme.emojiTwo}
            </Text>

            <Text
                style={[
                    styles.mapEmoji,
                    variantStyles.three,
                ]}
            >
                {theme.emojiThree}
            </Text>

            <Text
                style={[
                    styles.mapEmoji,
                    variantStyles.four,
                ]}
            >
                {theme.emojiFour}
            </Text>

            <Text
                style={[
                    styles.mapEmoji,
                    styles.mapEmojiSmall,
                    variantStyles.five,
                ]}
            >
                {theme.emojiFive}
            </Text>

            <Text
                style={[
                    styles.mapEmoji,
                    variantStyles.six,
                ]}
            >
                {theme.emojiSix}
            </Text>
        </>
    );
}

/* ============================================================
 * COMPONENT
 * ============================================================ */

export default function TravelIllustratedMap({
    stops,
    height = 290,

    selectedStopId,
    onSelectStop,

    onPressLocate,
    onPressLayers,

    exportMode = false,
}: TravelIllustratedMapProps) {
    /* ==========================================================
     * POINTS
     * ========================================================== */

    const points = useMemo(() => {
        return buildMapPoints(stops);
    }, [stops]);

    /* ==========================================================
     * ROUTE
     * ========================================================== */

    const routePath = useMemo(() => {
        return buildRoutePath(points);
    }, [points]);

    /* ==========================================================
     * SELECTED STOP
     * ========================================================== */

    const selectedStop = useMemo(() => {
        if (stops.length === 0) {
            return null;
        }

        if (selectedStopId) {
            const match = stops.find(
                (stop) => stop.id === selectedStopId,
            );

            if (match) {
                return match;
            }
        }

        return (
            [...stops].sort(
                (a, b) => a.order - b.order,
            )[0] ?? null
        );
    }, [selectedStopId, stops]);

    /* ==========================================================
     * THEME
     * ========================================================== */

    const theme = useMemo(() => {
        const themeKey = getThemeKey(selectedStop);

        return MAP_THEMES[themeKey];
    }, [selectedStop]);

    /* ==========================================================
     * DECORATION LAYOUT
     * ========================================================== */

    const decorationVariant = useMemo(() => {
        return getDecorationVariant(selectedStop);
    }, [selectedStop]);

    return (
        <View
            style={[
                styles.container,
                {
                    height,

                    backgroundColor: theme.background,

                    borderColor: `${theme.green}AA`,
                },
            ]}
        >
            <View
                style={[
                    styles.mapBackground,
                    {
                        backgroundColor: theme.background,
                    },
                ]}
            >
                {/* ====================================================
         * ILLUSTRATED BACKGROUND
         * ==================================================== */}

                <MapDecoration
                    theme={theme}
                    variant={decorationVariant}
                />

                {/* ====================================================
         * ROUTE
         * ==================================================== */}

                <Svg
                    pointerEvents="none"
                    style={StyleSheet.absoluteFill}
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                >
                    {routePath ? (
                        <>
                            {/* 경로 흰색 외곽선 */}

                            <Path
                                d={routePath}
                                stroke="rgba(255,255,255,0.94)"
                                strokeWidth={2.8}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                fill="none"
                            />

                            {/* 주황색 점선 */}

                            <Path
                                d={routePath}
                                stroke={COLORS.route}
                                strokeWidth={1.2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeDasharray="3.5 2.8"
                                fill="none"
                            />
                        </>
                    ) : null}

                    {/* 경로 좌표 */}

                    {points.map((point) => (
                        <Circle
                            key={`route-point-${point.id}`}
                            cx={point.x}
                            cy={point.y}
                            r={1.05}
                            fill={COLORS.route}
                            stroke="#FFFFFF"
                            strokeWidth={0.6}
                        />
                    ))}
                </Svg>

                {/* ====================================================
         * MARKERS
         * ==================================================== */}

                {points.map((point) => {
                    const selected =
                        selectedStop?.id === point.id;

                    const isLeft =
                        point.cardSide === 'left';

                    return (
                        <Pressable
                            key={point.id}
                            disabled={exportMode}
                            onPress={() => {
                                if (!exportMode) {
                                    onSelectStop?.(point.id);
                                }
                            }}
                            hitSlop={8}
                            style={[
                                styles.markerAnchor,
                                {
                                    left: `${point.x}%`,
                                    top: `${point.y}%`,
                                },
                            ]}
                        >
                            {/* NUMBER MARKER */}

                            <View
                                style={[
                                    styles.simpleMarker,

                                    !exportMode &&
                                    !selected &&
                                    styles.simpleMarkerInactive,

                                    !exportMode &&
                                    selected &&
                                    styles.simpleMarkerSelected,
                                ]}
                            >
                                <Text
                                    allowFontScaling={false}
                                    style={styles.simpleMarkerText}
                                >
                                    {point.order}
                                </Text>
                            </View>

                            {/* 앱 화면에서는 선택한 장소만 이름 표시 */}

                            {!exportMode && selected ? (
                                <View
                                    style={[
                                        styles.selectedPlaceCard,
                                        isLeft
                                            ? styles.selectedPlaceCardLeft
                                            : styles.selectedPlaceCardRight,
                                    ]}
                                >
                                    <View
                                        style={styles.selectedPlaceIcon}
                                    >
                                        <Ionicons
                                            name={point.icon}
                                            size={16}
                                            color={COLORS.route}
                                        />
                                    </View>

                                    <Text
                                        numberOfLines={1}
                                        allowFontScaling={false}
                                        style={styles.selectedPlaceName}
                                    >
                                        {point.name}
                                    </Text>
                                </View>
                            ) : null}
                        </Pressable>
                    );
                })}

                {/* ====================================================
         * EXPORT PLACE LABELS
         *
         * 이미지 저장용 큰 지도에서만 모든 장소 이름을 표시합니다.
         * 작은 공유 미리보기에서는 글씨가 너무 겹치지 않도록 숨깁니다.
         * ==================================================== */}

                {exportMode && height >= 240
                    ? points.map((point) => {
                        const placeOnRight = point.x < 55;
                        const moveUp = point.order % 2 === 0;

                        return (
                            <View
                                key={`export-label-${point.id}`}
                                pointerEvents="none"
                                style={[
                                    styles.exportLabelAnchor,
                                    {
                                        left: `${point.x}%`,
                                        top: `${point.y}%`,
                                    },
                                ]}
                            >
                                <View
                                    style={[
                                        styles.exportPlaceLabel,
                                        placeOnRight
                                            ? styles.exportPlaceLabelRight
                                            : styles.exportPlaceLabelLeft,
                                        moveUp
                                            ? styles.exportPlaceLabelUp
                                            : styles.exportPlaceLabelDown,
                                    ]}
                                >
                                    <Text
                                        numberOfLines={1}
                                        allowFontScaling={false}
                                        style={styles.exportPlaceLabelText}
                                    >
                                        {point.name}
                                    </Text>
                                </View>
                            </View>
                        );
                    })
                    : null}

                {/* ====================================================
         * MAP CONTROLS
         * ==================================================== */}

                {!exportMode ? (
                    <View style={styles.controls}>
                        <Pressable
                            onPress={onPressLayers}
                            style={({ pressed }) => [
                                styles.controlButton,
                                pressed && styles.controlPressed,
                            ]}
                        >
                            <Ionicons
                                name="layers-outline"
                                size={21}
                                color="#333333"
                            />
                        </Pressable>

                        <Pressable
                            onPress={onPressLocate}
                            style={({ pressed }) => [
                                styles.controlButton,
                                pressed && styles.controlPressed,
                            ]}
                        >
                            <Ionicons
                                name="navigate-outline"
                                size={22}
                                color="#333333"
                            />
                        </Pressable>
                    </View>
                ) : null}
            </View>
        </View>
    );
}

/* ============================================================
 * STYLES
 * ============================================================ */

const styles = StyleSheet.create({
    /* ==========================================================
     * ROOT
     * ========================================================== */

    container: {
        width: '100%',

        overflow: 'hidden',

        borderRadius: 27,

        borderWidth: 1,
    },

    mapBackground: {
        flex: 1,

        position: 'relative',

        overflow: 'hidden',
    },

    /* ==========================================================
     * WATER
     * ========================================================== */

    waterLeft: {
        position: 'absolute',

        width: 135,

        height: '125%',

        left: -78,

        top: -45,

        borderRadius: 100,

        opacity: 0.88,

        transform: [
            {
                rotate: '5deg',
            },
        ],
    },

    waterRightBottom: {
        position: 'absolute',

        width: 180,

        height: 130,

        right: -80,

        bottom: -60,

        borderRadius: 100,

        opacity: 0.9,
    },

    /* ==========================================================
     * GREEN
     * ========================================================== */

    greenArea: {
        position: 'absolute',

        opacity: 0.43,
    },

    greenAreaOne: {
        width: 150,

        height: 90,

        left: 100,

        top: 95,

        borderRadius: 80,

        transform: [
            {
                rotate: '-12deg',
            },
        ],
    },

    greenAreaTwo: {
        width: 160,

        height: 100,

        right: -30,

        top: 245,

        borderRadius: 75,

        transform: [
            {
                rotate: '11deg',
            },
        ],
    },

    greenAreaThree: {
        width: 140,

        height: 80,

        left: 105,

        bottom: 35,

        borderRadius: 70,

        opacity: 0.3,
    },

    greenAreaFour: {
        width: 95,

        height: 65,

        left: 25,

        top: 180,

        borderRadius: 60,

        opacity: 0.27,
    },

    /* ==========================================================
     * ROADS
     * ========================================================== */

    road: {
        position: 'absolute',

        height: 3,

        borderRadius: 2,
    },

    roadOne: {
        width: '80%',

        left: '8%',

        top: '14%',

        transform: [
            {
                rotate: '-12deg',
            },
        ],
    },

    roadTwo: {
        width: '78%',

        left: '11%',

        top: '27%',

        transform: [
            {
                rotate: '12deg',
            },
        ],
    },

    roadThree: {
        width: '72%',

        left: '5%',

        top: '39%',

        transform: [
            {
                rotate: '-8deg',
            },
        ],
    },

    roadFour: {
        width: '86%',

        left: '5%',

        top: '53%',

        transform: [
            {
                rotate: '10deg',
            },
        ],
    },

    roadFive: {
        width: '78%',

        left: '6%',

        top: '69%',

        transform: [
            {
                rotate: '-8deg',
            },
        ],
    },

    roadSix: {
        width: '70%',

        left: '16%',

        top: '80%',

        transform: [
            {
                rotate: '15deg',
            },
        ],
    },

    roadSeven: {
        width: '82%',

        left: '5%',

        top: '43%',

        transform: [
            {
                rotate: '67deg',
            },
        ],
    },

    roadEight: {
        width: '75%',

        left: '29%',

        top: '45%',

        transform: [
            {
                rotate: '82deg',
            },
        ],
    },

    roadNine: {
        width: '62%',

        left: '-2%',

        top: '56%',

        transform: [
            {
                rotate: '47deg',
            },
        ],
    },

    /* ==========================================================
     * DECORATIONS
     * ========================================================== */

    mapEmoji: {
        position: 'absolute',

        zIndex: 3,

        fontSize: 21,

        opacity: 0.48,
    },

    mapEmojiSmall: {
        fontSize: 17,

        opacity: 0.36,
    },

    /* ==========================================================
     * MARKERS
     * ========================================================== */

    markerAnchor: {
        position: 'absolute',

        zIndex: 20,

        flexDirection: 'row',

        alignItems: 'center',

        transform: [
            {
                translateX: -17,
            },

            {
                translateY: -17,
            },
        ],
    },

    simpleMarker: {
        width: 34,

        height: 34,

        borderRadius: 12,

        alignItems: 'center',

        justifyContent: 'center',

        backgroundColor: COLORS.route,

        borderWidth: 3,

        borderColor: '#FFFFFF',

        shadowColor: COLORS.shadow,

        shadowOffset: {
            width: 0,

            height: 3,
        },

        shadowOpacity: 0.13,

        shadowRadius: 5,

        elevation: 5,
    },

    simpleMarkerInactive: {
        opacity: 0.86,
    },

    simpleMarkerSelected: {
        transform: [
            {
                scale: 1.1,
            },
        ],

        shadowOpacity: 0.22,

        elevation: 8,
    },

    simpleMarkerText: {
        color: '#FFFFFF',

        fontSize: 12,

        fontWeight: '800',
    },

    /* ==========================================================
     * SELECTED PLACE
     * ========================================================== */

    selectedPlaceCard: {
        position: 'absolute',

        top: -3,

        width: 145,

        height: 40,

        paddingHorizontal: 9,

        flexDirection: 'row',

        alignItems: 'center',

        borderRadius: 13,

        backgroundColor: 'rgba(255,255,255,0.97)',

        borderWidth: 1,

        borderColor: 'rgba(30,30,30,0.04)',

        shadowColor: COLORS.shadow,

        shadowOffset: {
            width: 0,

            height: 4,
        },

        shadowOpacity: 0.1,

        shadowRadius: 7,

        elevation: 5,
    },

    selectedPlaceCardRight: {
        left: 39,
    },

    selectedPlaceCardLeft: {
        right: 39,
    },

    selectedPlaceIcon: {
        width: 25,

        height: 25,

        borderRadius: 8,

        alignItems: 'center',

        justifyContent: 'center',

        marginRight: 6,

        backgroundColor: '#FFF3EB',
    },

    selectedPlaceName: {
        flex: 1,

        color: COLORS.textPrimary,

        fontSize: 10,

        fontWeight: '700',
    },


    /* ==========================================================
     * EXPORT PLACE LABELS
     * 저장 이미지에서만 모든 장소명을 보여주는 라벨
     * ========================================================== */

    exportLabelAnchor: {
        position: 'absolute',

        width: 1,
        height: 1,

        zIndex: 100,
        elevation: 100,
    },

    exportPlaceLabel: {
        position: 'absolute',

        minWidth: 110,
        maxWidth: 220,

        paddingHorizontal: 13,
        paddingVertical: 8,

        borderRadius: 12,

        backgroundColor: 'rgba(255,255,255,0.96)',

        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.98)',

        shadowColor: COLORS.shadow,
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.12,
        shadowRadius: 5,

        elevation: 10,
    },

    exportPlaceLabelRight: {
        left: 28,
    },

    exportPlaceLabelLeft: {
        right: 28,
    },

    exportPlaceLabelUp: {
        bottom: 12,
    },

    exportPlaceLabelDown: {
        top: 12,
    },

    exportPlaceLabelText: {
        color: COLORS.textPrimary,

        fontSize: 16,
        lineHeight: 21,

        fontWeight: '700',

        letterSpacing: -0.2,
    },

    /* ==========================================================
     * CONTROLS
     * ========================================================== */

    controls: {
        position: 'absolute',

        zIndex: 50,

        right: 12,

        top: 16,

        gap: 9,
    },

    controlButton: {
        width: 42,

        height: 42,

        borderRadius: 14,

        alignItems: 'center',

        justifyContent: 'center',

        backgroundColor: 'rgba(255,255,255,0.96)',

        borderWidth: 1,

        borderColor: 'rgba(30,30,30,0.04)',

        shadowColor: COLORS.shadow,

        shadowOffset: {
            width: 0,

            height: 4,
        },

        shadowOpacity: 0.1,

        shadowRadius: 8,

        elevation: 5,
    },

    controlPressed: {
        opacity: 0.7,

        transform: [
            {
                scale: 0.95,
            },
        ],
    },
});