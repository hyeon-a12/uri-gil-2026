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
    <View style={[styles.card, { borderRadius: ms(24), padding: ms(18) }]}>
      <Text style={[styles.title, { fontSize: ms(19), lineHeight: ms(25) }]}>{title}</Text>
      <Text style={[styles.subtitle, { fontSize: ms(13), lineHeight: ms(19) }]}>{subtitle}</Text>

      <LinearGradient
        colors={[homeColors.mapWater, homeColors.mapLand]}
        start={{ x: 0, y: 0.2 }}
        end={{ x: 1, y: 0.8 }}
        style={[styles.mapArea, { height: ms(190), borderRadius: ms(18), marginTop: ms(14) }]}
      >
        <View style={[styles.decorCircle, { width: ms(110), height: ms(110), borderRadius: ms(55), left: -ms(25), bottom: -ms(35) }]} />
        <View style={[styles.decorCircle, { width: ms(145), height: ms(145), borderRadius: ms(73), right: -ms(50), top: -ms(55) }]} />

        <MaterialCommunityIcons
          name="pine-tree"
          size={ms(24)}
          color="rgba(255,255,255,0.82)"
          style={{ position: 'absolute', left: '9%', top: '16%' }}
        />
        <MaterialCommunityIcons
          name="home-variant"
          size={ms(25)}
          color="rgba(255,255,255,0.82)"
          style={{ position: 'absolute', right: '10%', top: '17%' }}
        />

        {markers.map((marker) => (
          <View
            key={marker.id}
            style={[
              styles.marker,
              {
                width: ms(36),
                height: ms(36),
                borderRadius: ms(18),
                left: marker.x as any,
                top: marker.y as any,
              },
            ]}
          >
            <Text style={[styles.markerText, { fontSize: ms(14) }]}>{marker.label}</Text>
          </View>
        ))}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: homeColors.card,
    borderWidth: 1,
    borderColor: homeColors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 3,
  },
  title: { fontWeight: '800', color: homeColors.textPrimary },
  subtitle: { color: homeColors.textSecondary, marginTop: 2, fontWeight: '500' },
  mapArea: { overflow: 'hidden' },
  decorCircle: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.12)' },
  marker: {
    position: 'absolute',
    backgroundColor: homeColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 4,
    elevation: 2,
  },
  markerText: { color: '#fff', fontWeight: '800' },
});
