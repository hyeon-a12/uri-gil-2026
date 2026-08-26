import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';

import { AppText as Text } from '@/components/AppText';
import NewTripModal from '@/components/NewTripModal';
import {
  Badge,
  Card,
  ListRow,
  ScreenHeader,
} from '@/components/common';
import { colors } from '@/constants/menu-theme';
import {
  getAllFolders,
  getFolderStatus,
  saveFolder,
  type FolderItem,
  type FolderStatus,
} from '@/services/folderService';
import { getRecordingsByFolder } from '@/services/recordingService';

const fabShadow = Platform.select({
  ios: {
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  android: {
    elevation: 4,
  },
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

type CreatedTrip = {
  name: string;
  region: string | null;
  memo: string;
  startDate: Date;
  endDate: Date;
  partySize: number;
  themes: string[];
  clipLengthSeconds: number;
  shootingStyle: FolderItem['shootingStyle'];
};

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}.${month}.${day}.`;
}

function buildDateRange(startDate: Date, endDate: Date): string {
  return `${formatDate(startDate)} ~ ${formatDate(endDate)}`;
}

function createFolderId(): string {
  return `folder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function MyRoutesScreen() {
  const router = useRouter();

  const [tab, setTab] = useState<FilterTab>('all');
  const [trips, setTrips] = useState<Trip[]>([]);
  const [newTripModalVisible, setNewTripModalVisible] = useState(false);

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

  const handleCreateTrip = () => {
    setNewTripModalVisible(true);
  };

  const handlePressTrip = (tripId: string) => {
    router.push({
      pathname: '/trip-detail/[tripId]',
      params: { tripId },
    });
  };

  const handleCloseNewTripModal = () => {
    setNewTripModalVisible(false);
  };

  const handleCreatedTrip = async (trip: CreatedTrip) => {
    const folder: FolderItem = {
      id: createFolderId(),
      title: trip.name.trim(),
      dateRange: buildDateRange(
        trip.startDate,
        trip.endDate,
      ),
      thumbnail: '',
      region: trip.region,
      memo: trip.memo,
      partySize: trip.partySize,
      themes: trip.themes,
      clipLengthSeconds: trip.clipLengthSeconds,
      shootingStyle: trip.shootingStyle,
    };

    try {
      await saveFolder(folder);
      await loadTrips();
    } catch (error) {
      console.error('새 여행 저장에 실패했습니다.', error);
    }
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
            label="여행중"
            active={tab === 'ing'}
            onPress={() => setTab('ing')}
          />
          <FilterChip
            label="여행완료"
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

      <Pressable
        style={({ pressed }) => [
          styles.fab,
          pressed && styles.fabPressed,
        ]}
        onPress={handleCreateTrip}
      >
        <Feather
          name="plus"
          size={22}
          color="#FFFFFF"
        />
      </Pressable>

      <NewTripModal
        visible={newTripModalVisible}
        onClose={handleCloseNewTripModal}
        onCreated={handleCreatedTrip}
      />
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
    <Pressable
      style={({ pressed }) => [
        styles.chip,
        active && styles.chipActive,
        pressed && styles.chipPressed,
      ]}
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
    </Pressable>
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
  },

  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: colors.card,
  },

  chipActive: {
    backgroundColor: colors.text,
  },

  chipPressed: {
    opacity: 0.75,
  },

  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSub,
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

  fabPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
});