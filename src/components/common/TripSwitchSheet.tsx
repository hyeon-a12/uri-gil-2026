import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText as Text } from '@/components/AppText';
import { Image } from 'expo-image';

import { getAllFolders, saveFolder, updateFolder, type FolderItem } from '@/services/folderService';
import { selectCurrentTrip, useTripStore } from '@/store/useTripStore';
import NewTripModal from '@/components/NewTripModal';
import { apiFetch } from '@/services/api';
import { COLORS as SHARED_COLORS } from '@/constants/color';

const COLORS = {
  background: SHARED_COLORS.background,
  card: SHARED_COLORS.background,
  primary: SHARED_COLORS.accent,
  primaryDark: SHARED_COLORS.accentPressed,
  primarySoft: SHARED_COLORS.main,
  textPrimary: SHARED_COLORS.textPrimary,
  textSecondary: SHARED_COLORS.textSecondary,
  textTertiary: SHARED_COLORS.textSecondary,
  border: SHARED_COLORS.border, // 기존 #EEEEEE 폐기 → 공용 border(#DDDDDD)로 통일
  overlay: 'rgba(20,20,18,0.35)',
};

type Props = {
  visible: boolean;
  onClose: () => void;
};

/**
 * 홈 화면에서만 뜨는 여행 전환 바텀시트.
 *
 * 내 루트/클립 목록 화면엔 이 시트를 여는 트리거가 없습니다 — 그 화면들은
 * useTripStore의 currentTrip을 구독만 하고, 실제 전환은 여기서만 일어납니다.
 */
