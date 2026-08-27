import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText as Text } from '@/components/AppText';
import Svg, { Circle, Path } from 'react-native-svg';
import { COLORS as SHARED_COLORS, MAP_COLORS } from '@/constants/color';

// my-route.tsx '지도' 탭(RouteMap)의 장식용 지도를 그대로 가져온 컴포넌트입니다.
// 실제 좌표가 아니라 고정된 목데이터(x/y 퍼센트 좌표)로 그리는 SVG라, 어떤
// 여행을 보든 항상 같은 그림이 뜹니다 — 여행 상세 화면 등 "예쁜 지도 장식"이
// 필요한 곳에서 쓰는 용도로, 실제 경로를 나타내진 않습니다.

const COLORS = {
  route: '#F6784D',
  routeSoft: '#FFD2C2',
  primary: SHARED_COLORS.accent,
  card: SHARED_COLORS.background,
  shadow: SHARED_COLORS.shadow,
  textSecondary: SHARED_COLORS.textSecondary,
  mapBlue: MAP_COLORS.mapBlue,
  mapGreen: MAP_COLORS.mapGreen,
  mapCream: MAP_COLORS.mapCream,
};

interface MockStop {
  id: string;
  order: number;
  shortName: string;
  sticker: string;
  x: number;
  y: number;
}

const MOCK_STOPS: MockStop[] = [
  { id: 'stop-1', order: 1, shortName: '협재해변', sticker: '🏖️', x: 18, y: 25 },
  { id: 'stop-2', order: 2, shortName: '카페 이연', sticker: '☕', x: 51, y: 46 },
  { id: 'stop-3', order: 3, shortName: '모슬포항', sticker: '⛵', x: 74, y: 67 },
  { id: 'stop-4', order: 4, shortName: '동문시장', sticker: '🍜', x: 86, y: 40 },
];

function MapDecoration() {
  return (
    <>
      <View style={[styles.mapIsland, styles.mapIslandOne]} />
      <View style={[styles.mapIsland, styles.mapIslandTwo]} />
      <View style={[styles.mapIsland, styles.mapIslandThree]} />

      <Text style={[styles.mapDecoration, styles.treeOne]}>🌲</Text>
      <Text style={[styles.mapDecoration, styles.treeTwo]}>🌴</Text>
      <Text style={[styles.mapDecoration, styles.treeThree]}>🌳</Text>
      <Text style={[styles.mapDecoration, styles.flower]}>🌼</Text>

      <View style={[styles.road, styles.roadOne]} />
      <View style={[styles.road, styles.roadTwo]} />
      <View style={[styles.road, styles.roadThree]} />
      <View style={[styles.road, styles.roadFour]} />
    </>
  );
}

export function RouteMapPreview({ height = 220 }: { height?: number }) {
  return (
    <View style={[styles.map, { height }]}>
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

        {MOCK_STOPS.map((stop) => (
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

      {MOCK_STOPS.map((stop) => (
        <View
          key={stop.id}
          style={[styles.stopContainer, { left: `${stop.x}%`, top: `${stop.y}%` }]}
        >
          <View style={styles.orderBadge}>
            <Text style={styles.orderBadgeText}>{stop.order}</Text>
          </View>

          <View style={styles.stickerContainer}>
            <Text style={styles.sticker}>{stop.sticker}</Text>
          </View>

          <View style={styles.stopLabel}>
            <Text numberOfLines={1} style={styles.stopLabelText}>
              {stop.shortName}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 20,
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
  roadOne: { width: '70%', left: '12%', top: '23%', transform: [{ rotate: '-18deg' }] },
  roadTwo: { width: '62%', left: '20%', top: '55%', transform: [{ rotate: '14deg' }] },
  roadThree: { width: '52%', left: '6%', top: '73%', transform: [{ rotate: '-26deg' }] },
  roadFour: { width: '45%', right: '5%', top: '38%', transform: [{ rotate: '70deg' }] },
  mapDecoration: {
    position: 'absolute',
    zIndex: 2,
    fontSize: 27,
    opacity: 0.48,
  },
  treeOne: { left: '12%', top: '60%' },
  treeTwo: { left: '31%', top: '75%' },
  treeThree: { right: '16%', top: '18%' },
  flower: { right: 9, bottom: 14, fontSize: 22, opacity: 0.72 },
  stopContainer: {
    position: 'absolute',
    zIndex: 8,
    alignItems: 'center',
    transform: [{ translateX: -35 }, { translateY: -35 }],
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
  orderBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
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
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 7,
    elevation: 4,
  },
  sticker: { fontSize: 32 },
  stopLabel: {
    maxWidth: 92,
    marginTop: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.78)',
  },
  stopLabelText: { color: COLORS.textSecondary, fontSize: 10, fontWeight: '700' },
});
