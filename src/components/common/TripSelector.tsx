import React, { useState } from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppText as Text } from '@/components/AppText';

import { useTripStore } from '@/store/useTripStore';
import { TripSwitchSheet } from './TripSwitchSheet';
import NewTripModal from '@/components/NewTripModal';
import { useCreateTripModal } from '@/hooks/useCreateTripModal';
import { COLORS as SHARED_COLORS } from '@/constants/color';

const COLORS = {
  textPrimary: SHARED_COLORS.textPrimary,
  textSecondary: SHARED_COLORS.textSecondary,
  white: SHARED_COLORS.background,
  accent: SHARED_COLORS.accent,
  surface: SHARED_COLORS.surface,
};

/**
 * 홈 화면 상단 검색창 자리에 떠 있는 "현재 활성 여행" 표시 + 전환 트리거입니다.
 *
 * 앱 전역에서 여행을 전환할 수 있는 곳은 이 컴포넌트(홈 화면)뿐입니다 — 내 루트,
 * 클립 목록 화면은 useTripStore의 currentTrip을 구독만 하고 전환 UI를 두지 않습니다.
 */
export function TripSelector() {
  const insets = useSafeAreaInsets();
  const currentTrip = useTripStore((state) => state.currentTrip);
  const [sheetVisible, setSheetVisible] = useState(false);

  const { visible: createModalVisible, openCreateModal, closeCreateModal, handleCreatedTrip } =
    useCreateTripModal();

  return (
    <>
      <View style={[styles.wrapper, { top: insets.top + 12 }]}>
        <TouchableOpacity
          style={styles.bar}
          activeOpacity={0.85}
          onPress={() => setSheetVisible(true)}
        >
          <View style={styles.brand}>
            <View style={styles.logoMark} />
          </View>

          <View style={styles.tripInfo}>
            <Text numberOfLines={1} style={styles.tripLabel}>
              현재 여행
            </Text>
            <Text numberOfLines={1} style={styles.tripName}>
              {currentTrip ? currentTrip.title : '여행을 선택해주세요'}
            </Text>
          </View>

          <View style={styles.chevronButton}>
            <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.addButton}
          activeOpacity={0.85}
          onPress={openCreateModal}
        >
          <Ionicons name="add" size={22} color={COLORS.accent} />
        </TouchableOpacity>
      </View>

      <TripSwitchSheet visible={sheetVisible} onClose={() => setSheetVisible(false)} />

      <NewTripModal
        visible={createModalVisible}
        onClose={closeCreateModal}
        onCreated={handleCreatedTrip}
      />
    </>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.white,
    borderRadius: 24,
    paddingHorizontal: 14,
    height: 60,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  addButton: {
    width: 60,
    height: 60,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logoMark: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: COLORS.accent,
  },
  tripInfo: {
    flex: 1,
    marginLeft: 10,
  },
  tripLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: COLORS.textSecondary,
  },
  tripName: {
    marginTop: 2,
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  chevronButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },
});
