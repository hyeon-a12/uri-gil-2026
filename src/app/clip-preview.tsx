import React, { useState, useRef, useEffect, } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  Modal,
  Animated,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useVideoPlayer, VideoView } from "expo-video";
import { COLORS as SHARED_COLORS } from '@/constants/color';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const COLORS = {
  background: SHARED_COLORS.background,
  card: SHARED_COLORS.background,

  primary: SHARED_COLORS.accent,
  primaryPressed: SHARED_COLORS.accentPressed,
  primarySoft: SHARED_COLORS.main,

  textPrimary: SHARED_COLORS.textPrimary,
  textSecondary: SHARED_COLORS.textSecondary,
  textTertiary: SHARED_COLORS.textSecondary,

  border: SHARED_COLORS.border,
  divider: SHARED_COLORS.border,

  unchecked: '#B5B5AF',
  delete: SHARED_COLORS.danger,
  shadow: SHARED_COLORS.shadow,
  disabled: '#D8D5CF',

  overlay: 'rgba(0,0,0,0.25)',
};

interface ClipItem {
  id: string;
  title: string;
  recordedAt: string;
  durationSeconds: number;
  thumbnail: string;
  uri: string;
}

interface ClipPreviewModalProps {
  clip: ClipItem | null;
  onClose: () => void;
}

const formatDate = (isoString: string) => {
  const date = new Date(isoString);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}.${mm}.${dd} ${hh}:${min}`;
};

export function ClipPreviewModal({ clip, onClose }: ClipPreviewModalProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  const player = useVideoPlayer(clip?.uri ?? null, (p) => {
    p.loop = false;
    p.play();
  });

  useEffect(() => {
    if (!clip) return;

    const durationMs = (clip.durationSeconds ?? 5) * 1000;

    progressAnim.setValue(0);
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: durationMs,
      useNativeDriver: false,
    }).start();
  }, [clip]);

  useEffect(() => {
    if (!player) return;

    const subscription = player.addListener('playToEnd', () => {
      onClose();
    });

    return () => subscription.remove();
  }, [player, onClose]);

  const togglePlayPause = () => {
    if (isPlaying) {
      player.pause();
      progressAnim.stopAnimation();
    } else {
      player.play();
      progressAnim.stopAnimation((currentValue) => {
        const durationMs = (clip?.durationSeconds ?? 5) * 1000;
        const remainingMs = durationMs * (1 - currentValue);

        Animated.timing(progressAnim, {
          toValue: 1,
          duration: remainingMs,
          useNativeDriver: false,
        }).start();
      });
    }
    setIsPlaying(!isPlaying);
  };

  if (!clip) return null;

  return (
    <Modal
      visible={!!clip}
      transparent
      animationType='fade'
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={previewStyles.container}>
        <Pressable
          style={previewStyles.videoContainer}
          onPress={togglePlayPause}
        >
          <VideoView
            player={player}
            style={previewStyles.video}
            contentFit='contain'
            nativeControls={false}
          />

          {!isPlaying && (
            <View style={previewStyles.pauseIconOverlay} pointerEvents='none'>
              <View style={previewStyles.pauseIconBg}>
                <Ionicons name='play' size={32} color="#FFFFFF" />
              </View>
            </View>
          )}
        </Pressable>

        <View style={[previewStyles.topBar, { paddingTop: insets.top + 10 }]}>
          <View style={previewStyles.progressTrack}>
            <Animated.View
              style={[
                previewStyles.progressFill,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>

          <View style={previewStyles.topInfoRow}>
            <View style={previewStyles.clipInfo}>
              <Text
                numberOfLines={1}
                allowFontScaling={false}
                style={previewStyles.clipTitle}
              >
                {clip.title}
              </Text>
              <Text
                allowFontScaling={false}
                style={previewStyles.clipDate}
              >
                {formatDate(clip.recordedAt)}
              </Text>
            </View>

            <Pressable
              hitSlop={12}
              onPress={onClose}
              style={previewStyles.closeButton}
            >
              <Ionicons name='close' size={26} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const previewStyles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000',
    },
    videoContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    video: {
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
    },
    pauseIconOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pauseIconBg: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: 'rgba(0,0,0,0.55)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    topBar: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 12,
    },
    progressTrack: {
        height: 3,
        borderRadius: 1.5,
        backgroundColor: 'rgba(255,255,255,0.3)',
        overflow: 'hidden',
        marginBottom: 12,
    },
    progressFill: {
        height: '100%',
        borderRadius: 1.5,
        backgroundColor: '#FFFFFF',
    },
    topInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
    },
    clipInfo: {
        flex: 1,
        marginRight: 12,
    },
    clipTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    clipDate: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.8',
        marginTop: 2,
    },
    closeButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
