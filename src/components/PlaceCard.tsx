import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useResponsive } from '../hooks/use-responsive';
import { homeColors } from '../constants/home-theme';
import { RecommendedPlace } from '../types/home';

interface Props {
  item: RecommendedPlace;
  width: number;
}

export default function PlaceCard({ item, width }: Props) {
  const { moderateScale: ms } = useResponsive();

  return (
    <TouchableOpacity style={{ width, marginRight: ms(12) }} activeOpacity={0.85}>
      <View>
        <Image
          source={{ uri: item.image }}
          style={{ width: '100%', height: width * 0.75, borderRadius: ms(14) }}
          resizeMode="cover"
        />
        <View style={[styles.badge, { paddingHorizontal: ms(8), paddingVertical: ms(3), borderRadius: ms(10) }]}>
          <Text style={[styles.badgeText, { fontSize: ms(10) }]}>{item.duration}</Text>
        </View>
      </View>
      <Text style={[styles.title, { fontSize: ms(13), marginTop: ms(6) }]} numberOfLines={1}>
        {item.title}
      </Text>
      <Text style={[styles.subtitle, { fontSize: ms(11) }]} numberOfLines={1}>
        {item.subtitle}
      </Text>
      <View style={styles.row}>
        <Ionicons name="star" size={ms(12)} color={homeColors.star} />
        <Text style={[styles.rating, { fontSize: ms(11) }]}>{item.rating}</Text>
      </View>
      <Text style={[styles.price, { fontSize: ms(12) }]}>Start from  $ {item.price}/pax</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  badge: { position: 'absolute', right: 8, top: 8, backgroundColor: homeColors.badgeGreen },
  badgeText: { color: '#fff', fontWeight: '600' },
  title: { fontWeight: '600', color: homeColors.textPrimary },
  subtitle: { color: homeColors.textSecondary, marginTop: 1 },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 3 },
  rating: { color: homeColors.textSecondary },
  price: { marginTop: 2, fontWeight: '600', color: homeColors.textPrimary },
});
