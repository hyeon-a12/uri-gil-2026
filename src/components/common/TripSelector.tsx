import React, { useState } from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppText as Text } from '@/components/AppText';

import { useTripStore } from '@/store/useTripStore';
import { TripSwitchSheet } from './TripSwitchSheet';

const COLORS = {
  textPrimary: '#222222',
  textSecondary: '#8A8A8A',
  white: '#FFFFFF',
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

  return (
    <>
      <View style={[styles.wrapper, { top: insets.top + 12 }]}>
        <TouchableOpacity
          style={styles.bar}
          activeOpacity={0.85}
          onPress={() => setSheetVisible(true)}
        >
          <Ionicons name="airplane-outline" size={18} color={COLORS.textSecondary} />
          <Text numberOfLines={1} style={styles.tripName}>
            {currentTrip ? currentTrip.title : '여행을 선택해주세요'}
          </Text>
          <Ionicons name="chevron-down" size={18} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>

      <TripSwitchSheet visible={sheetVisible} onClose={() => setSheetVisible(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 10,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.white,
    borderRadius: 24,
    paddingHorizontal: 16,
    height: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  tripName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
});
