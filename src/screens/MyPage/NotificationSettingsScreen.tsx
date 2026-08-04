import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { colors } from '@/constants/menu-theme';
import { Card, ListRow, SectionLabel, Toggle, ScreenHeader } from '@/components/common';

// 알림 종류마다 key를 정해두고 하나의 state 객체로 관리
// → 나중에 알림 종류가 늘어나도 useState를 추가로 안 만들어도 됨
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

      <ScrollView style={styles.body} contentContainerStyle={styles.content}>
        <Card style={styles.card}>
          <ListRow
            isLast
            title="전체 알림"
            subtitle="모든 알림을 한번에 켜고 끌 수 있어요"
            right={<Toggle value={values.all} onValueChange={setKey('all')} />}
          />
        </Card>

        <SectionLabel text="여행" />
        <Card style={styles.card}>
          <ListRow
            title="여행 시작/종료 알림"
            subtitle="루트 상태가 바뀌면 알려드려요"
            right={<Toggle value={values.tripStatus} onValueChange={setKey('tripStatus')} />}
          />
          <ListRow
            isLast
            title="한산한 장소 추천"
            subtitle="근처 비혼잡 스팟을 추천해드려요"
            right={<Toggle value={values.dispersalTip} onValueChange={setKey('dispersalTip')} />}
          />
        </Card>

        <SectionLabel text="기타" />
        <Card>
          <ListRow
            title="공유 활동 알림"
            subtitle="내 루트에 댓글·공감이 달리면 알려드려요"
            right={<Toggle value={values.socialActivity} onValueChange={setKey('socialActivity')} />}
          />
          <ListRow
            isLast
            title="마케팅 정보 수신"
            subtitle="이벤트 및 혜택 소식을 보내드려요"
            right={<Toggle value={values.marketing} onValueChange={setKey('marketing')} />}
          />
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1, paddingHorizontal: 16 },
  content: { paddingBottom: 40 },
  card: { marginBottom: 4 },
});
