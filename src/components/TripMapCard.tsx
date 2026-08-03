import React, { useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { AppText as Text } from '@/components/AppText';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, {
  Circle,
  Path,
} from 'react-native-svg';
import { router } from 'expo-router';

import { useResponsive } from '../hooks/use-responsive';
import { homeColors } from '../constants/home-theme';
import { TripRoute } from '../types/home';

const STICKERS = ['🏖️', '☕', '⛵', '🍜'];

const LABELS = [
  '협재해변',
  '카페 이연',
  '모슬포항',
  '동문시장',
];

function normalizePercent(value: unknown, fallback: number) {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const numericValue = Number.parseFloat(
      value.replace('%', ''),
    );

    return Number.isNaN(numericValue)
      ? fallback
      : numericValue;
  }

  return fallback;
}

export default function TripMapCard({
  title,
  subtitle,
  markers = [],
}: TripRoute) {
  const { moderateScale: ms } = useResponsive();

  const normalizedMarkers = useMemo(
    () =>
      markers.map((marker, index) => ({
        ...marker,
        xPercent: normalizePercent(
          marker.x,
          18 + index * 22,
        ),
        yPercent: normalizePercent(
          marker.y,
          34 + index * 8,
        ),
        sticker: STICKERS[index % STICKERS.length],
        placeName:
          LABELS[index % LABELS.length],
      })),
    [markers],
  );

  const routePath = useMemo(() => {
    if (normalizedMarkers.length < 2) {
      return '';
    }

    const [first, ...rest] = normalizedMarkers;

    return rest.reduce((path, marker) => {
      const previousMarker =
        normalizedMarkers[
          normalizedMarkers.indexOf(marker) - 1
        ];

      const controlX =
        (previousMarker.xPercent +
          marker.xPercent) /
        2;

      const controlY =
        Math.min(
          previousMarker.yPercent,
          marker.yPercent,
        ) - 4;

      return `${path} Q ${controlX} ${controlY} ${marker.xPercent} ${marker.yPercent}`;
    }, `M ${first.xPercent} ${first.yPercent}`);
  }, [normalizedMarkers]);

  const handleOpenRoute = () => {
    router.push('/my-route');
  };

  return (
    <Pressable
      onPress={handleOpenRoute}
      style={({ pressed }) => [
        styles.card,
        {
          borderRadius: ms(26),
          padding: ms(18),
        },
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerTextArea}>
          <Text
            numberOfLines={1}
            allowFontScaling={false}
            style={[
              styles.title,
              {
                fontSize: ms(20),
                lineHeight: ms(27),
              },
            ]}
          >
            {title}
          </Text>

          <Text
            numberOfLines={1}
            allowFontScaling={false}
            style={[
              styles.subtitle,
              {
                fontSize: ms(13),
                lineHeight: ms(19),
              },
            ]}
          >
            {subtitle}
          </Text>
        </View>

        <View
          style={[
            styles.routeButton,
            {
              width: ms(38),
              height: ms(38),
              borderRadius: ms(19),
            },
          ]}
        >
          <Ionicons
            name="arrow-forward"
            size={ms(19)}
            color={homeColors.accent}
          />
        </View>
      </View>

      <LinearGradient
        colors={['#DDF4F2', '#E7F2D8']}
        start={{ x: 0, y: 0.1 }}
        end={{ x: 1, y: 0.95 }}
        style={[
          styles.mapArea,
          {
            height: ms(230),
            borderRadius: ms(22),
            marginTop: ms(16),
          },
        ]}
      >
        <View
          style={[
            styles.landShape,
            {
              width: ms(310),
              height: ms(185),
              borderRadius: ms(96),
              left: ms(18),
              top: ms(25),
            },
          ]}
        />

        <View
          style={[
            styles.decorCircle,
            {
              width: ms(125),
              height: ms(125),
              borderRadius: ms(63),
              left: -ms(35),
              bottom: -ms(38),
            },
          ]}
        />

        <View
          style={[
            styles.decorCircle,
            {
              width: ms(145),
              height: ms(145),
              borderRadius: ms(73),
              right: -ms(48),
              top: -ms(54),
            },
          ]}
        />

        <View
          style={[
            styles.road,
            {
              width: '72%',
              left: '10%',
              top: '28%',
              transform: [{ rotate: '-16deg' }],
            },
          ]}
        />

        <View
          style={[
            styles.road,
            {
              width: '58%',
              left: '23%',
              top: '62%',
              transform: [{ rotate: '15deg' }],
            },
          ]}
        />

        <Text
          style={[
            styles.mapDecoration,
            {
              left: '10%',
              top: '17%',
              fontSize: ms(22),
            },
          ]}
        >
          🌲
        </Text>

        <Text
          style={[
            styles.mapDecoration,
            {
              right: '9%',
              top: '15%',
              fontSize: ms(24),
            },
          ]}
        >
          🌳
        </Text>

        <Text
          style={[
            styles.mapDecoration,
            {
              left: '19%',
              bottom: '12%',
              fontSize: ms(23),
            },
          ]}
        >
          🌴
        </Text>

        <Text
          style={[
            styles.mapDecoration,
            {
              right: '5%',
              bottom: '7%',
              fontSize: ms(18),
            },
          ]}
        >
          🌼
        </Text>

        {routePath ? (
          <Svg
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <Path
              d={routePath}
              stroke="#FFD0BF"
              strokeWidth={4}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />

            <Path
              d={routePath}
              stroke="#F6784D"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />

            {normalizedMarkers.map((marker) => (
              <Circle
                key={`dot-${marker.id}`}
                cx={marker.xPercent}
                cy={marker.yPercent}
                r={1.8}
                fill="#F6784D"
                stroke="#FFFFFF"
                strokeWidth={0.8}
              />
            ))}
          </Svg>
        ) : null}

        {normalizedMarkers.map((marker, index) => (
          <View
            key={marker.id}
            style={[
              styles.markerWrapper,
              {
                left: `${marker.xPercent}%`,
                top: `${marker.yPercent}%`,
                transform: [
                  {
                    translateX: -ms(31),
                  },
                  {
                    translateY: -ms(31),
                  },
                ],
              },
            ]}
          >
            <View
              style={[
                styles.markerNumber,
                {
                  width: ms(26),
                  height: ms(26),
                  borderRadius: ms(13),
                },
              ]}
            >
              <Text
                allowFontScaling={false}
                style={[
                  styles.markerNumberText,
                  {
                    fontSize: ms(11),
                    lineHeight: ms(14),
                  },
                ]}
              >
                {marker.label || index + 1}
              </Text>
            </View>

            <View
              style={[
                styles.stickerContainer,
                {
                  width: ms(58),
                  height: ms(58),
                  borderRadius: ms(29),
                },
              ]}
            >
              <Text
                style={[
                  styles.stickerText,
                  {
                    fontSize: ms(29),
                  },
                ]}
              >
                {marker.sticker}
              </Text>
            </View>

            <View
              style={[
                styles.placeLabel,
                {
                  borderRadius: ms(8),
                  paddingHorizontal: ms(7),
                  paddingVertical: ms(3),
                },
              ]}
            >
              <Text
                numberOfLines={1}
                allowFontScaling={false}
                style={[
                  styles.placeLabelText,
                  {
                    fontSize: ms(9),
                    lineHeight: ms(12),
                  },
                ]}
              >
                {marker.placeName}
              </Text>
            </View>
          </View>
        ))}
      </LinearGradient>

      <View
        style={[
          styles.footer,
          {
            marginTop: ms(14),
          },
        ]}
      >
        <View style={styles.footerInfo}>
          <View
            style={[
              styles.footerIcon,
              {
                width: ms(34),
                height: ms(34),
                borderRadius: ms(17),
              },
            ]}
          >
            <Ionicons
              name="location"
              size={ms(18)}
              color={homeColors.accent}
            />
          </View>

          <View>
            <Text
              allowFontScaling={false}
              style={[
                styles.footerTitle,
                {
                  fontSize: ms(13),
                  lineHeight: ms(18),
                },
              ]}
            >
              여행 경로 보기
            </Text>

            <Text
              allowFontScaling={false}
              style={[
                styles.footerDescription,
                {
                  fontSize: ms(11),
                  lineHeight: ms(15),
                },
              ]}
            >
              장소별 클립과 이동 순서를 확인해보세요
            </Text>
          </View>
        </View>

        <Ionicons
          name="chevron-forward"
          size={ms(20)}
          color={homeColors.textSecondary}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: homeColors.card,

    borderWidth: 1,
    borderColor: homeColors.border,

    shadowColor: '#443A31',
    shadowOffset: {
      width: 0,
      height: 7,
    },
    shadowOpacity: 0.08,
    shadowRadius: 18,

    elevation: 4,
  },

  cardPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.995 }],
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  headerTextArea: {
    flex: 1,
  },

  title: {
    color: homeColors.textPrimary,
    fontWeight: '800',
    letterSpacing: -0.4,
  },

  subtitle: {
    marginTop: 2,

    color: homeColors.textSecondary,
    fontWeight: '500',
  },

  routeButton: {
    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: '#FFF3E7',

    borderWidth: 1,
    borderColor: '#FFE1C4',
  },

  mapArea: {
    position: 'relative',
    overflow: 'hidden',
  },

  landShape: {
    position: 'absolute',

    backgroundColor: '#F5EFD9',
    opacity: 0.86,

    transform: [{ rotate: '-7deg' }],
  },

  decorCircle: {
    position: 'absolute',

    backgroundColor: 'rgba(255,255,255,0.18)',
  },

  road: {
    position: 'absolute',

    height: 2,
    borderRadius: 1,

    backgroundColor: 'rgba(255,255,255,0.82)',
  },

  mapDecoration: {
    position: 'absolute',
    zIndex: 2,

    opacity: 0.52,
  },

  markerWrapper: {
    position: 'absolute',
    zIndex: 10,

    alignItems: 'center',
  },

  markerNumber: {
    position: 'absolute',
    left: -3,
    top: -5,
    zIndex: 12,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: homeColors.accent,

    borderWidth: 3,
    borderColor: '#FFFFFF',
  },

  markerNumberText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  stickerContainer: {
    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: 'rgba(255,255,255,0.94)',

    borderWidth: 2,
    borderColor: '#FFFFFF',

    shadowColor: '#443A31',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.14,
    shadowRadius: 7,

    elevation: 4,
  },

  stickerText: {
    textAlign: 'center',
  },

  placeLabel: {
    maxWidth: 92,

    marginTop: 2,

    backgroundColor: 'rgba(255,255,255,0.88)',
  },

  placeLabelText: {
    color: homeColors.textPrimary,
    fontWeight: '700',
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',

    paddingTop: 12,

    borderTopWidth: 1,
    borderTopColor: '#F2EEE7',
  },

  footerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  footerIcon: {
    marginRight: 10,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: '#FFF1E4',
  },

  footerTitle: {
    color: homeColors.textPrimary,
    fontWeight: '800',
  },

  footerDescription: {
    marginTop: 1,

    color: homeColors.textSecondary,
    fontWeight: '500',
  },
});