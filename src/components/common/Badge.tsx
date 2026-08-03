import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AppText as Text } from '@/components/AppText';
import { statusColors } from '@/constants/menu-theme';

export type BadgeVariant = keyof typeof statusColors;

export function Badge({ variant, label }: { variant: BadgeVariant; label: string }) {
  const tone = statusColors[variant];

  return (
    <View style={[styles.badge, { backgroundColor: tone.bg }]}>
      <Text style={[styles.label, { color: tone.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
  },
});
