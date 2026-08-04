import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppText } from '@/components/AppText';
import { colors } from '@/constants/menu-theme';
import { Card, ListRow, SectionLabel, ScreenHeader } from '@/components/common';

interface VisitedPlace {
  order: number;
  name: string;
  category: string;
  visitedAt: string | null;
}

interface TripDetail {
  id: string;
  title: string;
  dateRange: string;
  clipCount: number;
  places: VisitedPlace[];
}

// TODO: 실제로는 tripId로 API 호출해서 받아옴
const MOCK_TRIP_DETAILS: Record<string, TripDetail> = {
  '1': {
    id: '1',
    title: '전주 한옥마을 힐링 여행',
    dateRange: '2026.07.15 - 07.17',
    clipCount: 6,
    places: [
      { order: 1, name: '전주 한옥마을', category: '관광지', visitedAt: '07.15 14:20' },
      { order: 2, name: '객리단길 카페거리', category: '카페', visitedAt: '07.16 10:05' },
      { order: 3, name: '덕진공원', category: '관광지', visitedAt: '07.16 16:40' },
      { order: 4, name: '팔복예술공장', category: '문화시설', visitedAt: null },
    ],
  },
  '2': {
    id: '2',
    title: '객리단길 골목 탐방',
    dateRange: '2026.06.02 - 06.03',
    clipCount: 11,
    places: [{ order: 1, name: '팔복예술공장', category: '문화시설', visitedAt: '06.03 13:00' }],
  },
};

export default function TripDetailScreen() {
  // 파일명이 [tripId].tsx 라서, URL의 그 부분이 자동으로 tripId라는 파라미터로 들어옴
  // 예: router.push('/trip-detail/1') → tripId === '1'
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const trip = MOCK_TRIP_DETAILS[tripId];

  if (!trip) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="여행 상세" />
        <AppText style={styles.errorText}>여행 정보를 찾을 수 없어요 (tripId: {tripId})</AppText>
      </View>
    );
  }

  const visitedCount = trip.places.filter((p) => p.visitedAt !== null).length;
  const completionRate = Math.round((visitedCount / trip.places.length) * 100);

  return (
    <View style={styles.screen}>
      <ScreenHeader title={trip.title} />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <AppText style={styles.heroTitle}>{trip.dateRange}</AppText>
          <AppText style={styles.heroSub}>
            방문 {visitedCount}곳 · 촬영 클립 {trip.clipCount}개 · 완료율 {completionRate}%
          </AppText>
        </View>

        <SectionLabel text="방문 순서" />
        <Card>
          {trip.places.map((place, idx) => (
            <PlaceRow key={place.order} place={place} isLast={idx === trip.places.length - 1} />
          ))}
        </Card>
      </ScrollView>
    </View>
  );
}

function PlaceRow({ place, isLast }: { place: VisitedPlace; isLast: boolean }) {
  const visited = place.visitedAt !== null;
  return (
    <ListRow
      isLast={isLast}
      title={place.name}
      subtitle={visited ? `${place.visitedAt} · ${place.category}` : '아직 방문하지 않았어요'}
      right={
        <View style={[styles.orderBadge, !visited && styles.orderBadgeMuted]}>
          <AppText style={[styles.orderBadgeText, !visited && styles.orderBadgeTextMuted]}>{place.order}</AppText>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 40 },
  hero: { paddingHorizontal: 4, paddingBottom: 6 },
  heroTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  heroSub: { fontSize: 12, color: colors.textSub, marginTop: 3 },
  errorText: { padding: 16, fontSize: 13, color: colors.textSub },
  orderBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderBadgeMuted: { backgroundColor: colors.border },
  orderBadgeText: { fontSize: 11, fontWeight: '800', color: colors.accent },
  orderBadgeTextMuted: { color: colors.textTertiary },
});
