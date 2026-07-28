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

  const horizontalPadding = ms(20);
  const contentWidth = width - horizontalPadding * 2;
  const clipWidth = Math.min(ms(132), contentWidth * 0.32);
  const placeWidth = Math.min(ms(300), contentWidth * 0.79);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{
        paddingTop: insets.top + ms(18),
        paddingBottom: insets.bottom + ms(110),
      }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ paddingHorizontal: horizontalPadding }}>
        <Text style={[styles.greeting, { fontSize: ms(22), lineHeight: ms(30) }]}>
          {userName} 님, 오늘도 즐거운 여행!
        </Text>

        <View style={{ marginTop: ms(20) }}>
          <TripMapCard {...mockTripRoute} />
        </View>

        <Text style={[styles.sectionTitle, { fontSize: ms(18), marginTop: ms(30) }]}>최근 촬영한 클립</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingLeft: horizontalPadding, paddingRight: ms(8), paddingTop: ms(14) }}
      >
        {mockRecentClips.map((clip) => (
          <ClipThumbnail key={clip.id} item={clip} width={clipWidth} />
        ))}
      </ScrollView>

      <View style={{ paddingHorizontal: horizontalPadding }}>
        <Text style={[styles.sectionTitle, { fontSize: ms(18), marginTop: ms(30) }]}>추천 장소</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={placeWidth + ms(14)}
        decelerationRate="fast"
        contentContainerStyle={{ paddingLeft: horizontalPadding, paddingRight: ms(8), paddingTop: ms(14) }}
      >
        {mockRecommendedPlaces.map((place) => (
          <PlaceCard key={place.id} item={place} width={placeWidth} />
        ))}
      </ScrollView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: homeColors.background },
  greeting: { fontWeight: '800', color: homeColors.textPrimary, letterSpacing: -0.5 },
  sectionTitle: { fontWeight: '800', color: homeColors.textPrimary, letterSpacing: -0.3 },
});
