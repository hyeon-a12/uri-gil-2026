import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { AppText as Text } from '@/components/AppText';
import { HapticPressable } from '@/components/common';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { COLORS as SHARED_COLORS, RADIUS, SPACING } from '@/constants/color';
import { getDayLabel, type PlanStop } from '@/services/tripPlanService';
import { getStopMemos, saveStopMemo } from '@/services/stop-memo-service';

// my-route.tsx '일정' 탭에서 쓰던 UI를 그대로 뽑아낸 컴포넌트입니다.
// 여행 상세 화면(trip-detail/[tripId].tsx)에서도 똑같은 모양을 써야 해서
// 한 곳에만 두고 두 화면이 같이 씁니다 — 여기 스타일을 고치면 두 화면 모두 바뀝니다.

const COLORS = {
  background: SHARED_COLORS.background,
  card: SHARED_COLORS.background,

  primary: SHARED_COLORS.accent,
  primarySoft: SHARED_COLORS.main,

  textPrimary: SHARED_COLORS.textPrimary,
  textSecondary: SHARED_COLORS.textSecondary,
  textTertiary: SHARED_COLORS.textSecondary,

  border: SHARED_COLORS.border,

  routeSoft: '#FFD2C2',
};

type MemoEditorModalProps = {
  visible: boolean;
  stopName: string | null;
  draft: string;
  onChangeDraft: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
};

function MemoEditorModal({
  visible,
  stopName,
  draft,
  onChangeDraft,
  onSave,
  onClose,
}: MemoEditorModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.memoModalBackdrop}>
        <View style={styles.memoModalCard}>
          <Text allowFontScaling={false} style={styles.memoModalTitle}>
            {stopName ?? ''} 메모
          </Text>

          <Text allowFontScaling={false} style={styles.memoModalHint}>
            좋았던 점, 먹은 음식처럼 남기고 싶은 걸 적어보세요.
          </Text>

          <TextInput
            value={draft}
            onChangeText={onChangeDraft}
            placeholder="예: 노을이 예뻤고, 옆 포차에서 먹은 딱새우회가 최고였다."
            placeholderTextColor={COLORS.textTertiary}
            multiline
            autoFocus
            style={styles.memoInput}
          />

          <View style={styles.memoModalButtonRow}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.memoModalButton,
                styles.memoModalButtonGhost,
                pressed && styles.cardPressed,
              ]}
            >
              <Text allowFontScaling={false} style={styles.memoModalButtonGhostText}>
                취소
              </Text>
            </Pressable>

            <Pressable
              onPress={onSave}
              style={({ pressed }) => [
                styles.memoModalButton,
                styles.memoModalButtonPrimary,
                pressed && styles.cardPressed,
              ]}
            >
              <Text allowFontScaling={false} style={styles.memoModalButtonPrimaryText}>
                저장
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export type RoutePlanViewProps = {
  hasTrip: boolean;
  tripId?: string;
  stops: PlanStop[];
  dayNumbers: number[];
  tripStartDate: Date | null;
  onReorderStops: (day: number, orderedIds: string[]) => void;
};

