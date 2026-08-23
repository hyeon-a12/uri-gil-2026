import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { AppText as Text } from '@/components/AppText';
import { colors } from '@/constants/menu-theme';
import { ScreenHeader } from '@/components/common';
import { RouteMapPreview } from '@/components/RouteMapPreview';
import { getAllFolders, type FolderItem } from '@/services/folderService';
import { getRecordingsByFolder } from '@/services/recordingService';
import { buildPlanData, type PlanStop, type PlanTravelLog } from '@/services/tripPlanService';

export default function TripDetailScreen() {
  // 파일명이 [tripId].tsx 라서, URL의 그 부분이 자동으로 tripId라는 파라미터로 들어옴
  // 예: router.push('/trip-detail/1') → tripId === '1'
  // tripId는 folderService에 저장된 폴더(여행)의 id와 같은 값입니다.
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const [trip, setTrip] = useState<FolderItem | null | undefined>(undefined);
  const [stops, setStops] = useState<PlanStop[]>([]);
  const [travelLogs, setTravelLogs] = useState<PlanTravelLog[]>([]);
  const [dayNumbers, setDayNumbers] = useState<number[]>([]);

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
        const plan = buildPlanData(recordings, folder);

        setTrip(folder);
        setStops(plan.stops);
        setTravelLogs(plan.travelLogs);
        setDayNumbers(plan.dayNumbers);
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
        <Text style={styles.errorText}>여행 정보를 찾을 수 없어요 (tripId: {tripId})</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title={trip.title} />
      <TripPlanView trip={trip} stops={stops} travelLogs={travelLogs} dayNumbers={dayNumbers} />
    </View>
  );
}

type TripPlanViewProps = {
  trip: FolderItem;
  stops: PlanStop[];
  travelLogs: PlanTravelLog[];
  dayNumbers: number[];
};

