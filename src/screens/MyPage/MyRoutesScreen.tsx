import React, { useMemo, useState } from 'react';
import { View, FlatList, Pressable, StyleSheet, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { AppText as Text } from '@/components/AppText';
import { colors } from '@/constants/menu-theme';
import { Card, ListRow, Badge, ScreenHeader } from '@/components/common';

// 주의: BadgeVariant는 공용 컴포넌트 라이브러리에 없을 수 있어서
// 이 화면 안에서만 쓰는 로컬 타입으로 정의함 (Badge.tsx의 variant prop과 이름만 맞으면 됨)
type BadgeVariant = 'ing' | 'done' | 'before';

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

// ────────────────────────────────────────────────
// 여행 상태는 DB에 저장하지 않고 날짜로부터 계산 (팀에서 확정한 규칙)
// - 이 함수 하나만 있으면, 자정마다 배치 돌려서 status 필드 업데이트할 필요가 없음
// - "지금 몇 시냐"에 따라 화면 열 때마다 값이 자동으로 맞게 나옴
// ────────────────────────────────────────────────
function getTripStatus(startDate: Date, endDate: Date, now: Date = new Date()): BadgeVariant {
  if (now < startDate) return 'before';
  if (now > endDate) return 'done';
  return 'ing';
}

const statusLabel: Record<BadgeVariant, string> = {
  before: '예정',
  ing: '여행중',
  done: '완료',
};

interface Trip {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  visitedCount: number;
  clipCount: number;
}

// TODO: 실제로는 API에서 받아옴. 지금은 화면 확인용 목데이터.
const MOCK_TRIPS: Trip[] = [
  {
    id: '1',
    title: '전주 한옥마을 힐링 여행',
    startDate: new Date('2026-07-15'),
    endDate: new Date('2026-07-17'),
    visitedCount: 4,
    clipCount: 6,
  },
  {
    id: '2',
    title: '객리단길 골목 탐방',
    startDate: new Date('2026-06-02'),
    endDate: new Date('2026-06-03'),
    visitedCount: 7,
    clipCount: 11,
  },
  {
    id: '3',
    title: '팔복예술공장 아트투어',
    startDate: new Date('2026-08-20'),
    endDate: new Date('2026-08-21'),
    visitedCount: 0,
    clipCount: 0,
  },
];

type FilterTab = 'all' | 'ing' | 'done';

export default function MyRoutesScreen() {
  const [tab, setTab] = useState<FilterTab>('all');

  // 화면 열릴 때마다 한 번씩만 계산하면 되니 useMemo로 감쌈.
  // trips 배열이나 tab이 바뀔 때만 다시 계산됨.
  const filteredTrips = useMemo(() => {
    return MOCK_TRIPS.map((trip) => ({ ...trip, status: getTripStatus(trip.startDate, trip.endDate) })).filter(
      (trip) => tab === 'all' || trip.status === tab
    );
  }, [tab]);

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
                subtitle={`${formatDate(item.startDate)} - ${formatDate(item.endDate)} · 방문 ${item.visitedCount}곳 · 클립 ${item.clipCount}개`}
                onPress={() => handlePressTrip(item.id)}
                right={<Badge variant={item.status} label={statusLabel[item.status]} />}
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

function formatDate(date: Date): string {
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
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