// stops/dayNumbers는 활성 여행의 실제 클립(recordingService)에서
// 파생된 데이터입니다(부모가 buildPlanData()로 만들어 내려줌).
export function RoutePlanView({
  hasTrip,
  tripId,
  stops,
  dayNumbers,
  tripStartDate,
  onReorderStops,
}: RoutePlanViewProps) {
  const [selectedDay, setSelectedDay] = useState(dayNumbers[0] ?? 1);

  const [stopMemos, setStopMemos] = useState<Record<string, string>>({});

  const [memoModalVisible, setMemoModalVisible] = useState(false);
  const [activeStopId, setActiveStopId] = useState<string | null>(null);
  const [memoDraft, setMemoDraft] = useState('');

  // 메모를 AsyncStorage에 저장해서, 일정/지도 탭을 오가며 이 컴포넌트가
  // 언마운트-리마운트돼도(my-route.tsx가 탭에 따라 조건부로 렌더링함) 메모가
  // 사라지지 않도록 합니다. tripId가 바뀌면(여행 전환) 그 여행의 메모로 다시 불러옵니다.
  useEffect(() => {
    if (!tripId) {
      setStopMemos({});
      return;
    }

    let isActive = true;
    void getStopMemos(tripId).then((memos) => {
      if (isActive) setStopMemos(memos);
    });

    return () => {
      isActive = false;
    };
  }, [tripId]);

  // 여행을 전환해서 날짜 목록 자체가 바뀌면, 이전 여행의 day 선택이 남아있지
  // 않도록 첫 번째 날로 되돌립니다.
  useEffect(() => {
    if (!dayNumbers.includes(selectedDay)) {
      setSelectedDay(dayNumbers[0] ?? 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayNumbers]);

  // 드래그로 순서를 바꾸는 동안 즉시 화면에 반영되도록 로컬 상태로 들고 있고,
  // stops/selectedDay가 바뀌면(다른 날짜로 전환, 새로고침 등) 최신 데이터로 다시 채웁니다.
  const [dayStops, setDayStops] = useState<PlanStop[]>([]);

  useEffect(() => {
    setDayStops(
      stops.filter((stop) => stop.day === selectedDay).sort((a, b) => a.order - b.order),
    );
  }, [stops, selectedDay]);

  // 스톱을 한 칸 위/아래로 옮기고, 바뀐 순서를 바로 저장합니다.
  const moveStop = useCallback(
    (index: number, direction: -1 | 1) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= dayStops.length) return;

      const next = [...dayStops];
      const [moved] = next.splice(index, 1);
      next.splice(targetIndex, 0, moved);

      setDayStops(next);
      onReorderStops(
        selectedDay,
        next.map((stop) => stop.id),
      );
    },
    [dayStops, selectedDay, onReorderStops],
  );

  // 카드를 길게 누르면 뜨는 "위로 이동 / 아래로 이동" 메뉴.
  const openReorderMenu = useCallback(
    (stop: PlanStop, index: number) => {
      const options: {
        text: string;
        onPress?: () => void;
        style?: 'cancel' | 'destructive';
      }[] = [];

      if (index > 0) {
        options.push({ text: '위로 이동', onPress: () => moveStop(index, -1) });
      }
      if (index < dayStops.length - 1) {
        options.push({ text: '아래로 이동', onPress: () => moveStop(index, 1) });
      }
      options.push({ text: '취소', style: 'cancel' });

      Alert.alert(stop.name, '순서를 바꿀 수 있어요.', options);
    },
    [dayStops.length, moveStop],
  );

  const activeStop = useMemo(
    () => stops.find((stop) => stop.id === activeStopId) ?? null,
    [stops, activeStopId],
  );

  const openMemoEditor = (stop: PlanStop) => {
    setActiveStopId(stop.id);
    setMemoDraft(stopMemos[stop.id] ?? '');
    setMemoModalVisible(true);
  };

  const closeMemoEditor = () => {
    setMemoModalVisible(false);
  };

  const saveMemo = () => {
    if (activeStopId && tripId) {
      const trimmed = memoDraft.trim();

      setStopMemos((prev) => {
        const next = { ...prev };

        if (trimmed.length > 0) {
          next[activeStopId] = trimmed;
        } else {
          delete next[activeStopId];
        }

        return next;
      });

      void saveStopMemo(tripId, activeStopId, trimmed);
    }

    setMemoModalVisible(false);
  };

  if (!hasTrip) {
    return (
      <View style={styles.planEmptyState}>
        <Image
          source={require('@/assets/images/HanOk.png')}
          style={{ width: 32, height: 32 }}
          contentFit="contain"
        />
        <Text allowFontScaling={false} style={styles.planEmptyTitle}>
          선택된 여행이 없어요
        </Text>
        <Text allowFontScaling={false} style={styles.planEmptyDescription}>
          홈 화면 상단에서 여행을 선택하거나 새로 만들어주세요.
        </Text>
      </View>
    );
  }

  if (stops.length === 0) {
    return (
      <View style={styles.planEmptyState}>
        <Ionicons name="videocam-outline" size={32} color={COLORS.textTertiary} />
        <Text allowFontScaling={false} style={styles.planEmptyTitle}>
          아직 촬영한 클립이 없어요
        </Text>
        <Text allowFontScaling={false} style={styles.planEmptyDescription}>
          카메라로 이 여행의 첫 순간을 기록해보세요.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.planScreen}>
      <ScrollView
        style={styles.alternativeView}
        contentContainerStyle={styles.planContent}
        showsVerticalScrollIndicator={false}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dayChipRow}
        >
          {dayNumbers.map((day) => {
            const selected = day === selectedDay;

            return (
              <HapticPressable
                key={day}
                onPress={() => setSelectedDay(day)}
                style={[styles.dayChip, selected && styles.dayChipSelected]}
              >
                <Text
                  allowFontScaling={false}
                  style={[styles.dayChipText, selected && styles.dayChipTextSelected]}
                >
                  {getDayLabel(day, tripStartDate)}
                </Text>
              </HapticPressable>
            );
          })}
        </ScrollView>

        <View style={styles.planTimeline}>
          {dayStops.map((stop, index) => {
            const memo = stopMemos[stop.id];

            return (
              <View key={stop.id} style={styles.planTimelineRow}>
                <View style={styles.planTimelineIndicator}>
                  <View style={styles.planTimelineDot}>
                    <Text allowFontScaling={false} style={styles.planTimelineDotText}>
                      {stop.order}
                    </Text>
                  </View>

                  {index < dayStops.length - 1 ? (
                    <View style={styles.planTimelineLineArea}>
                      <View style={styles.planTimelineLine} />
                    </View>
                  ) : null}
                </View>

                <Pressable style={styles.planStopCard} onLongPress={() => openReorderMenu(stop, index)}>
                  <View style={styles.planStopCardTop}>
                    <View style={styles.planStopStickerCircle}>
                      <Ionicons name="location" size={18} color={COLORS.primary} />
                    </View>

                    <View style={styles.planStopTextArea}>
                      <Text numberOfLines={1} allowFontScaling={false} style={styles.planStopName}>
                        {stop.name}
                      </Text>

                      <Text allowFontScaling={false} style={styles.planStopMeta}>
                        {stop.source === 'ai-recommendation'
                          ? 'AI 추천으로 추가됨'
                          : stop.source === 'manual'
                          ? '직접 추가한 장소'
                          : `${stop.time} · 클립 ${stop.clips.length}개`}
                      </Text>
                    </View>

                    <Pressable
                      hitSlop={8}
                      onPress={() => openReorderMenu(stop, index)}
                      style={styles.planStopIconButton}
                    >
                      <Ionicons name="ellipsis-vertical" size={18} color={COLORS.textSecondary} />
                    </Pressable>
                  </View>

                  {memo ? (
                    <Pressable
                      onPress={() => openMemoEditor(stop)}
                      style={({ pressed }) => [styles.planStopMemoBox, pressed && styles.cardPressed]}
                    >
                      <Text numberOfLines={3} allowFontScaling={false} style={styles.planStopMemoText}>
                        {memo}
                      </Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={() => openMemoEditor(stop)}
                      style={({ pressed }) => [
                        styles.planStopMemoEmpty,
                        pressed && styles.cardPressed,
                      ]}
                    >
                      <Ionicons name="add" size={13} color={COLORS.textTertiary} />

                      <Text allowFontScaling={false} style={styles.planStopMemoEmptyText}>
                        메모 남기기
                      </Text>
                    </Pressable>
                  )}
                </Pressable>
              </View>
            );
          })}

          <View style={styles.planAddRow}>
            <Pressable
              onPress={() => {
                if (!tripId) return;
                router.push({
                  pathname: '/add-place',
                  params: { tripId, day: String(selectedDay) },
                });
              }}
              style={({ pressed }) => [styles.planAddButton, pressed && styles.cardPressed]}
            >
              <Ionicons name="add" size={16} color={COLORS.textSecondary} />

              <Text allowFontScaling={false} style={styles.planAddButtonText}>
                장소 추가
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <MemoEditorModal
        visible={memoModalVisible}
        stopName={activeStop?.name ?? null}
        draft={memoDraft}
        onChangeDraft={setMemoDraft}
        onSave={saveMemo}
        onClose={closeMemoEditor}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  cardPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.99 }],
  },

  alternativeView: {
    flex: 1,
  },

  planScreen: {
    flex: 1,
  },

  planEmptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingBottom: 120,
    gap: SPACING.sm,
  },

  planEmptyTitle: {
    marginTop: SPACING.xs,
    color: COLORS.textPrimary,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
  },

  planEmptyDescription: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
    textAlign: 'center',
  },

  planContent: {
    paddingHorizontal: SPACING.screenH,
    paddingTop: SPACING.md,
    paddingBottom: 190,
  },

  dayChipRow: {
    flexDirection: 'row',
    gap: SPACING.sm,

    paddingBottom: SPACING.xs,
  },

  dayChip: {
    flexDirection: 'row',
    alignItems: 'center',

    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,

    borderRadius: RADIUS.banner,

    backgroundColor: SHARED_COLORS.surface,
  },

  dayChipSelected: {
    backgroundColor: COLORS.primary,
  },

  dayChipText: {
    color: COLORS.textPrimary,

    fontSize: 13,
    fontWeight: '400',
  },

  dayChipTextSelected: {
    color: '#FFFFFF',
  },

  planTimeline: {
    marginTop: 32,
  },

  planTimelineRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },

  planTimelineIndicator: {
    width: 40,

    alignItems: 'center',
  },

  planTimelineDot: {
    width: 22,
    height: 22,

    borderRadius: 11,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: COLORS.primary,
  },

  planTimelineDotText: {
    color: '#FFFFFF',

    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
  },

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

    backgroundColor: COLORS.routeSoft,
  },

  planStopStickerCircle: {
    width: 44,
    height: 44,

    marginRight: SPACING.sm,

    borderRadius: RADIUS.sheet,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: COLORS.primarySoft,
  },

  planStopCard: {
    flex: 1,
    marginBottom: SPACING.sm,

    paddingHorizontal: 13,
    paddingVertical: SPACING.sm,

    borderRadius: RADIUS.banner,

    backgroundColor: '#FBFBFA',
  },

  planStopCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  planStopTextArea: {
    flex: 1,
  },

  planStopName: {
    color: COLORS.textPrimary,

    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
  },

  planStopMeta: {
    marginTop: SPACING.xs,

    color: COLORS.textSecondary,

    fontSize: 11,
    lineHeight: 16,
    fontWeight: '500',
  },

  planStopIconButton: {
    width: 30,
    height: 30,

    alignItems: 'center',
    justifyContent: 'center',
  },

  planStopMemoBox: {
    marginTop: SPACING.sm,

    paddingHorizontal: 11,
    paddingVertical: SPACING.sm,

    borderRadius: RADIUS.card,

    backgroundColor: COLORS.primarySoft,
  },

  planStopMemoText: {
    color: COLORS.textPrimary,

    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },

  planStopMemoEmpty: {
    marginTop: SPACING.sm,

    paddingVertical: SPACING.sm,

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,

    borderRadius: RADIUS.card,

    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },

  planStopMemoEmptyText: {
    color: COLORS.textTertiary,

    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },

  planAddRow: {
    flexDirection: 'row',
    gap: SPACING.sm,

    marginTop: SPACING.xs,
  },

  planAddButton: {
    flex: 1,

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,

    paddingVertical: 11,

    borderRadius: RADIUS.card,

    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },

  planAddButtonText: {
    color: COLORS.textSecondary,

    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },

  memoModalBackdrop: {
    flex: 1,

    alignItems: 'center',
    justifyContent: 'center',

    paddingHorizontal: 28,

    backgroundColor: 'rgba(20,20,18,0.45)',
  },

  memoModalCard: {
    width: '100%',

    paddingHorizontal: SPACING.screenH,
    paddingTop: SPACING.screenH,
    paddingBottom: SPACING.md,

    borderRadius: RADIUS.sheet,

    backgroundColor: COLORS.card,
  },

  memoModalTitle: {
    color: COLORS.textPrimary,

    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
  },

  memoModalHint: {
    marginTop: SPACING.xs,

    color: COLORS.textSecondary,

    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },

  memoInput: {
    marginTop: SPACING.md,

    minHeight: 96,

    paddingHorizontal: 13,
    paddingVertical: 11,

    borderRadius: RADIUS.card,

    color: COLORS.textPrimary,

    fontSize: 14,
    lineHeight: 19,
    fontFamily: 'Pretendard-Medium',

    textAlignVertical: 'top',

    backgroundColor: COLORS.primarySoft,
  },

  memoModalButtonRow: {
    flexDirection: 'row',
    gap: SPACING.sm,

    marginTop: SPACING.md,
  },

  memoModalButton: {
    flex: 1,

    alignItems: 'center',
    justifyContent: 'center',

    paddingVertical: SPACING.sm,

    borderRadius: RADIUS.card,
  },

  memoModalButtonGhost: {
    backgroundColor: COLORS.background,

    borderWidth: 1,
    borderColor: COLORS.border,
  },

  memoModalButtonGhostText: {
    color: COLORS.textSecondary,

    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
  },

  memoModalButtonPrimary: {
    backgroundColor: COLORS.primary,
  },

  memoModalButtonPrimaryText: {
    color: '#FFFFFF',

    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
  },
});
