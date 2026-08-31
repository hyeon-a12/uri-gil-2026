import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { AppText as Text } from '@/components/AppText';
import { colors } from '@/constants/menu-theme';
import { ScreenHeader } from '@/components/common';
import { RoutePlanView } from '@/components/RoutePlanView';
import NewTripModal from '@/components/NewTripModal';
import {
  deleteFolder,
  getAllFolders,
  parseDateRange,
  updateFolder,
  type FolderItem,
} from '@/services/folderService';
import { getRecordingsByFolder } from '@/services/recordingService';
import { getTripScheduleStops } from '@/services/trip-schedule-service';
import { getStopOrder, saveStopOrder } from '@/services/stop-order-service';
import { buildPlanData, type PlanStop } from '@/services/tripPlanService';
import { useTripStore, clearCurrentTrip as clearActiveTrip } from '@/store/useTripStore';

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}.${month}.${day}.`;
}

function buildDateRange(startDate: Date, endDate: Date): string {
  return `${formatDate(startDate)} ~ ${formatDate(endDate)}`;
}

export default function TripDetailScreen() {
  // 파일명이 [tripId].tsx 라서, URL의 그 부분이 자동으로 tripId라는 파라미터로 들어옴
  // 예: router.push('/trip-detail/1') → tripId === '1'
  // tripId는 folderService에 저장된 폴더(여행)의 id와 같은 값입니다.
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const [trip, setTrip] = useState<FolderItem | null | undefined>(undefined);
  const [stops, setStops] = useState<PlanStop[]>([]);
  const [dayNumbers, setDayNumbers] = useState<number[]>([]);
  const [settingsVisible, setSettingsVisible] = useState(false);

  const loadTrip = useCallback(async () => {
    const folders = await getAllFolders();
    const folder = folders.find((f) => f.id === tripId);
    if (!folder) {
      setTrip(null);
      return;
    }

    const [recordings, scheduleStops, order] = await Promise.all([
      getRecordingsByFolder(tripId),
      getTripScheduleStops(tripId),
      getStopOrder(tripId),
    ]);
    const plan = buildPlanData(recordings, folder, scheduleStops, order);

    setTrip(folder);
    setStops(plan.stops);
    setDayNumbers(plan.dayNumbers);
  }, [tripId]);

  useFocusEffect(
    useCallback(() => {
      void loadTrip();
    }, [loadTrip]),
  );

  // RoutePlanView가 화면 안에서 즉시 순서를 반영해주므로, 여기선 다음 방문 때도
  // 유지되도록 AsyncStorage에 저장만 해줍니다(my-route.tsx의 handleReorderStops와 동일한 역할).
  const handleReorderStops = useCallback(
    (day: number, orderedIds: string[]) => {
      if (!tripId) return;
      void saveStopOrder(tripId, day, orderedIds);
    },
    [tripId],
  );

  const tripStartDate = useMemo(() => {
    if (!trip) return null;
    return parseDateRange(trip.dateRange)?.start ?? null;
  }, [trip]);

  const settingsInitialValues = useMemo(() => {
    if (!trip) return undefined;
    const range = parseDateRange(trip.dateRange);
    return {
      name: trip.title,
      region: trip.region ?? null,
      memo: trip.memo ?? '',
      partySize: trip.partySize ?? 1,
      themes: trip.themes ?? [],
      clipLengthSeconds: trip.clipLengthSeconds ?? 3,
      shootingStyle: trip.shootingStyle ?? 'basic',
      startDate: range?.start ?? new Date(),
      endDate: range?.end ?? new Date(),
    };
  }, [trip]);

  const handleSavedSettings: React.ComponentProps<typeof NewTripModal>['onSaved'] = async (
    updatedTrip,
  ) => {
    if (!trip) return;
    try {
      await updateFolder(trip.id, {
        title: updatedTrip.name.trim(),
        dateRange: buildDateRange(updatedTrip.startDate, updatedTrip.endDate),
        region: updatedTrip.region,
        memo: updatedTrip.memo,
        partySize: updatedTrip.partySize,
        themes: updatedTrip.themes,
        clipLengthSeconds: updatedTrip.clipLengthSeconds,
        shootingStyle: updatedTrip.shootingStyle,
      });

      // 현재 활성 여행이면 화면 상단 등에 쓰이는 캐시도 최신 값으로 갱신합니다.
      const currentTrip = useTripStore.getState().currentTrip;
      if (currentTrip?.id === trip.id) {
        useTripStore.getState().setCurrentTrip({
          ...currentTrip,
          title: updatedTrip.name.trim(),
          dateRange: buildDateRange(updatedTrip.startDate, updatedTrip.endDate),
          region: updatedTrip.region,
          memo: updatedTrip.memo,
          partySize: updatedTrip.partySize,
          themes: updatedTrip.themes,
        });
      }

      await loadTrip();
    } catch (error) {
      console.error('[TripDetailScreen] 여행 저장 실패:', error);
      Alert.alert('저장 실패', '여행 정보를 저장하는 중 문제가 발생했습니다.');
    }
  };

  const handleDeleteTrip = async () => {
    if (!trip) return;
    try {
      const currentTrip = useTripStore.getState().currentTrip;
      if (currentTrip?.id === trip.id) {
        await clearActiveTrip();
      }
      await deleteFolder(trip.id);
      router.back();
    } catch (error) {
      console.error('[TripDetailScreen] 여행 삭제 실패:', error);
      Alert.alert('삭제 실패', '여행을 삭제하는 중 문제가 발생했습니다.');
    }
  };

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
        <Text style={styles.errorText}>여행 정보를 찾을 수 없어요 (tripId: {tripId})</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={trip.title}
        right={
          <Pressable
            hitSlop={10}
            onPress={() => setSettingsVisible(true)}
            style={({ pressed }) => pressed && { opacity: 0.6 }}
          >
            <Ionicons name="pencil" size={20} color={colors.text} />
          </Pressable>
        }
      />

      <RoutePlanView
        hasTrip
        tripId={trip.id}
        stops={stops}
        dayNumbers={dayNumbers}
        tripStartDate={tripStartDate}
        onReorderStops={handleReorderStops}
        enableStopTools={false}
      />

      <NewTripModal
        visible={settingsVisible}
        mode="edit"
        initialValues={settingsInitialValues}
        onClose={() => setSettingsVisible(false)}
        onCreated={() => undefined}
        onSaved={handleSavedSettings}
        onDelete={handleDeleteTrip}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  errorText: { padding: 16, fontSize: 13, color: colors.textSub },
});
