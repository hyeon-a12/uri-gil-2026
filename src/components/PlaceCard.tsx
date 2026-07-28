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
    <TouchableOpacity
      style={[styles.card, { width, marginRight: ms(14), borderRadius: ms(20) }]}
      activeOpacity={0.88}
    >
      <View>
        <Image
          source={{ uri: item.image }}
          style={{ width: '100%', height: width * 0.62, borderTopLeftRadius: ms(20), borderTopRightRadius: ms(20) }}
          resizeMode="cover"
        />
        <View style={[styles.badge, { paddingHorizontal: ms(10), paddingVertical: ms(5), borderRadius: ms(14) }]}>
          <Text style={[styles.badgeText, { fontSize: ms(11) }]}>{item.duration}</Text>
        </View>
      </View>

      <View style={{ paddingHorizontal: ms(14), paddingTop: ms(12), paddingBottom: ms(15) }}>
        <Text style={[styles.title, { fontSize: ms(16), lineHeight: ms(21) }]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={[styles.subtitle, { fontSize: ms(12), lineHeight: ms(17) }]} numberOfLines={1}>
          {item.subtitle}
        </Text>

        <View style={[styles.metaRow, { marginTop: ms(8) }]}>
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={ms(14)} color={homeColors.star} />
            <Text style={[styles.rating, { fontSize: ms(12) }]}>{item.rating}</Text>
          </View>
          <Text style={[styles.price, { fontSize: ms(13) }]}>$ {item.price}/pax</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    backgroundColor: homeColors.card,
    borderWidth: 1,
    borderColor: homeColors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  badge: { position: 'absolute', right: 10, top: 10, backgroundColor: homeColors.badgeGreen },
  badgeText: { color: '#fff', fontWeight: '800' },
  title: { fontWeight: '800', color: homeColors.textPrimary },
  subtitle: { color: homeColors.textSecondary, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rating: { color: homeColors.textSecondary, fontWeight: '600' },
  price: { fontWeight: '800', color: homeColors.accent },
});
