import React, { useState, useRef, useEffect, } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  Modal,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useEvent } from 'expo';
import { ClipItem } from '@/types/home';
import { useVideoPlayer, VideoView } from "expo-video";
import { COLORS as SHARED_COLORS } from '@/constants/color';

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
  if (!clip) return null;
  return <SingleClipPreview clip={clip} onClose={onClose} />;
}

function SingleClipPreview({ clip, onClose }: { clip: ClipItem; onClose: () => void }) {
  const [isPlaying, setIsPlaying] = useState(true);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  const player = useVideoPlayer(clip?.uri ?? null, (p) => {
    p.loop = false;
    p.play();
  });

  const { status } = useEvent(player, 'statusChange', { status: player.status });

  // 진행바 속도는 clip.durationSeconds(촬영 당시 wall-clock으로 잰 값이라 살짝
  // 어긋날 수 있음) 대신, 재생기가 실제로 읽어들인 영상 길이(player.duration)를
  // 우선 씁니다 — 그래야 진행바가 끝까지 차는 시점과 영상이 실제로 끝나는 시점이
  // 항상 정확히 맞아떨어져요. 아직 메타데이터를 못 읽었을 때만 저장된 값으로 대체.
  const getDurationMs = () =>
    (player.duration > 0 ? player.duration : (clip?.durationSeconds ?? 5)) * 1000;

  useEffect(() => {
    if (!clip || status !== 'readyToPlay') return;

    // 웹에서는 useVideoPlayer의 setup 콜백(위 p.play())이 <video> DOM이 마운트되기
    // 전에 실행돼서 최초 재생 명령이 씹히고, 화면이 멈춰있다가 한 번 터치해야만
    // 재생되는 문제가 있었습니다. 실제로 재생 가능해진(readyToPlay) 이 시점엔
    // <video>가 이미 마운트돼 있으므로, 여기서 다시 한번 명시적으로 재생을
    // 걸어줍니다. 네이티브는 이 시점에 이미 재생 중이라 중복 호출해도 무해합니다.
    player.play();

    progressAnim.setValue(0);
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: getDurationMs(),
      useNativeDriver: false,
    }).start();
  }, [clip, status]);

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
        const remainingMs = getDurationMs() * (1 - currentValue);

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
            contentFit='cover'
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
        justifyContent: 'center',
    },
    videoContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    video: {
        width: '100%',
        aspectRatio: 9 / 16,
    },
    pauseIconOverlay: {
        ...StyleSheet.absoluteFill,
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
        color: '#FFFFFF',
        marginTop: 2,
    },
    closeButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
