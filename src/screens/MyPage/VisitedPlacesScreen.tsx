import React, { useMemo, useState } from 'react';
import { View, Pressable, ScrollView, StyleSheet } from 'react-native';
import { AppText as Text } from '@/components/AppText';
import { colors } from '@/constants/menu-theme';
import { Card, ListRow, SectionLabel, ScreenHeader } from '@/components/common';

interface Place {
  id: string;
  name: string;
  category: string;
  visitedDate: string;
  tripId: string;
  tripTitle: string;
}

interface TripOption {
  id: string;
  label: string;
}

// TODO: 실제로는 API에서 받아옴
const TRIPS: TripOption[] = [
  { id: 'trip1', label: '한옥마을 여행' },
  { id: 'trip2', label: '객리단길 탐방' },
];

const PLACES: Place[] = [
  { id: '1', name: '객리단길 카페거리', category: '카페', visitedDate: '2026.07.16', tripId: 'trip1', tripTitle: '전주 한옥마을 힐링 여행' },
  { id: '2', name: '덕진공원', category: '관광지', visitedDate: '2026.07.16', tripId: 'trip1', tripTitle: '전주 한옥마을 힐링 여행' },
  { id: '3', name: '전주 한옥마을', category: '관광지', visitedDate: '2026.07.15', tripId: 'trip1', tripTitle: '전주 한옥마을 힐링 여행' },
  { id: '4', name: '팔복예술공장', category: '문화시설', visitedDate: '2026.06.03', tripId: 'trip2', tripTitle: '객리단길 골목 탐방' },
];

export default function VisitedPlacesScreen() {
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null); // null = 전체

  const grouped = useMemo(() => {
    const filtered = selectedTripId ? PLACES.filter((p) => p.tripId === selectedTripId) : PLACES;
    const byTrip = new Map<string, Place[]>();
    filtered.forEach((place) => {
      const list = byTrip.get(place.tripTitle) ?? [];
      list.push(place);
      byTrip.set(place.tripTitle, list);
    });
    return Array.from(byTrip.entries());
  }, [selectedTripId]);

  return (
    <View style={styles.screen}>
      <ScreenHeader title="방문한 장소" />

      <View style={styles.body}>
        <View style={styles.tabs}>
          <FilterChip label="전체" active={selectedTripId === null} onPress={() => setSelectedTripId(null)} />
          {TRIPS.map((trip) => (
            <FilterChip
              key={trip.id}
              label={trip.label}
              active={selectedTripId === trip.id}
              onPress={() => setSelectedTripId(trip.id)}
            />
          ))}
        </View>

        <ScrollView contentContainerStyle={styles.listContent}>
          {grouped.map(([tripTitle, places]) => (
            <React.Fragment key={tripTitle}>
              <SectionLabel text={tripTitle} />
              <Card style={styles.card}>
                {places.map((place, idx) => (
                  <ListRow
                    key={place.id}
                    isLast={idx === places.length - 1}
                    title={place.name}
                    subtitle={`${place.category} · ${place.visitedDate} 방문`}
                    onPress={() => {}}
                  />
                ))}
              </Card>
            </React.Fragment>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1, padding: 16 },
  listContent: { paddingBottom: 40 },
  card: { marginBottom: 14 },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: colors.card },
  chipActive: { backgroundColor: colors.text },
  chipText: { fontSize: 12, fontWeight: '700', color: colors.textSub },
  chipTextActive: { color: '#fff' },
});
