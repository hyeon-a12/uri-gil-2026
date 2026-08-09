import React, { useCallback, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { AppText } from '@/components/AppText';
import { colors } from '@/constants/menu-theme';
import { Card, ListRow, SectionLabel, ScreenHeader } from '@/components/common';
import { getAllFolders } from '@/services/folderService';
import { getRecordingsByFolder } from '@/services/recordingService';

interface VisitedPlace {
  order: number;
  name: string;
  visitedAt: string;
}

interface TripDetail {
  id: string;
  title: string;
  dateRange: string;
  clipCount: number;
  places: VisitedPlace[];
}

function formatVisitedAt(recordedAtIso: string): string {
  const d = new Date(recordedAtIso);
  const MM = String(d.getMonth() + 1).padStart(2, '0');
  const DD = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${MM}.${DD} ${hh}:${mm}`;
}

export default function TripDetailScreen() {
  // 파일명이 [tripId].tsx 라서, URL의 그 부분이 자동으로 tripId라는 파라미터로 들어옴
  // 예: router.push('/trip-detail/1') → tripId === '1'
  // tripId는 folderService에 저장된 폴더(여행)의 id와 같은 값입니다.
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const [trip, setTrip] = useState<TripDetail | null | undefined>(undefined);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const folders = await getAllFolders();
        const folder = folders.find((f) => f.id === tripId);
        if (!folder) {
          setTrip(null);
          return;
        }

        const recordings = await getRecordingsByFolder(tripId);
        const sorted = [...recordings].sort((a, b) =>
          a.recordedAt.localeCompare(b.recordedAt),
        );

        // 같은 장소에서 여러 번 촬영했으면 방문 순서 목록에는 한 번만 표시 (처음 촬영 시각 기준)
        const seen = new Set<string>();
        const places: VisitedPlace[] = [];
        sorted.forEach((r) => {
          const name = r.location.placeName || '이름 없는 장소';
          if (seen.has(name)) return;
          seen.add(name);
          places.push({
            order: places.length + 1,
            name,
            visitedAt: formatVisitedAt(r.recordedAt),
          });
        });

        setTrip({
          id: folder.id,
          title: folder.title,
          dateRange: folder.dateRange,
          clipCount: recordings.length,
          places,
        });
      })();
    }, [tripId]),
  );

  if (trip === undefined) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="여행 상세" />
      </View>
    );
  }

  if (trip === null) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="여행 상세" />
        <AppText style={styles.errorText}>여행 정보를 찾을 수 없어요 (tripId: {tripId})</AppText>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title={trip.title} />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <AppText style={styles.heroTitle}>{trip.dateRange}</AppText>
          <AppText style={styles.heroSub}>
            방문 {trip.places.length}곳 · 촬영 클립 {trip.clipCount}개
          </AppText>
        </View>

        <SectionLabel text="방문 순서" />
        <Card>
          {trip.places.length === 0 ? (
            <AppText style={styles.errorText}>아직 촬영한 클립이 없어요</AppText>
          ) : (
            trip.places.map((place, idx) => (
              <PlaceRow key={place.order} place={place} isLast={idx === trip.places.length - 1} />
            ))
          )}
        </Card>
      </ScrollView>
    </View>
  );
}

function PlaceRow({ place, isLast }: { place: VisitedPlace; isLast: boolean }) {
  return (
    <ListRow
      isLast={isLast}
      title={place.name}
      subtitle={`${place.visitedAt} 방문`}
      right={
        <View style={styles.orderBadge}>
          <AppText style={styles.orderBadgeText}>{place.order}</AppText>
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
  orderBadgeText: { fontSize: 11, fontWeight: '800', color: colors.accent },
});
