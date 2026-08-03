import React from 'react';
import { View, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { AppText as Text } from '@/components/AppText';
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
  const height = width * 1.22;
  const playSize = ms(42);

  return (
    <TouchableOpacity style={{ width, marginRight: ms(12) }} activeOpacity={0.86}>
      <View style={[styles.imageWrap, { width, height, borderRadius: ms(16) }]}>
        <Image source={{ uri: item.image }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        <View style={styles.scrim} />
        <View
          style={[
            styles.playOverlay,
            {
              width: playSize,
              height: playSize,
              borderRadius: playSize / 2,
              marginLeft: -playSize / 2,
              marginTop: -playSize / 2,
            },
          ]}
        >
          <Ionicons name="play" size={ms(20)} color="#fff" style={{ marginLeft: ms(2) }} />
        </View>
        <Text style={[styles.duration, { fontSize: ms(11) }]}>{item.duration}</Text>
      </View>
      <Text style={[styles.location, { fontSize: ms(13), lineHeight: ms(18) }]} numberOfLines={1}>
        {item.location}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  imageWrap: { overflow: 'hidden', backgroundColor: '#E9E9E5' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.06)' },
  playOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    backgroundColor: 'rgba(25,25,25,0.46)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  duration: {
    position: 'absolute',
    right: 8,
    bottom: 7,
    color: '#fff',
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowRadius: 3,
  },
  location: { marginTop: 7, color: homeColors.textSecondary, fontWeight: '500' },
});
