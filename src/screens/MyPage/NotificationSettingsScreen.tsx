import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { colors } from '@/constants/menu-theme';
import { Card, ListRow, SectionLabel, Toggle, ScreenHeader } from '@/components/common';

// 알림 종류마다 key를 정해두고 하나의 state 객체로 관리
type NotiKey = 'all' | 'tripStatus' | 'dispersalTip' | 'socialActivity' | 'marketing';

const initialState: Record<NotiKey, boolean> = {
  all: true,
  tripStatus: true,
  dispersalTip: true,
  socialActivity: false,
  marketing: false,
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
        {/* 1. 전체 알림 섹션 */}
        <View style={styles.sectionContainer}>
          <Card style={styles.card}>
            <View style={styles.rowWrapper}>
              <ListRow
                isLast
                title="전체 알림"
                subtitle="모든 알림을 한번에 켜고 끌 수 있어요"
                right={
                  <View style={styles.toggleContainer}>
                    <Toggle value={values.all} onValueChange={setKey('all')} />
                  </View>
                }
              />
            </View>
          </Card>
        </View>

        {/* 2. 여행 섹션 */}
        <View style={styles.sectionContainer}>
          <View style={styles.labelWrapper}>
            <SectionLabel text="여행" />
          </View>
          <Card style={styles.card}>
            <View style={styles.rowWrapper}>
              <ListRow
                title="여행 시작/종료 알림"
                subtitle="루트 상태가 바뀌면 알려드려요"
                right={
                  <View style={styles.toggleContainer}>
                    <Toggle value={values.tripStatus} onValueChange={setKey('tripStatus')} />
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

        {/* 3. 기타 섹션 */}
        <View style={styles.sectionContainer}>
          <View style={styles.labelWrapper}>
            <SectionLabel text="기타" />
          </View>
          <Card style={styles.card}>
            <View style={styles.rowWrapper}>
              <ListRow
                title="공유 활동 알림"
                subtitle="내 루트에 댓글·공감이 달리면 알려드려요"
                right={
                  <View style={styles.toggleContainer}>
                    <Toggle value={values.socialActivity} onValueChange={setKey('socialActivity')} />
                  </View>
                }
              />
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.rowWrapper}>
              <ListRow
                isLast
                title="마케팅 정보 수신"
                subtitle="이벤트 및 혜택 소식을 보내드려요"
                right={
                  <View style={styles.toggleContainer}>
                    <Toggle value={values.marketing} onValueChange={setKey('marketing')} />
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
  labelWrapper: {
    marginBottom: 8,
    marginLeft: 4,
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
