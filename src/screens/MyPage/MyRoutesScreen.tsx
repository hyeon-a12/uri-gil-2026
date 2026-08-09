import React, { useCallback, useMemo, useState } from 'react';
import { View, FlatList, Pressable, StyleSheet, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { AppText as Text } from '@/components/AppText';
import { colors } from '@/constants/menu-theme';
import { Card, ListRow, Badge, ScreenHeader } from '@/components/common';
import {
  getAllFolders,
  getFolderStatus,
  type FolderStatus,
} from '@/services/folderService';
import { getRecordingsByFolder } from '@/services/recordingService';

// FAB 그림자도 공용 cardShadow를 안 쓰고 이 파일 안에서 직접 정의
// (iOS/Android 그림자 처리 방식이 달라서 분기 필요 — 이유는 지난번에 설명한 것과 동일)
const fabShadow = Platform.select({
  ios: {
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  android: { elevation: 4 },
});

const statusLabel: Record<FolderStatus, string> = {
  before: '예정',
  ing: '여행중',
  done: '완료',
};

interface Trip {
  id: string;
  title: string;
  dateRange: string;
  status: FolderStatus | null;
  visitedCount: number;
  clipCount: number;
}

type FilterTab = 'all' | 'ing' | 'done';

export default function MyRoutesScreen() {
  const [tab, setTab] = useState<FilterTab>('all');
  const [trips, setTrips] = useState<Trip[]>([]);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const folders = await getAllFolders();
        const withCounts = await Promise.all(
          folders.map(async (folder) => {
            const recordings = await getRecordingsByFolder(folder.id);
            const visitedCount = new Set(
              recordings
                .map((r) => r.location.placeName)
                .filter((name): name is string => !!name),
            ).size;

            return {
              id: folder.id,
              title: folder.title,
              dateRange: folder.dateRange,
              status: getFolderStatus(folder),
              visitedCount,
              clipCount: recordings.length,
            };
          }),
        );
        setTrips(withCounts);
      })();
    }, []),
  );

  const filteredTrips = useMemo(
    () => trips.filter((trip) => tab === 'all' || trip.status === tab),
    [trips, tab],
  );

  // TODO: 아직 별도의 '코스 만들기' 화면이 없어서, 임시로 내 루트 탭(경로 계획 시작점)으로 이동시킵니다.
  const handleCreateTrip = () => router.push('/(tabs)/my-route');

  const handlePressTrip = (tripId: string) => {
    router.push({ pathname: '/trip-detail/[tripId]', params: { tripId } });
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="내 루트" />

      <View style={styles.body}>
        <View style={styles.tabs}>
          <FilterChip label="전체" active={tab === 'all'} onPress={() => setTab('all')} />
          <FilterChip label="여행중" active={tab === 'ing'} onPress={() => setTab('ing')} />
          <FilterChip label="여행완료" active={tab === 'done'} onPress={() => setTab('done')} />
        </View>

        <FlatList
          data={filteredTrips}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Card style={styles.tripCard}>
              <ListRow
                isLast
                title={item.title}
                subtitle={`${item.dateRange} · 방문 ${item.visitedCount}곳 · 클립 ${item.clipCount}개`}
                onPress={() => handlePressTrip(item.id)}
                right={
                  item.status ? (
                    <Badge variant={item.status} label={statusLabel[item.status]} />
                  ) : undefined
                }
              />
            </Card>
          )}
        />
      </View>

      <Pressable style={styles.fab} onPress={handleCreateTrip}>
        <Feather name="plus" size={22} color="#fff" />
      </Pressable>
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
  body: { flex: 1, paddingHorizontal: 16 },
  listContent: { paddingBottom: 100 },
  tripCard: { marginBottom: 10 },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: colors.card },
  chipActive: { backgroundColor: colors.text },
  chipText: { fontSize: 12, fontWeight: '700', color: colors.textSub },
  chipTextActive: { color: '#fff' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...fabShadow,
  },
});
