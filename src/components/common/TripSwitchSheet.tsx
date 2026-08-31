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

import { getAllFolders, type FolderItem } from '@/services/folderService';
import { selectCurrentTrip, useTripStore } from '@/store/useTripStore';
import NewTripModal from '@/components/NewTripModal';
import { useCreateTripModal } from '@/hooks/useCreateTripModal';
import { COLORS as SHARED_COLORS, RADIUS, SPACING } from '@/constants/color';

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

  const { visible: newTripModalVisible, openCreateModal, closeCreateModal, handleCreatedTrip } =
    useCreateTripModal(loadTrips);

  const handleOpenNewTripModal = () => {
    // 시트를 먼저 닫고 나서 모달을 띄웁니다 — 두 Modal이 동시에 겹쳐 뜨면
    // 전환 애니메이션이 어색해서, NewTripModal의 slide-up 애니메이션이
    // 자연스럽게 보이도록 살짝 텀을 둡니다.
    onClose();
    setTimeout(() => {
      openCreateModal();
    }, 300);
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
        onClose={closeCreateModal}
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
        <Image
          source={require('@/assets/images/HanOk.png')}
          style={{ width: 22, height: 22 }}
          contentFit="contain"
        />
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
    minHeight: '55%',
    maxHeight: '85%',
    paddingHorizontal: SPACING.screenH,
    paddingTop: SPACING.sm,
    paddingBottom: 28,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: COLORS.background,
  },
  grabber: {
    alignSelf: 'center',
    width: 42,
    height: 5,
    marginBottom: SPACING.md,
    borderRadius: 3,
    backgroundColor: '#D7D7D7',
    overflow: 'hidden',
  },
  title: {
    fontSize: 18,
    lineHeight: 27,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  subtitle: {
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  list: {
    maxHeight: 520,
  },
  listContent: {
    paddingBottom: SPACING.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 72,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
    gap: SPACING.sm,
  },
  rowPressed: {
    opacity: 0.7,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.banner,
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
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  rowSubtitle: {
    marginTop: SPACING.xs,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    color: COLORS.textSecondary,
  },
  addRow: {
    marginTop: SPACING.xs,
  },
  addThumb: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.banner,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  addLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
});
