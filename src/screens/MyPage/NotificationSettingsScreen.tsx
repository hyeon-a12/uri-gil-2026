import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { colors } from '@/constants/menu-theme';
import { Card, ListRow, Toggle, ScreenHeader } from '@/components/common';

// 알림 종류마다 key를 정해두고 하나의 state 객체로 관리
type NotiKey = 'moveClipReminder' | 'dispersalTip';

const initialState: Record<NotiKey, boolean> = {
  moveClipReminder: true,
  dispersalTip: true,
};

export default function NotificationSettingsScreen() {
  const [values, setValues] = useState(initialState);

  const setKey = (key: NotiKey) => (next: boolean) => {
    setValues((prev) => ({ ...prev, [key]: next }));
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="알림 설정" />

      <ScrollView 
        style={styles.body} 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionContainer}>
          <Card style={styles.card}>
            <View style={styles.rowWrapper}>
              <ListRow
                title="장소 이동 시 촬영 알림"
                subtitle="새 장소로 이동하면 클립 촬영을 알려드려요"
                right={
                  <View style={styles.toggleContainer}>
                    <Toggle value={values.moveClipReminder} onValueChange={setKey('moveClipReminder')} />
                  </View>
                }
              />
            </View>
            
            {/* 항목 사이 구분선 추가 */}
            <View style={styles.divider} />
            
            <View style={styles.rowWrapper}>
              <ListRow
                isLast
                title="한산한 장소 추천"
                subtitle="근처 비혼잡 스팟을 추천해드려요"
                right={
                  <View style={styles.toggleContainer}>
                    <Toggle value={values.dispersalTip} onValueChange={setKey('dispersalTip')} />
                  </View>
                }
              />
            </View>
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { 
    flex: 1, 
    backgroundColor: colors.bg 
  },
  body: { 
    flex: 1, 
  },
  content: { 
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 60,
  },
  sectionContainer: {
    marginBottom: 24, // 섹션 간 간격 최적화
  },
  card: {
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    elevation: 2,
    overflow: 'hidden',
  },
  rowWrapper: {
    paddingVertical: 8, // 상하 간격을 적절히 줄임
  },
  toggleContainer: {
    marginTop: 8, 
    alignItems: 'flex-start',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F1F1', // 은은한 구분선 색상
    marginHorizontal: 16, // 카드 끝에 닿지 않도록 좌우 여백
  },
});
