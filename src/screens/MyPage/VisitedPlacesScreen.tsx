import React, { useCallback, useMemo, useState } from 'react';
import { View, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { AppText as Text } from '@/components/AppText';
import { colors } from '@/constants/menu-theme';
import { Card, ListRow, SectionLabel, ScreenHeader } from '@/components/common';
import { getAllFolders } from '@/services/folderService';
import { getAllRecordings } from '@/services/recordingService';

interface Place {
  id: string;
  name: string;
  visitedDate: string;
  tripId: string;
  tripTitle: string;
}

interface TripOption {
  id: string;
  label: string;
}

function formatDate(recordedAtIso: string): string {
  const d = new Date(recordedAtIso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

export default function VisitedPlacesScreen() {
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null); // null = 전체
  const [trips, setTrips] = useState<TripOption[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const [folders, recordings] = await Promise.all([
          getAllFolders(),
          getAllRecordings(),
        ]);
        const titleById = new Map(folders.map((f) => [f.id, f.title]));
        setTrips(folders.map((f) => ({ id: f.id, label: f.title })));

        // 같은 여행 안에서 같은 장소를 여러 번 촬영했으면 하나로 묶고, 가장 이른 촬영 시각을 방문일로 씀
        const grouped = new Map<
          string,
          { name: string; tripId: string; tripTitle: string; earliestIso: string }
        >();
        recordings.forEach((r) => {
          const name = r.location.placeName || '이름 없는 장소';
          const key = `${r.folderId}__${name}`;
          const existing = grouped.get(key);
          if (!existing || r.recordedAt < existing.earliestIso) {
            grouped.set(key, {
              name,
              tripId: r.folderId,
              tripTitle: titleById.get(r.folderId) ?? '알 수 없는 여행',
              earliestIso: r.recordedAt,
            });
          }
        });

        setPlaces(
          Array.from(grouped.entries()).map(([id, v]) => ({
            id,
            name: v.name,
            visitedDate: formatDate(v.earliestIso),
            tripId: v.tripId,
            tripTitle: v.tripTitle,
          })),
        );
      })();
    }, []),
  );

  const grouped = useMemo(() => {
    const filtered = selectedTripId ? places.filter((p) => p.tripId === selectedTripId) : places;
    const byTrip = new Map<string, Place[]>();
    filtered.forEach((place) => {
      const list = byTrip.get(place.tripTitle) ?? [];
      list.push(place);
      byTrip.set(place.tripTitle, list);
    });
    return Array.from(byTrip.entries());
  }, [places, selectedTripId]);

  return (
    <View style={styles.screen}>
      <ScreenHeader title="방문한 장소" />

      <View style={styles.body}>
        <View style={styles.tabs}>
          <FilterChip label="전체" active={selectedTripId === null} onPress={() => setSelectedTripId(null)} />
          {trips.map((trip) => (
            <FilterChip
              key={trip.id}
              label={trip.label}
              active={selectedTripId === trip.id}
              onPress={() => setSelectedTripId(trip.id)}
            />
          ))}
        </View>

        <ScrollView contentContainerStyle={styles.listContent}>
          {grouped.map(([tripTitle, tripPlaces]) => (
            <React.Fragment key={tripTitle}>
              <SectionLabel text={tripTitle} />
              <Card style={styles.card}>
                {tripPlaces.map((place, idx) => (
                  <ListRow
                    key={place.id}
                    isLast={idx === tripPlaces.length - 1}
                    title={place.name}
                    subtitle={`${place.visitedDate} 방문`}
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
