import { ScrollView, StyleSheet, View } from 'react-native';
import { AppText as Text } from '@/components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS } from '@/constants/color';
import { BottomTabInset, Spacing } from '@/constants/theme';

const MOCK_CLIPS = [
  { id: '1', duration: '00:08' },
  { id: '2', duration: '00:12' },
  { id: '3', duration: '00:06' },
];

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.greeting}>안녕하세요 여행자님</Text>
          <Text style={styles.notificationIcon}>N</Text>
        </View>

        <View style={styles.mapContainer}>
          <Text style={styles.mapTitle}>전주 루트</Text>
          <View style={styles.mapPlaceholder} />
          <Text style={styles.mapInfo}>2박 3일 - 영상 6개</Text>
        </View>

        <View style={styles.clipsSection}>
          <Text style={styles.clipsTitle}>최근 촬영한 클립들</Text>
          <View style={styles.clipRow}>
            {MOCK_CLIPS.map((item) => (
              <View key={item.id} style={styles.clipCard}>
                <View style={styles.clipThumbnail} />
                <Text style={styles.clipDuration}>{item.duration}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.three,
    marginBottom: Spacing.five,
  },
  greeting: {
    fontSize: 25,
    fontWeight: '600',
    color: COLORS.text,
  },
  notificationIcon: {
    fontSize: 24,
    color: COLORS.textSecondary,
  },
  mapContainer: {
    marginBottom: Spacing.five,
  },
  mapTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  mapPlaceholder: {
    width: '100%',
    height: 200,
    marginVertical: Spacing.two,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  mapInfo: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  clipsSection: {
    gap: Spacing.two,
  },
  clipsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  clipRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  clipCard: {
    width: 100,
  },
  clipThumbnail: {
    height: 100,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
  },
  clipDuration: {
    marginTop: Spacing.one,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
});
