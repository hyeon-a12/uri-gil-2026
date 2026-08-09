import React, { useCallback, useMemo, useState } from 'react';
import { View, Image, Pressable, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { AppText as Text } from '@/components/AppText';
import { colors } from '@/constants/menu-theme';
import { SectionLabel, ScreenHeader } from '@/components/common';
import { getAllFolders } from '@/services/folderService';
import { getAllRecordings } from '@/services/recordingService';

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

const GAP = 10;
const COLUMN_WIDTH = (Dimensions.get('window').width - 16 * 2 - GAP) / 2;

export default function MyClipsScreen() {
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null); // null = 전체
  const [trips, setTrips] = useState<TripOption[]>([]);
  const [clips, setClips] = useState<Clip[]>([]);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const [folders, recordings] = await Promise.all([
          getAllFolders(),
          getAllRecordings(),
        ]);
        const titleById = new Map(folders.map((f) => [f.id, f.title]));

        setTrips(folders.map((f) => ({ id: f.id, label: f.title })));
        setClips(
          recordings.map((r) => ({
            id: r.id,
            place: r.location.placeName || '이름 없는 장소',
            durationSec: r.durationMs ? Math.round(r.durationMs / 1000) : 0,
            thumbnailUrl: r.thumbnail,
            tripId: r.folderId,
            tripTitle: titleById.get(r.folderId) ?? '알 수 없는 여행',
          })),
        );
      })();
    }, []),
  );

  // 선택된 여행이 있으면 그 여행 클립만, 없으면 여행별로 묶어서 전부 보여줌
  const grouped = useMemo(() => {
    const filtered = selectedTripId ? clips.filter((c) => c.tripId === selectedTripId) : clips;
    const byTrip = new Map<string, Clip[]>();
    filtered.forEach((clip) => {
      const list = byTrip.get(clip.tripTitle) ?? [];
      list.push(clip);
      byTrip.set(clip.tripTitle, list);
    });
    return Array.from(byTrip.entries()); // [ [tripTitle, Clip[]], ... ]
  }, [clips, selectedTripId]);

  return (
    <View style={styles.screen}>
      <ScreenHeader title="촬영한 클립" />

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
          {grouped.map(([tripTitle, clips]) => (
            <View key={tripTitle} style={styles.tripGroup}>
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
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1, padding: 16 },
  listContent: { paddingBottom: 40 },
  tripGroup: { marginBottom: 4 },
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
