import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useResponsive } from '../hooks/use-responsive';
import { homeColors } from '../constants/home-theme';
import { TripRoute } from '../types/home';

export default function TripMapCard({ title, subtitle, markers = [] }: TripRoute) {
  const { moderateScale: ms } = useResponsive();

  return (
    <View style={[styles.card, { borderRadius: ms(20), padding: ms(16) }]}>
      <Text style={[styles.title, { fontSize: ms(17) }]}>{title}</Text>
      <Text style={[styles.subtitle, { fontSize: ms(12) }]}>{subtitle}</Text>

      <LinearGradient
        colors={[homeColors.mapWater, homeColors.mapLand]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.mapArea, { height: ms(140), borderRadius: ms(14), marginTop: ms(10) }]}
      >
        <MaterialCommunityIcons
          name="pine-tree"
          size={ms(18)}
          color="rgba(255,255,255,0.7)"
          style={{ position: 'absolute', left: '8%', top: '15%' }}
        />
        <MaterialCommunityIcons
          name="home-variant"
          size={ms(18)}
          color="rgba(255,255,255,0.7)"
          style={{ position: 'absolute', right: '10%', top: '18%' }}
        />

        {markers.map((m) => (
          <View
            key={m.id}
            style={[
              styles.marker,
              { width: ms(26), height: ms(26), borderRadius: ms(13), left: m.x as any, top: m.y as any },
            ]}
          >
            <Text style={[styles.markerText, { fontSize: ms(12) }]}>{m.label}</Text>
          </View>
        ))}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: homeColors.card, borderWidth: 1, borderColor: homeColors.border },
  title: { fontWeight: '600', color: homeColors.textPrimary },
  subtitle: { color: homeColors.textSecondary, marginTop: 2 },
  mapArea: { overflow: 'hidden' },
  marker: {
    position: 'absolute',
    backgroundColor: homeColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  markerText: { color: '#fff', fontWeight: '700' },
});
