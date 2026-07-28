import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useResponsive } from '../hooks/use-responsive';
import { homeColors } from '../constants/home-theme';
import { RecentClip } from '../types/home';

interface Props {
  item: RecentClip;
  width: number;
}

export default function ClipThumbnail({ item, width }: Props) {
  const { moderateScale: ms } = useResponsive();
  const height = width * 1.3;

  return (
    <TouchableOpacity style={{ width, marginRight: ms(10) }} activeOpacity={0.85}>
      <View style={{ width, height, borderRadius: ms(12), overflow: 'hidden', backgroundColor: '#eee' }}>
        <Image source={{ uri: item.image }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        <View style={[styles.playOverlay, { width: ms(28), height: ms(28), borderRadius: ms(14) }]}>
          <Ionicons name="play" size={ms(15)} color="#fff" />
        </View>
        <Text style={[styles.duration, { fontSize: ms(10) }]}>{item.duration}</Text>
      </View>
      <Text style={[styles.location, { fontSize: ms(11) }]} numberOfLines={1}>
        {item.location}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  playOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -14,
    marginLeft: -14,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  duration: { position: 'absolute', right: 6, bottom: 6, color: '#fff', fontWeight: '500' },
  location: { marginTop: 4, color: homeColors.textSecondary },
});
