import React, { useMemo, useState } from 'react';
import { View, Text, Image, Pressable, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from '@/constants/menu-theme';
import { SectionLabel } from '@/components/common';

interface Clip {
  id: string;
  place: string;
  durationSec: number;
  thumbnailUrl: string;
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
  { id: 'trip3', label: '팔복예술공장' },
];

const MOCK_CLIPS: Clip[] = [
  { id: '1', place: '객리단길 카페거리', durationSec: 14, thumbnailUrl: '', tripId: 'trip1', tripTitle: '전주 한옥마을 힐링 여행' },
  { id: '2', place: '덕진공원 연못길', durationSec: 9, thumbnailUrl: '', tripId: 'trip1', tripTitle: '전주 한옥마을 힐링 여행' },
  { id: '3', place: '팔복예술공장', durationSec: 21, thumbnailUrl: '', tripId: 'trip2', tripTitle: '객리단길 골목 탐방' },
];

const GAP = 10;
const COLUMN_WIDTH = (Dimensions.get('window').width - 16 * 2 - GAP) / 2;

export default function MyClipsScreen() {
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null); // null = 전체

  // 선택된 여행이 있으면 그 여행 클립만, 없으면 여행별로 묶어서 전부 보여줌
  const grouped = useMemo(() => {
    const filtered = selectedTripId ? MOCK_CLIPS.filter((c) => c.tripId === selectedTripId) : MOCK_CLIPS;
    const byTrip = new Map<string, Clip[]>();
    filtered.forEach((clip) => {
      const list = byTrip.get(clip.tripTitle) ?? [];
      list.push(clip);
      byTrip.set(clip.tripTitle, list);
    });
    return Array.from(byTrip.entries()); // [ [tripTitle, Clip[]], ... ]
  }, [selectedTripId]);

  return (
    <View style={styles.screen}>
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

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {grouped.map(([tripTitle, clips]) => (
          <View key={tripTitle} style={{ marginBottom: 4 }}>
            <SectionLabel text={tripTitle} />
            <View style={styles.grid}>
              {clips.map((clip) => (
                <ClipThumbnail key={clip.id} clip={clip} />
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
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

function ClipThumbnail({ clip }: { clip: Clip }) {
  return (
    <Pressable style={styles.clip}>
      {clip.thumbnailUrl ? (
        <Image source={{ uri: clip.thumbnailUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.placeholder]} />
      )}
      <View style={styles.overlay} />
      <View style={styles.tag}>
        <Text style={styles.tagText}>{clip.place.split(' ')[0]}</Text>
      </View>
      <Feather name="play" size={24} color="rgba(255,255,255,0.9)" style={styles.playIcon} />
      <View style={styles.info}>
        <Text style={styles.infoPlace} numberOfLines={1}>{clip.place}</Text>
        <Text style={styles.infoDur}>0:{String(clip.durationSec).padStart(2, '0')}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: colors.card },
  chipActive: { backgroundColor: colors.text },
  chipText: { fontSize: 12, fontWeight: '700', color: colors.textSub },
  chipTextActive: { color: '#fff' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, marginBottom: 10 },
  clip: {
    width: COLUMN_WIDTH,
    aspectRatio: 9 / 13,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#C3BCAA',
  },
  placeholder: { backgroundColor: '#C3BCAA' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.15)' },
  tag: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 20,
  },
  tagText: { fontSize: 10, fontWeight: '700', color: colors.text },
  playIcon: { position: 'absolute', top: '45%', left: '42%' },
  info: { position: 'absolute', bottom: 8, left: 10, right: 10 },
  infoPlace: { fontSize: 12, fontWeight: '700', color: '#fff' },
  infoDur: { fontSize: 10, color: '#fff', opacity: 0.85, marginTop: 2 },
});