export function TripSwitchSheet({ visible, onClose }: Props) {
  const currentTrip = useTripStore((state) => state.currentTrip);

  const [trips, setTrips] = useState<FolderItem[]>([]);
  const [newTripModalVisible, setNewTripModalVisible] = useState(false);

  const loadTrips = async () => {
    try {
      const folders = await getAllFolders();
      setTrips(folders);
    } catch (error) {
      console.error('[TripSwitchSheet] 여행 목록을 불러오지 못했습니다.', error);
    }
  };

  useEffect(() => {
    if (visible) {
      void loadTrips();
    }
  }, [visible]);

  const handleSelect = async (trip: FolderItem) => {
    try {
      // AsyncStorage(activeFolderService)와 useTripStore 메모리 캐시를 한 번에
      // 갱신합니다 — 하나만 갱신하면 앱을 재시작했을 때 이 시트의 하이라이트와
      // 실제 활성 폴더가 어긋나게 됩니다.
      await selectCurrentTrip(trip);
      onClose();
    } catch (error) {
      console.error('[TripSwitchSheet] 여행 변경에 실패했습니다.', error);
      Alert.alert('여행 변경 실패', '여행을 변경하지 못했습니다.');
    }
  };

  const handleOpenNewTripModal = () => {
    // 시트를 먼저 닫고 나서 모달을 띄웁니다 — 두 Modal이 동시에 겹쳐 뜨면
    // 전환 애니메이션이 어색해서, NewTripModal의 slide-up 애니메이션이
    // 자연스럽게 보이도록 살짝 텀을 둡니다.
    onClose();
    setTimeout(() => {
      setNewTripModalVisible(true);
    }, 300);
  };

const handleCreatedTrip: React.ComponentProps<typeof NewTripModal>['onCreated'] = async (
    trip,
  ) => {
    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}.${month}.${day}.`;
    };

    // 서버(Pydantic date 타입)로 보낼 땐 YYYY-MM-DD 형식이 필요함
    const toIsoDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const folder: FolderItem = {
      id: `folder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: trip.name.trim(),
      dateRange: `${formatDate(trip.startDate)} ~ ${formatDate(trip.endDate)}`,
      thumbnail: '',
      region: trip.region,
      memo: trip.memo,
      partySize: trip.partySize,
      themes: trip.themes,
      clipLengthSeconds: trip.clipLengthSeconds,
      shootingStyle: trip.shootingStyle,
      gridTemplateId: trip.gridTemplateId,
    };

    try {
      // 1. 로컬 저장 먼저 (오프라인이어도 여행 생성 자체는 항상 성공하도록)
      await saveFolder(folder);
      await selectCurrentTrip(folder);
      await loadTrips();

      // 2. 서버에도 저장 시도 (실패해도 로컬 흐름은 막지 않음)
      try {
        const serverRoute = await apiFetch('/routes/', {
          method: 'POST',
          body: JSON.stringify({
            title: trip.name.trim(),
            region: trip.region,
            theme: trip.themes.join(','),
            description: trip.memo || null,
            start_date: toIsoDate(trip.startDate),
            end_date: toIsoDate(trip.endDate),
            member_count: trip.partySize,
          }),
        });

        // 서버가 발급한 route_id를 로컬 데이터에도 연결해둠
        await updateFolder(folder.id, { routeId: serverRoute.id });
      } catch (serverError) {
        console.error('[TripSwitchSheet] 서버 저장 실패 (로컬은 저장됨):', serverError);
      }
    } catch (error) {
      console.error('[TripSwitchSheet] 새 여행 저장에 실패했습니다.', error);
      Alert.alert('여행 생성 실패', '새 여행을 저장하지 못했습니다.');
    }
  };

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.grabber} />

            <Text style={styles.title}>여행 선택</Text>
            <Text style={styles.subtitle}>확인하거나 기록할 여행을 선택해주세요.</Text>

            <ScrollView
              showsVerticalScrollIndicator={false}
              style={styles.list}
              contentContainerStyle={styles.listContent}
            >
              {trips.map((trip) => {
                const selected = currentTrip?.id === trip.id;
                return (
                  <Pressable
                    key={trip.id}
                    onPress={() => handleSelect(trip)}
                    style={({ pressed }) => [
                      styles.row,
                      pressed && styles.rowPressed,
                    ]}
                  >
                    <TripThumb trip={trip} selected={selected} />

                    <View style={styles.rowTextArea}>
                      <Text numberOfLines={1} style={styles.rowTitle}>
                        {trip.title}
                      </Text>
                      <Text numberOfLines={1} style={styles.rowSubtitle}>
                        {trip.dateRange}
                      </Text>
                    </View>

                    {selected ? (
                      <Ionicons name="checkmark-circle" size={22} color={COLORS.primary} />
                    ) : (
                      <Ionicons name="chevron-forward" size={18} color={COLORS.textTertiary} />
                    )}
                  </Pressable>
                );
              })}

              <Pressable
                onPress={handleOpenNewTripModal}
                style={({ pressed }) => [
                  styles.row,
                  styles.addRow,
                  pressed && styles.rowPressed,
                ]}
              >
                <View style={styles.addThumb}>
                  <Ionicons name="add" size={22} color={COLORS.textSecondary} />
                </View>
                <Text style={styles.addLabel}>새 여행</Text>
              </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <NewTripModal
        visible={newTripModalVisible}
        onClose={() => setNewTripModalVisible(false)}
        onCreated={handleCreatedTrip}
      />
    </>
  );
}

function TripThumb({ trip, selected }: { trip: FolderItem; selected: boolean }) {
  return (
    <View style={[styles.thumb, selected && styles.thumbSelected]}>
      {trip.thumbnail ? (
        <Image source={{ uri: trip.thumbnail }} style={styles.thumbImage} contentFit="cover" />
      ) : (
        <Ionicons name="airplane" size={22} color={selected ? COLORS.primary : COLORS.textSecondary} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: COLORS.overlay,
  },
  sheet: {
    maxHeight: '75%',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: COLORS.background,
  },
  grabber: {
    alignSelf: 'center',
    width: 42,
    height: 5,
    marginBottom: 18,
    borderRadius: 3,
    backgroundColor: '#D7D7D7',
    overflow: 'hidden',
  },
  title: {
    fontSize: 20,
    lineHeight: 27,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  subtitle: {
    marginTop: 4,
    marginBottom: 16,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  list: {
    maxHeight: 420,
  },
  listContent: {
    paddingBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 72,
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 12,
  },
  rowPressed: {
    opacity: 0.7,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  thumbSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primarySoft,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  rowTextArea: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  rowSubtitle: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  addRow: {
    marginTop: 4,
  },
  addThumb: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  addLabel: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
});
