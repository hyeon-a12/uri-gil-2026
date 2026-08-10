import React, { useCallback, useState } from 'react';
import { StyleSheet, View, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { AppText as Text } from '@/components/AppText';
import { getAllFolders, getFolderStatus } from '@/services/folderService';
import { getAllRecordings } from '@/services/recordingService';
const COLORS = {
  background: '#FFFFFF',
  card: '#FFFFFF',

  primary: '#FF7F5C',
  primaryDark: '#E97B1F',// 눌렸을 때나 강조할 때 쓸 어두운 오렌지
  primarySoft: '#FFF3DF',// 아주 연한 오렌지 배경

  textPrimary: '#222222',
  textSecondary: '#8A8A8A',// 중간 중요도의 텍스트 (본문 등)
  textTertiary: '#8A8A8A',

  border: '#DDDDDD',

  shadow: '#443A31',
};
const MenuItem = ({
  title,
  rightText = '',
  onPress,
}: {
  title: string;
  rightText?: string;
  onPress?: () => void;
}) => (
  <Pressable style={styles.menuItem} onPress={onPress}>
    <Text style={styles.menuItemText}>{title}</Text>
    <View style={styles.menuItemRight}>

      {rightText ? <Text style={styles.menuItemRightText}>{rightText}</Text> : null}
      <Feather name="chevron-right" size={20} color={COLORS.textTertiary} />
    </View>
  </Pressable>
);

export default function MyPageScreen() {
  const router = useRouter();
  const [stats, setStats] = useState({
    completedRoutes: 0,
    recordedClips: 0,
    visitedPlaces: 0,
  });

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const [folders, recordings] = await Promise.all([
          getAllFolders(),
          getAllRecordings(),
        ]);

        const completedRoutes = folders.filter(
          (folder) => getFolderStatus(folder) === 'done',
        ).length;

        const visitedPlaces = new Set(
          recordings
            .map((r) => r.location.placeName)
            .filter((name): name is string => !!name),
        ).size;

        setStats({
          completedRoutes,
          recordedClips: recordings.length,
          visitedPlaces,
        });
      })();
    }, []),
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
      >

        
        <View style={styles.headerToolbar}>
          <Feather name="bell" size={24} color={COLORS.textPrimary} style={styles.icon} />
        </View>

        <View style={styles.greetingSection}>
          <View style={styles.profileCircle}>
            <Feather name="user" size={24} color={COLORS.textTertiary} />
          </View>
          <Text style={styles.greetingText}>
            안녕하세요{'\n'}텅굴이님
          </Text>
        </View>

        <View style={styles.section}>

          <View style={styles.orderCard}>
            <View style={styles.orderCardHeader}>
              <Text style={styles.orderCardTitle}>
                텅굴이님이 기록한 여행이에요
              </Text>
              <Feather name="chevron-right" size={18} color={COLORS.textSecondary} />
            </View>
            <Text style={styles.orderCardDesc}>날짜 ?</Text>

            
            <View style={styles.orderStatusContainer}>
              {[
                { label: '완료한 루트', value: stats.completedRoutes },
                { label: '촬영한 클립', value: stats.recordedClips },
                { label: '방문한 장소', value: stats.visitedPlaces },
              ].map((status) => (
                <View key={status.label} style={styles.orderStatusItem}>
                  <Text style={styles.orderStatusNumber}>{status.value}</Text>
                  <Text style={styles.orderStatusLabel}>{status.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>나의 활동</Text>

          <View style={styles.activityCardList}>
            {[
              { title: '내 루트', icon: 'map' as const, route: '/my-routes' as const },
              { title: '촬영한 클립', icon: 'film' as const, route: '/my-clips' as const },
              { title: '방문한 장소', icon: 'map-pin' as const, route: '/visited-places' as const },
            ].map((item) => (
              <Pressable
                key={item.title}
                style={styles.activityCard}
                onPress={item.route ? () => router.push(item.route) : undefined}
              >
                <Feather name={item.icon} size={22} color={COLORS.primary} />
                <Text style={styles.activityCardTitle}>{item.title}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.menuCard}>
            <Text style={styles.sectionTitle}>나의 정보</Text>
            <MenuItem title="나의 정보 관리" onPress={() => router.push('/profile-edit')} />
            <MenuItem title="알림 설정" onPress={() => router.push('/notification-settings')} />
            <MenuItem title="위치 정보 및 개인정보 처리방침" onPress={() => router.push('/privacy-policy')} />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.menuCard}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>고객센터</Text>
            </View>
            <MenuItem title=" Q&A 리스트" onPress={() => router.push('/faq')} />
            <MenuItem title="1:1 문의하기" onPress={() => router.push('/inquiry')} />
            <MenuItem title="공지사항" onPress={() => router.push('/notice')} />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.menuCard}>
            <Text style={styles.sectionTitle}>프로그램 정보</Text>

            <View style={[styles.menuItem, { borderBottomWidth: 0 }]}>
              <Text style={styles.menuItemText}>현재 버전</Text>
              <Text style={styles.versionText}>Version 3.5.1</Text>
            </View>
          </View>
        </View>

        <View style={styles.footer}>

          <View style={styles.footerCsBox}>
            <Text style={styles.footerCsTitle}>고객센터 <Text style={styles.footerCsNumber}>1588-7667</Text> (유료)</Text>
            <Text style={styles.footerCsTime}>평일 9:30~18:00</Text>
          </View>

          
          <View style={styles.footerLinks}>
            {['로그아웃', '고객센터', '이용약관'].map((link, idx) => (
              <Text key={idx} style={styles.footerLinkText}>{link}</Text>
            ))}

            <Text style={[styles.footerLinkText, { fontWeight: 'bold', color: COLORS.textPrimary }]}>개인정보처리방침</Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 60,
  },
  headerToolbar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 16,
  },
  icon: {
    marginLeft: 8,
  },
  greetingSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
  },
  profileCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greetingText: {
    fontSize: 26,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    lineHeight: 32,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 7,
  },
  sectionTitle: {
    fontSize: 19,
    color: COLORS.textPrimary,
    marginBottom: 16,
    fontWeight: 'bold',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 17,
  },
  shortcutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shortcutText: {
    fontSize: 12,
    color: COLORS.textTertiary,
    marginRight: 2,
  },
  orderCard: {
    backgroundColor: COLORS.card,
    borderRadius: 23,
    padding: 20,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  orderCardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  orderCardDesc: {
    fontSize: 12,
    color: COLORS.textTertiary,
    marginBottom: 24,
  },
  orderStatusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderStatusItem: {
    alignItems: 'center',
    flex: 1,
  },
  orderStatusNumber: {
    fontSize: 22,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  orderStatusLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  activityCardList: {
    flexDirection: 'row',
    gap: 8,
  },
  activityCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 23,
    paddingVertical: 20,
    paddingHorizontal: 8,
    gap: 10,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  activityCardTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  menuCard: {
    backgroundColor: COLORS.card,
    borderRadius: 23,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 4,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 18,
  },
  menuItemText: {
    fontSize: 16,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  menuItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuItemRightText: {
    fontSize: 14,
    color: COLORS.textTertiary,
    marginRight: 8,
  },
  versionText: {
    fontSize: 14,
    color: COLORS.textTertiary,
  },
  footer: {
    backgroundColor: COLORS.background,
    padding: 20,
    paddingBottom: 40,
  },
  footerCsBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  footerCsTitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  footerCsNumber: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  footerCsTime: {
    fontSize: 12,
    color: COLORS.textTertiary,
  },
  footerLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  footerLinkText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
});