// my-route.tsx의 '일정' 탭(RoutePlanView)과 같은 구성(일자별 타임라인 + 이동 중
// 기록)을 여행 상세에서도 그대로 보여줍니다. 다만 메모 남기기 기능은 뺐어요.
function TripPlanView({ trip, stops, travelLogs, dayNumbers }: TripPlanViewProps) {
  const [selectedDay, setSelectedDay] = useState(dayNumbers[0] ?? 1);

  useEffect(() => {
    if (!dayNumbers.includes(selectedDay)) {
      setSelectedDay(dayNumbers[0] ?? 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayNumbers]);

  const dayStops = useMemo(
    () => stops.filter((stop) => stop.day === selectedDay).sort((a, b) => a.order - b.order),
    [stops, selectedDay],
  );

  const dayLogs = useMemo(
    () => travelLogs.filter((log) => log.day === selectedDay),
    [travelLogs, selectedDay],
  );

  if (stops.length === 0 && travelLogs.length === 0) {
    return (
      <View style={styles.planEmptyState}>
        <Ionicons name="videocam-outline" size={32} color={colors.textTertiary} />
        <Text style={styles.planEmptyTitle}>아직 촬영한 클립이 없어요</Text>
        <Text style={styles.planEmptyDescription}>
          {trip.title}에서 촬영한 클립이 없어서 일정을 만들 수 없어요.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.planScreen}>
      <ScrollView contentContainerStyle={styles.planContent} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>{trip.dateRange}</Text>
        </View>

        <View style={styles.mapWrapper}>
          <RouteMapPreview />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dayChipRow}
        >
          {dayNumbers.map((day) => {
            const selected = day === selectedDay;
            return (
              <Pressable
                key={day}
                onPress={() => setSelectedDay(day)}
                style={[styles.dayChip, selected && styles.dayChipSelected]}
              >
                <Text style={[styles.dayChipText, selected && styles.dayChipTextSelected]}>
                  Day {day}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.planTimeline}>
          {dayStops.map((stop, index) => (
            <View key={stop.id} style={styles.planTimelineRow}>
              <View style={styles.planTimelineIndicator}>
                <View style={styles.planTimelineDot}>
                  <Text style={styles.planTimelineDotText}>{stop.order}</Text>
                </View>

                {index < dayStops.length - 1 ? (
                  <View style={styles.planTimelineLineArea}>
                    <View style={styles.planTimelineLine} />
                  </View>
                ) : null}
              </View>

              <View style={styles.planStopCard}>
                <View style={styles.planStopCardTop}>
                  <View style={styles.planStopTextArea}>
                    <Text numberOfLines={1} style={styles.planStopName}>
                      {stop.name}
                    </Text>
                    <Text style={styles.planStopMeta}>
                      {stop.time} · 클립 {stop.clips.length}개
                    </Text>
                  </View>

                  <Pressable
                    hitSlop={8}
                    onPress={() => {
                      Alert.alert(stop.name, '장소 상세 정보 화면으로 연결할 예정입니다.');
                    }}
                    style={styles.planStopIconButton}
                  >
                    <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                  </Pressable>
                </View>
              </View>
            </View>
          ))}
        </View>

        {dayLogs.length > 0 && (
          <View style={styles.travelLogSection}>
            <View style={styles.travelLogHeader}>
              <Text style={styles.travelLogTitle}>이동 중 기록</Text>
              <Text style={styles.travelLogSubtitle}>장소 미지정 클립</Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.travelLogList}
            >
              {dayLogs.map((log) => (
                <Pressable
                  key={log.id}
                  onPress={() => {
                    Alert.alert(
                      '미분류 기록',
                      '촬영 시 장소를 입력하지 않은 클립이에요.',
                    );
                  }}
                  style={styles.travelLogItem}
                >
                  <View style={styles.travelLogThumbWrapper}>
                    <Image source={{ uri: log.thumbnail }} style={styles.travelLogThumb} />
                    <View style={[styles.travelLogBadge, styles.travelLogBadgeUnmatched]}>
                      <Ionicons name="location-outline" size={9} color={colors.textSub} />
                    </View>
                  </View>
                  <Text numberOfLines={1} style={styles.travelLogTime}>
                    미분류 · {log.time}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  errorText: { padding: 16, fontSize: 13, color: colors.textSub },

  planScreen: { flex: 1 },
  planContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },

  hero: { paddingBottom: 14 },
  heroTitle: { fontSize: 13, fontWeight: '700', color: colors.textSub },
  mapWrapper: { marginBottom: 20 },

  planEmptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 8,
  },
  planEmptyTitle: { marginTop: 6, color: colors.text, fontSize: 15, fontWeight: '800' },
  planEmptyDescription: {
    color: colors.textSub,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },

  dayChipRow: { flexDirection: 'row', gap: 8, paddingBottom: 4 },
  dayChip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayChipSelected: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  dayChipText: { color: colors.textSub, fontSize: 12, fontWeight: '700' },
  dayChipTextSelected: { color: colors.accentDark, fontWeight: '800' },

  planTimeline: { marginTop: 20 },
  planTimelineRow: { flexDirection: 'row', gap: 12 },
  planTimelineIndicator: { width: 40, alignItems: 'center' },
  planTimelineDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  planTimelineDotText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  planTimelineLineArea: {
    flex: 1,
    width: '100%',
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planTimelineLine: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    width: 2,
    backgroundColor: '#FFD2C2',
  },
  planStopCard: {
    flex: 1,
    marginBottom: 12,
    paddingHorizontal: 13,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  planStopCardTop: { flexDirection: 'row', alignItems: 'center' },
  planStopTextArea: { flex: 1 },
  planStopName: { color: colors.text, fontSize: 14, fontWeight: '800' },
  planStopMeta: { marginTop: 2, color: colors.textSub, fontSize: 11, fontWeight: '500' },
  planStopIconButton: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },

  travelLogSection: { marginTop: 8 },
  travelLogHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  travelLogTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  travelLogSubtitle: { color: colors.textTertiary, fontSize: 11, fontWeight: '500' },
  travelLogList: { gap: 10 },
  travelLogItem: { width: 68 },
  travelLogThumbWrapper: { position: 'relative' },
  travelLogThumb: { width: 68, height: 68, borderRadius: 14, backgroundColor: '#E8E5DF' },
  travelLogBadge: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  travelLogBadgeUnmatched: { backgroundColor: '#FFFFFF' },
  travelLogTime: { marginTop: 5, color: colors.textSub, fontSize: 10, fontWeight: '600', textAlign: 'center' },
});
