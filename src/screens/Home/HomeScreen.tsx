import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsive } from '../../hooks/use-responsive';
import { homeColors } from '../../constants/home-theme';
import TripMapCard from '../../components/TripMapCard';
import ClipThumbnail from '../../components/ClipThumbnail';
import PlaceCard from '../../components/PlaceCard';
import { mockRecentClips, mockRecommendedPlaces, mockTripRoute } from '../../constants/mockHomeData';

interface Props {
  userName?: string;
}

export default function HomeScreen({ userName = '뿅뿅이' }: Props) {
  const insets = useSafeAreaInsets();
  const { width, moderateScale: ms } = useResponsive();

  // 화면 너비 비율로 카드 크기를 정하면 화면이 커져도 레이아웃 비율이 그대로 유지된다.
  const clipWidth = width * 0.24;
  const placeWidth = width * 0.62;

  return (
    <ScrollView
      style={{ backgroundColor: homeColors.background }}
      contentContainerStyle={{
        paddingTop: insets.top + ms(12),
        paddingHorizontal: ms(16),
        paddingBottom: ms(24),
      }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.greeting, { fontSize: ms(19) }]}>{userName} 님, 오늘도 즐거운 여행!</Text>

      <View style={{ marginTop: ms(16) }}>
        <TripMapCard {...mockTripRoute} />
      </View>

      <Text style={[styles.sectionTitle, { fontSize: ms(15), marginTop: ms(22) }]}>최근 촬영한 클립</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: ms(10) }}>
        {mockRecentClips.map((c) => (
          <ClipThumbnail key={c.id} item={c} width={clipWidth} />
        ))}
      </ScrollView>

      <Text style={[styles.sectionTitle, { fontSize: ms(15), marginTop: ms(22) }]}>추천 장소</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: ms(10) }}>
        {mockRecommendedPlaces.map((p) => (
          <PlaceCard key={p.id} item={p} width={placeWidth} />
        ))}
      </ScrollView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  greeting: { fontWeight: '700', color: homeColors.textPrimary },
  sectionTitle: { fontWeight: '600', color: homeColors.textPrimary },
});
