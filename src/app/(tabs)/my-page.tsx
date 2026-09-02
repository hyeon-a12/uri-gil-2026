import React, { useCallback, useState } from 'react';
import { StyleSheet, View, ScrollView, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { AppText as Text } from '@/components/AppText';
import { Card, ListRow } from '@/components/common';
import { colors } from '@/constants/menu-theme';
import { getAllFolders, getFolderStatus } from '@/services/folderService';
import { getAllRecordings } from '@/services/recordingService';
import { useProfileStore } from '@/store/useProfileStore';

export default function MyPageScreen() {
  const router = useRouter();
  const profile = useProfileStore((state) => state.profile);
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
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.greetingSection}>
          <View style={styles.profileCircle}>
            {profile.avatarUri ? (
              <Image source={{ uri: profile.avatarUri }} style={styles.profileCircleImage} />
            ) : (
              <Feather name="user" size={24} color={colors.textTertiary} />
            )}
          </View>
          <Text style={styles.greetingText}>안녕하세요 {profile.nickname}님</Text>
        </View>

        <View style={styles.section}>
          <Card style={styles.orderCard}>
            <View style={styles.orderCardHeader}>
              <Text style={styles.orderCardTitle}>
                {profile.nickname}님이 기록한 여행이에요
              </Text>
            </View>

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
          </Card>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>나의 활동</Text>

          <Pressable
            style={({ pressed }) => [
              styles.activityCard,
              pressed && styles.activityCardPressed,
            ]}
            onPress={() => router.push('/my-routes')}
          >
            <View style={styles.activityIconCircle}>
              <Feather name="map" size={20} color={colors.accent} />
            </View>
            <Text style={styles.activityCardTitle}>내 여행</Text>
            <Feather name="chevron-right" size={20} color={colors.textTertiary} />
          </Pressable>
        </View>

        <View style={styles.section}>
          <Card style={styles.menuCard}>
            <ListRow
              title="나의 정보 관리"
              onPress={() => router.push('/profile-edit')}
              style={styles.menuRow}
            />
            <ListRow
              isLast
              title="위치 정보 및 개인정보 처리방침"
              onPress={() => router.push('/privacy-policy')}
              numberOfLines={1}
              style={styles.menuRow}
            />
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 60,
  },
  greetingSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  profileCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  profileCircleImage: {
    width: '100%',
    height: '100%',
  },
  greetingText: {
    fontSize: 19,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 28,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 7,
  },
  sectionTitle: {
    fontSize: 15,
    color: colors.text,
    marginBottom: 12,
    fontWeight: '700',
  },
  orderCard: {
    padding: 20,
    backgroundColor: '#FBFBFA',
    shadowOpacity: 0,
    elevation: 0,
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  orderCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
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
  // 이 화면에서 사용자가 제일 궁금해할 숫자라, sectionTitle(16)보다도 크고
  // accent 컬러로 확실히 튀게 강조합니다.
  orderStatusNumber: {
    fontSize: 19,
    fontWeight: '600',
    color: colors.accent,
    marginBottom: 9,
  },
  orderStatusLabel: {
    fontSize: 11,
    color: colors.textSub,
    fontWeight: '600',
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FBFBFA',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  activityCardPressed: {
    opacity: 0.85,
  },
  activityIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityCardTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
  },
  menuCard: {
    padding: 16,
    backgroundColor: '#FBFBFA',
    shadowOpacity: 0,
    elevation: 0,
  },
  menuRow: {
    paddingVertical: 20,
  },
});
