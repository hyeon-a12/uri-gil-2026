import { useEffect, useState } from 'react';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { COLORS } from '@/constants/color';

type GridVideoPreviewProps = {
  /** 그리드 칸 순서대로 정렬된 클립 URI. 실제 파일을 합치는 게 아니라, 화면에서만
   * 최종 분할 영상이 어떤 느낌일지 미리 보여주는 용도예요(실제 합치기는 서버가 담당). */
  videoUris: string[];
  /** 기본 래퍼 스타일(둥근 모서리 카드)을 덮어써야 하는 곳(예: 전체화면 미리보기)에서 사용. */
  style?: StyleProp<ViewStyle>;
};

function PlayIcon() {
  return (
    <View style={styles.playButton}>
      <View style={styles.playTriangle} />
    </View>
  );
}

/** 그리드 칸 하나. 자기 몫의 클립을 재생하되, 시작/정지는 부모가 넘겨주는
 * isPlaying으로만 맞춥니다 — 여러 칸이 동시에 재생/정지되도록요. */
function GridVideoCell({ uri, isPlaying }: { uri: string; isPlaying: boolean }) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = true;
    // 칸마다 소리가 다 나오면 서로 겹쳐 시끄러워지니, 미리보기에서는 음소거합니다
    // (실제 소리가 살아있는 최종 렌더링은 서버 몫이에요).
    instance.muted = true;
  });

  useEffect(() => {
    if (isPlaying) {
      player.play();
    } else {
      player.pause();
    }
  }, [isPlaying, player]);

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      nativeControls={false}
    />
  );
}

/**
 * 그리드로 찍은 클립 여러 개를 실제 그리드 템플릿과 같은 비율로 쌓아서 동시
 * 재생하는 미리보기. rows2/rows3 템플릿 모두 가로줄로만 나누는 구조라, 칸
 * 개수(videoUris.length)만큼 세로로 등분해서 쌓으면 됩니다. 화면 아무 곳이나
 * 탭하면 전체 칸이 한 번에 재생/일시정지됩니다.
 */
export function GridVideoPreview({ videoUris, style }: GridVideoPreviewProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const cellPercent = 100 / videoUris.length;

  return (
    <View style={[styles.wrapper, style]}>
      {videoUris.map((uri, index) => (
        <View
          key={uri}
          style={[styles.cellWrapper, { top: `${index * cellPercent}%`, height: `${cellPercent}%` }]}
        >
          <GridVideoCell uri={uri} isPlaying={isPlaying} />
        </View>
      ))}
      {videoUris.slice(1).map((_, index) => (
        <View
          key={`divider-${index}`}
          style={[styles.dividerLine, { top: `${(index + 1) * cellPercent}%` }]}
        />
      ))}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => setIsPlaying((prev) => !prev)}
      >
        {!isPlaying && (
          <View style={styles.centerOverlay}>
            <PlayIcon />
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1A1A1A',
  },
  cellWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  dividerLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  centerOverlay: {
    flex: 1,
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
});
