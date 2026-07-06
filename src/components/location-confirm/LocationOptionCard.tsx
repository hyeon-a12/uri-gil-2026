import { Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS } from '@/constants/color';
import type { LocationSuggestion } from '@/types/recording';

type LocationOptionCardProps = {
  location: LocationSuggestion;
  selected: boolean;
  onPress: () => void;
};

function formatDistance(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)}km` : `${meters}m`;
}

/** 장소 추천 리스트의 개별 카드 */
export function LocationOptionCard({ location, selected, onPress }: LocationOptionCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        selected && styles.cardSelected,
        pressed && styles.cardPressed,
      ]}>
      <View style={styles.titleRow}>
        <Text style={[styles.name, selected && styles.textSelected]}>{location.name}</Text>
        <Text style={[styles.meta, selected && styles.textSelected]}>
          {location.category} · {formatDistance(location.distanceMeters)}
        </Text>
      </View>
      <Text style={[styles.address, selected && styles.addressSelected]} numberOfLines={2}>
        {location.address}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
  cardSelected: {
    backgroundColor: COLORS.locationSelect,
  },
  cardPressed: {
    opacity: 0.92,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  meta: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  address: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  textSelected: {
    color: COLORS.white,
  },
  addressSelected: {
    color: 'rgba(255, 255, 255, 0.85)',
  },
});
