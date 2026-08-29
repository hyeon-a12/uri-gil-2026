import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';

import { AppText as Text } from '@/components/AppText';
import {
  Badge,
  Card,
  HapticPressable,
  ListRow,
  ScreenHeader,
} from '@/components/common';
import { colors } from '@/constants/menu-theme';
import { RADIUS, SPACING } from '@/constants/color';
import {
  getAllFolders,
  getFolderStatus,
  type FolderStatus,
} from '@/services/folderService';
import { getRecordingsByFolder } from '@/services/recordingService';

const statusLabel: Record<FolderStatus, string> = {
  before: '예정',
  ing: '진행중',
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

type FilterTab = 'all' | 'before' | 'ing' | 'done';

export default function MyRoutesScreen() {
  const router = useRouter();

  const [tab, setTab] = useState<FilterTab>('all');
  const [trips, setTrips] = useState<Trip[]>([]);

  const loadTrips = useCallback(async () => {
    try {
      const folders = await getAllFolders();

      const withCounts = await Promise.all(
        folders.map(async (folder) => {
          const recordings = await getRecordingsByFolder(folder.id);

          const visitedCount = new Set(
            recordings
              .map((recording) => recording.location.placeName)
              .filter((name): name is string => Boolean(name)),
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
    } catch (error) {
      console.error('여행 목록을 불러오지 못했습니다.', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadTrips();
    }, [loadTrips]),
  );

  const filteredTrips = useMemo(
    () =>
      trips.filter(
        (trip) => tab === 'all' || trip.status === tab,
      ),
    [trips, tab],
  );

  const handlePressTrip = (tripId: string) => {
    router.push({
      pathname: '/trip-detail/[tripId]',
      params: { tripId },
    });
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="내 여행" />

      <View style={styles.body}>
        <View style={styles.tabs}>
          <FilterChip
            label="전체"
            active={tab === 'all'}
            onPress={() => setTab('all')}
          />
          <FilterChip
            label="예정"
            active={tab === 'before'}
            onPress={() => setTab('before')}
          />
          <FilterChip
            label="진행중"
            active={tab === 'ing'}
            onPress={() => setTab('ing')}
          />
          <FilterChip
            label="완료"
            active={tab === 'done'}
            onPress={() => setTab('done')}
          />
        </View>

        <FlatList
          data={filteredTrips}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Card style={styles.tripCard}>
              <ListRow
                isLast
                title={item.title}
                subtitle={`${item.dateRange} · 방문 ${item.visitedCount}곳 · 클립 ${item.clipCount}개`}
                onPress={() => handlePressTrip(item.id)}
                right={
                  item.status ? (
                    <Badge
                      variant={item.status}
                      label={statusLabel[item.status]}
                    />
                  ) : undefined
                }
              />
            </Card>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Feather
                name="map"
                size={28}
                color={colors.textSub}
              />
              <Text style={styles.emptyTitle}>
                아직 여행이 없어요
              </Text>
              <Text style={styles.emptyDescription}>
                새 여행을 만들어 첫 기록을 시작해보세요.
              </Text>
            </View>
          }
        />
      </View>
    </View>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <HapticPressable
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.chipText,
          active && styles.chipTextActive,
        ]}
      >
        {label}
      </Text>
    </HapticPressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },

  body: {
    flex: 1,
    paddingHorizontal: 16,
  },

  tabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },

  listContent: {
    flexGrow: 1,
    paddingBottom: 100,
  },

  tripCard: {
    marginBottom: 10,
    backgroundColor: '#FBFBFA',
    shadowOpacity: 0,
    elevation: 0,
  },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.banner,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },

  chipActive: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },

  chipText: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.text,
  },

  chipTextActive: {
    color: '#FFFFFF',
  },

  emptyState: {
    flex: 1,
    minHeight: 300,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  emptyTitle: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },

  emptyDescription: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    color: colors.textSub,
  },
});