import React from 'react';
import { View, FlatList, Pressable, StyleSheet, Alert } from 'react-native';
import { AppText as Text } from '@/components/AppText';
import { colors } from '@/constants/menu-theme';
import { Card, ScreenHeader } from '@/components/common';

interface Notice {
  id: string;
  title: string;
  date: string; // 'YYYY-MM-DD'
}

// TODO: 실제로는 API에서 받아옴
const NOTICES: Notice[] = [
  { id: '1', title: '전주 한옥마을 혼잡도 실시간 안내 업데이트', date: '2026-08-01' },
  { id: '2', title: '여행 종료 시 자동 여정 리포트 생성 기능 안내', date: '2026-07-29' },
  { id: '3', title: '서비스 점검 안내 (7/25 새벽 2시~4시)', date: '2026-07-24' },
  { id: '4', title: '개인정보 처리방침 개정 안내', date: '2026-07-10' },
  { id: '5', title: '우리길 출시를 축하합니다', date: '2026-06-20' },
];

const NEW_BADGE_DAYS = 7;

// "최근 N일 이내 게시물이면 NEW 표시" — 하드코딩된 boolean 대신 날짜로 계산해서
// 시간이 지나면 자동으로 NEW 뱃지가 사라지게 함
function isRecent(dateStr: string, now: Date = new Date()): boolean {
  const posted = new Date(dateStr);
  const diffDays = (now.getTime() - posted.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays <= NEW_BADGE_DAYS;
}

function formatDate(dateStr: string): string {
  return dateStr.replaceAll('-', '.');
}

export default function NoticeScreen() {
  // TODO: 공지 상세 화면이 생기면 router.push(`/notice/${notice.id}`)로 교체
  const handlePressNotice = (notice: Notice) => {
    Alert.alert(notice.title, formatDate(notice.date));
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="공지사항" />

      <View style={styles.body}>
        <Card>
          <FlatList
            data={NOTICES}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item, index }) => (
              <Pressable
                style={[styles.row, index === NOTICES.length - 1 && styles.rowLast]}
                onPress={() => handlePressNotice(item)}
              >
                <View style={styles.rowTop}>
                  {isRecent(item.date) && (
                    <View style={styles.newBadge}>
                      <Text style={styles.newBadgeText}>NEW</Text>
                    </View>
                  )}
                  <Text style={styles.title} numberOfLines={1}>
                    {item.title}
                  </Text>
                </View>
                <Text style={styles.date}>{formatDate(item.date)}</Text>
              </Pressable>
            )}
          />
        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1, padding: 16 },
  row: {
    gap: 6,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLast: { borderBottomWidth: 0 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  newBadge: { backgroundColor: colors.accent, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  newBadgeText: { fontSize: 9, fontWeight: '800', color: '#fff' },
  title: { fontSize: 13, fontWeight: '600', color: colors.text, flexShrink: 1 },
  date: { fontSize: 11, color: colors.textTertiary },
});
