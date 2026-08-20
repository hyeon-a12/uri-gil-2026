import { useEvent, useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText as Text } from '@/components/AppText';

import { COLORS } from '@/constants/color';

type VideoPreviewProps = {
  videoUri: string | null;
};

function PlayIcon() {
  return (
    <View style={styles.playButton}>
      <View style={styles.playTriangle} />
    </View>
  );
}

function VideoPlayerContent({ videoUri }: { videoUri: string }) {
  const hasSeekFirstFrame = useRef(false);
  const player = useVideoPlayer(videoUri, (instance) => {
    instance.loop = false;
  });

  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const { status } = useEvent(player, 'statusChange', {status: player.status});
  const [progress, setProgress] = useState(0);

  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    const duration = player.duration;
    if (duration > 0) {
      setProgress(Math.min(currentTime / duration, 1));
    }
  });

  if (status === 'readyToPlay' && !hasSeekFirstFrame.current) {
    hasSeekFirstFrame.current = true;
    player.seekBy(0.1);
  }

  const togglePlayback = () => {
    if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
  };

  return (
    <View style={styles.videoWrapper}>
      <VideoView player={player} style={styles.video} contentFit="cover" nativeControls={false} />
      <Pressable style={styles.playOverlay} onPress={togglePlayback}>
        {!isPlaying ? <PlayIcon /> : null}
      </Pressable>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
    </View>
  );
}

/** 촬영된 영상 미리보기 — 카메라 모듈에서 받은 videoUri를 표시 */
export function VideoPreview({ videoUri }: VideoPreviewProps) {
  if (!videoUri) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>촬영된 영상이 여기에 표시됩니다</Text>
      </View>
    );
  }

  return <VideoPlayerContent key={videoUri} videoUri={videoUri} />;
}

const styles = StyleSheet.create({
  videoWrapper: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1A1A1A',
  },
  video: {
    flex: 1,
    width: '100%',
  },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 4,
  },
  playTriangle: {
    width: 0,
    height: 0,
    borderTopWidth: 10,
    borderBottomWidth: 10,
    borderLeftWidth: 16,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: COLORS.textPrimary,
  },
  progressTrack: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 12,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: COLORS.background,
  },
  placeholder: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  placeholderText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
});
