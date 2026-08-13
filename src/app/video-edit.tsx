import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const COLORS = {
  background: '#FAF8F1',
  card: '#FFFFFF',
  white: '#FFFFFF',
  accent: '#FF7F5C',
  black: '#222222',
  gray500: '#8A8A8A',
  gray200: '#EDEAE2',
  divider: '#E4E0D2',
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PREVIEW_HORIZONTAL_MARGIN = 40;
const PREVIEW_WIDTH = SCREEN_WIDTH - PREVIEW_HORIZONTAL_MARGIN * 2;

interface EditableClip {
  id: string;
  thumbnailUri?: string;
  videoUri?: string; // 실제 재생 가능한 영상 경로. mock 데이터엔 없어서 재생 버튼이 비활성화됩니다.
  placeName?: string; // 촬영 장소명 (LocationConfirmScreen에서 저장된 값)
  recordedAt?: string; // ISO 문자열
}

// TODO: 클립 관리 화면에서 넘어온 실제 클립 목록(순서 포함)으로 교체
const MOCK_CLIPS: EditableClip[] = [
  { id: '1', placeName: '전주 한옥마을', recordedAt: '2026-07-24T14:30:00' },
  { id: '2', placeName: '전주 남부시장', recordedAt: '2026-07-24T15:05:00' },
  { id: '3', placeName: '전주 방수 맛집', recordedAt: '2026-07-24T17:20:00' },
];

/** 선택된 정보 조합(위치/시간/위치+시간)에 맞춰 실제 표시 문자열을 만들어요.
 * 사용자가 직접 입력하는 값이 아니라 클립 메타데이터를 그대로 조합한
 * 거라, 이 함수 하나만 클립 데이터 형태가 바뀔 때 고치면 나머지는
 * 안 건드려도 됩니다. */
function formatClipInfo(
  clip: EditableClip | null,
  contentType: InfoContentType,
): string {
  if (!clip) return '-';

  const timeLabel = clip.recordedAt
    ? new Date(clip.recordedAt).toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    : '-';
  const placeLabel = clip.placeName ?? '-';

  switch (contentType) {
    case 'location':
      return placeLabel;
    case 'time':
      return timeLabel;
    case 'both':
      return `${placeLabel} · ${timeLabel}`;
  }
}

type ToolId = 'text' | 'position' | 'mute';

const TOOLS: { id: ToolId; label: string; icon: keyof typeof Ionicons.glyphMap }[] =
  [
    { id: 'text', label: 'Text', icon: 'text-outline' },
    { id: 'position', label: '위치', icon: 'move-outline' },
    { id: 'mute', label: 'Mute', icon: 'volume-high-outline' },
  ];

// "Aa" 도구가 실제로 하는 일: 자유 텍스트 입력이 아니라, 클립에 이미
// 있는 정보(장소명/촬영 시각) 중 뭘 화면에 배지로 보여줄지 고르는
// 거예요. 그래서 사용자가 직접 타이핑할 값이 아니라, 클립 데이터에서
// 그대로 끌어와 조합만 하면 됩니다.
type InfoContentType = 'location' | 'time' | 'both';

const INFO_CONTENT_OPTIONS: { id: InfoContentType; label: string }[] = [
  { id: 'location', label: '위치' },
  { id: 'time', label: '시간' },
  { id: 'both', label: '위치 + 시간' },
];

type TextPosition = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | 'center';

const DEFAULT_TEXT_POSITION: TextPosition = 'bottomLeft';

const TEXT_POSITION_OPTIONS: { id: TextPosition; label: string }[] = [
  { id: 'topLeft', label: '왼쪽 위' },
  { id: 'topRight', label: '오른쪽 위' },
  { id: 'center', label: '가운데' },
  { id: 'bottomLeft', label: '왼쪽 아래' },
  { id: 'bottomRight', label: '오른쪽 아래' },
];

// 미니 프레임(positionFrame) 안에서 각 위치가 정확히 어디에 앉을지.
// StyleSheet.create 밖에 따로 둔 이유는, 이 값들이 TEXT_POSITION_OPTIONS의
// id를 키로 쓰는 "매핑 테이블"이라 순수 스타일이라기보단 데이터에 가까워서예요.
//
// center는 top/left를 50%로 주는 것만으론 안 돼요 — 그러면 spot의
// "왼쪽 위 모서리"가 프레임 정중앙에 오지, spot 자체가 정중앙에 오는 게
// 아니거든요. spot 크기(POSITION_SPOT_SIZE)의 절반만큼 음수 margin으로
// 당겨줘야 진짜 중앙에 옵니다. RN은 transform에 '%'를 못 써서(퍼센트
// translate 미지원) margin으로 우회했어요.
const POSITION_SPOT_SIZE = 32;
const POSITION_SPOT_STYLE: Record<TextPosition, ViewStyle> = {
  topLeft: { top: 10, left: 10 },
  topRight: { top: 10, right: 10 },
  center: {
    top: '50%',
    left: '50%',
    marginTop: -POSITION_SPOT_SIZE / 2,
    marginLeft: -POSITION_SPOT_SIZE / 2,
  },
  bottomLeft: { bottom: 10, left: 10 },
  bottomRight: { bottom: 10, right: 10 },
};

export default function VideoEditScreen() {
  const insets = useSafeAreaInsets();

  const [clips] = useState<EditableClip[]>(MOCK_CLIPS);

  // ── 편집 대상 클립 (타임라인 탭으로 바뀜) ──────────────────────
  // 정지 상태의 프리뷰가 이 클립을 따라가고(위 프리뷰 렌더링 참고),
  // "전체 재생" 여부와는 별개로 관리돼요 — 재생 중엔 재생 위치가
  // 우선이고, 재생이 멈추면 다시 이 클립이 프리뷰에 보입니다.
  const [editingClipId, setEditingClipId] = useState<string | null>(
    clips[0]?.id ?? null,
  );
  const editingClip = clips.find((c) => c.id === editingClipId) ?? null;

  // ── 전체 재생 (프리뷰 아래 재생 버튼) ──────────────────────────
  // 클립들을 순서대로 이어붙여 재생하는 상태예요. expo-video 플레이어
  // 하나로, 클립이 끝날 때마다 다음 클립의 videoUri로 소스를 교체하는
  // 방식입니다(서버에서 실제로 합쳐진 파일을 만드는 게 아니라, 클라이언트
  // 에서 순서대로 이어 트는 방식 — MVP 단계에선 이걸로 충분해요).
  const [playIndex, setPlayIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const player = useVideoPlayer(clips[playIndex]?.videoUri ?? null, (p) => {
    p.loop = false;
  });

  // 클립 하나 재생이 끝나면 다음 클립으로. 마지막 클립까지 다 재생되면
  // 처음(0번)으로 되돌리고 재생 상태를 끕니다.
  useEffect(() => {
    const subscription = player.addListener('playToEnd', () => {
      setPlayIndex((prevIndex) => {
        const nextIndex = prevIndex + 1;
        if (nextIndex < clips.length) {
          return nextIndex;
        }
        setIsPlaying(false);
        return 0;
      });
    });
    return () => subscription.remove();
  }, [player, clips.length]);

  // playIndex나 isPlaying이 바뀔 때마다 실제 플레이어에 반영.
  useEffect(() => {
    const nextUri = clips[playIndex]?.videoUri;
    if (!nextUri) return;

    if (isPlaying) {
      player.replace(nextUri);
      player.play();
    } else {
      player.pause();
    }
  }, [playIndex, isPlaying, clips, player]);

  const [activeTool, setActiveTool] = useState<ToolId | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [textPosition, setTextPosition] = useState<TextPosition>(
    DEFAULT_TEXT_POSITION,
  );
  // null = 아직 아무것도 안 골라서 정보 배지 자체가 꺼져있는 상태.
  const [infoContentType, setInfoContentType] =
    useState<InfoContentType | null>(null);

  const hasUnsavedChanges =
    isMuted ||
    textPosition !== DEFAULT_TEXT_POSITION ||
    infoContentType !== null;

  const hasPlayableClips = clips.some((c) => !!c.videoUri);

  function handlePlayPress() {
    if (!hasPlayableClips) return; // mock 데이터엔 실제 영상이 없어서 재생 불가

    if (isPlaying) {
      setIsPlaying(false);
      return;
    }
    // 처음부터 다시 재생 (재생 중 멈췄다가 이어보는 기능은 이번 범위 밖)
    setPlayIndex(0);
    setIsPlaying(true);
  }

  function handleToolPress(toolId: ToolId) {
    if (toolId === 'mute') {
      setIsMuted((prev) => !prev);
      return;
    }
    setActiveTool((prev) => (prev === toolId ? null : toolId));
  }

  function handleBackPress() {
    if (!hasUnsavedChanges) {
      router.back();
      return;
    }

    Alert.alert(
      '편집 내용이 사라져요',
      '지금 나가면 텍스트·위치·음소거 설정이 저장되지 않아요. 그래도 나가시겠어요?',
      [
        { text: '계속 편집', style: 'cancel' },
        { text: '나가기', style: 'destructive', onPress: () => router.back() },
      ],
    );
  }

  function handleExport() {
    // TODO: 텍스트/위치/음소거 설정을 반영해서 실제 내보내기(기기 저장) 로직 연결
  }

  return (
    <View style={styles.screen}>
      {/* 상단 바 */}
      <View style={[styles.headerRow, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          hitSlop={12}
          style={styles.backButton}
          onPress={handleBackPress}
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.black} />
        </TouchableOpacity>

        <Text allowFontScaling={false} style={styles.headerTitle}>
          Uri-Gil
        </Text>

        <TouchableOpacity
          style={styles.exportButton}
          activeOpacity={0.85}
          onPress={handleExport}
        >
          <Text allowFontScaling={false} style={styles.exportButtonText}>
            Export
          </Text>
        </TouchableOpacity>
      </View>

      {/* 프리뷰: 재생 중일 땐 이어붙인 전체 영상, 그 외엔 "지금 편집
          중인 클립"(editingClipId)의 프레임을 보여줘요. 텍스트를 어느
          클립에 넣는지 눈으로 보면서 작업해야 하니까, 타임라인에서
          편집 대상을 바꾸면 여기도 같이 바뀌는 게 맞아요. */}
      <View style={styles.previewWrapper}>
        {isPlaying && clips[playIndex]?.videoUri ? (
          <VideoView
            player={player}
            style={styles.previewImage}
            contentFit="cover"
            nativeControls={false}
          />
        ) : editingClip?.thumbnailUri ? (
          <Image
            source={{ uri: editingClip.thumbnailUri }}
            style={styles.previewImage}
          />
        ) : (
          <View style={styles.previewPlaceholder}>
            <Ionicons name="image-outline" size={28} color={COLORS.gray500} />
          </View>
        )}

        {isMuted && (
          <View style={styles.mutedBadge}>
            <Ionicons name="volume-mute" size={14} color={COLORS.white} />
          </View>
        )}
      </View>

      {/* 재생 버튼: 프리뷰 "아래"에 별도로 둡니다 — 프리뷰 안에 얹으면
          "탭한 위치가 재생 버튼인지 클립 선택인지" 헷갈릴 수 있어서,
          역할을 공간적으로도 분리했어요. */}
      <TouchableOpacity
        style={[styles.playButton, !hasPlayableClips && { opacity: 0.4 }]}
        onPress={handlePlayPress}
        disabled={!hasPlayableClips}
        activeOpacity={0.8}
      >
        <Ionicons
          name={isPlaying ? 'pause' : 'play'}
          size={16}
          color={COLORS.black}
        />
        <Text allowFontScaling={false} style={styles.playButtonText}>
          {isPlaying ? '일시정지' : '전체 재생'}
        </Text>
      </TouchableOpacity>

      {/* 클립 타임라인: 탭하면 "편집 대상"만 바뀝니다 (프리뷰/재생과 무관) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.timelineRow}
      >
        {clips.map((clip, index) => {
          const isEditing = clip.id === editingClipId;
          const isCurrentlyPlaying = isPlaying && index === playIndex;

          return (
            <React.Fragment key={clip.id}>
              <TouchableOpacity
                onPress={() => setEditingClipId(clip.id)}
                style={[
                  styles.timelineTile,
                  isEditing && styles.timelineTileEditing,
                ]}
                activeOpacity={0.85}
              >
                {clip.thumbnailUri ? (
                  <Image
                    source={{ uri: clip.thumbnailUri }}
                    style={styles.timelineThumb}
                  />
                ) : (
                  <View style={styles.timelineThumbPlaceholder} />
                )}

                <View style={styles.timelineBadge}>
                  <Text
                    allowFontScaling={false}
                    style={styles.timelineBadgeText}
                  >
                    {index + 1}
                  </Text>
                </View>

                {isCurrentlyPlaying && (
                  <View style={styles.nowPlayingBadge}>
                    <Ionicons name="volume-high" size={10} color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>

              {index < clips.length - 1 && (
                <View style={styles.timelineDivider} />
              )}
            </React.Fragment>
          );
        })}
      </ScrollView>

      {/* 도구바 — "Aa"를 누르면 editingClipId 클립의 장소명을 자동 채움
          제안 칩을 보여주는 식으로 이어붙이면 됩니다 (패널 내용은 TODO) */}
      <View style={styles.toolbarRow}>
        {TOOLS.map((tool) => {
          const isActive =
            activeTool === tool.id || (tool.id === 'mute' && isMuted);
          return (
            <TouchableOpacity
              key={tool.id}
              style={styles.toolButton}
              onPress={() => handleToolPress(tool.id)}
              activeOpacity={0.7}
            >
              {tool.id === 'text' ? (
                <Text
                  allowFontScaling={false}
                  style={[
                    styles.toolAaIcon,
                    isActive && { color: COLORS.accent },
                  ]}
                >
                  Aa
                </Text>
              ) : (
                <Ionicons
                  name={
                    tool.id === 'mute' && isMuted
                      ? 'volume-mute-outline'
                      : tool.icon
                  }
                  size={22}
                  color={isActive ? COLORS.accent : COLORS.black}
                />
              )}
              <Text
                allowFontScaling={false}
                style={[
                  styles.toolLabel,
                  isActive && { color: COLORS.accent },
                ]}
              >
                {tool.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {activeTool && (
        <View
          style={[styles.toolPanel, { paddingBottom: insets.bottom || 16 }]}
        >
          {activeTool === 'text' && (
            <View style={styles.infoPickerWrapper}>
              <Text allowFontScaling={false} style={styles.positionPickerLabel}>
                어떤 정보를 보여줄까요?
              </Text>

              <View style={styles.infoChipRow}>
                {INFO_CONTENT_OPTIONS.map((option) => {
                  const isSelected = infoContentType === option.id;
                  return (
                    <TouchableOpacity
                      key={option.id}
                      onPress={() =>
                        // 이미 선택된 걸 다시 누르면 꺼짐(off) —
                        // 정보 배지 자체를 안 보이게 하는 유일한 방법이에요.
                        setInfoContentType((prev) =>
                          prev === option.id ? null : option.id,
                        )
                      }
                      style={[
                        styles.infoChip,
                        isSelected && styles.infoChipSelected,
                      ]}
                    >
                      <Text
                        allowFontScaling={false}
                        style={[
                          styles.infoChipText,
                          isSelected && styles.infoChipTextSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* 실제로 어떻게 보일지 미리 보여주는 자리. 사용자가 직접
                  타이핑하는 게 아니라 클립 데이터를 그대로 조합한
                  거라서, "이 값이 맞는지" 바로 확인시켜주는 게 중요해요. */}
              {infoContentType && (
                <Text allowFontScaling={false} style={styles.infoPreviewText}>
                  {formatClipInfo(editingClip, infoContentType)}
                </Text>
              )}
            </View>
          )}

          {activeTool === 'position' && (
            <View style={styles.positionPickerWrapper}>
              <Text allowFontScaling={false} style={styles.positionPickerLabel}>
                텍스트를 어디에 놓을까요?
              </Text>

              {/* 클립 비율(3:4)을 축소한 미니 프레임 안에, 실제 배치될
                  자리 그대로 5개 지점을 겹쳐서 보여줘요. 목록보다 이렇게
                  "실제 화면처럼 보이는 자리를 직접 탭"하는 게 훨씬
                  직관적이에요. */}
              <View style={styles.positionFrame}>
                {TEXT_POSITION_OPTIONS.map((option) => {
                  const isSelected = textPosition === option.id;
                  return (
                    <TouchableOpacity
                      key={option.id}
                      onPress={() => setTextPosition(option.id)}
                      style={[
                        styles.positionSpot,
                        POSITION_SPOT_STYLE[option.id],
                        isSelected && styles.positionSpotSelected,
                      ]}
                    >
                      <View
                        style={[
                          styles.positionSpotDot,
                          isSelected && styles.positionSpotDotSelected,
                        ]}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text allowFontScaling={false} style={styles.positionSelectedLabel}>
                {TEXT_POSITION_OPTIONS.find((o) => o.id === textPosition)?.label}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.black,
    marginLeft: 4,
  },
  exportButton: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
  },
  exportButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  previewWrapper: {
    width: PREVIEW_WIDTH,
    aspectRatio: 3 / 4,
    alignSelf: 'center',
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: COLORS.gray200,
    marginBottom: 12,
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mutedBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  playButton: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 9,
    marginBottom: 18,
  },
  playButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.black,
  },

  timelineRow: {
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 8,
  },
  timelineTile: {
    width: 64,
    height: 64,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  timelineTileEditing: {
    borderColor: COLORS.accent,
  },
  timelineThumb: {
    width: '100%',
    height: '100%',
  },
  timelineThumbPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.gray200,
  },
  timelineBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  nowPlayingBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineDivider: {
    width: 1,
    height: 36,
    backgroundColor: COLORS.divider,
  },

  toolbarRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    marginTop: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  toolButton: {
    alignItems: 'center',
    gap: 6,
    minWidth: 60,
  },
  toolAaIcon: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.black,
  },
  toolLabel: {
    fontSize: 11,
    color: COLORS.black,
  },

  toolPanel: {
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    backgroundColor: COLORS.card,
    paddingHorizontal: 20,
    paddingTop: 16,
    minHeight: 120,
  },

  // 텍스트 위치 선택 패널
  positionPickerWrapper: {
    alignItems: 'center',
  },
  positionPickerLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.black,
    marginBottom: 14,
  },
  positionFrame: {
    width: 96,
    height: 128,
    borderRadius: 12,
    backgroundColor: COLORS.gray200,
    position: 'relative',
  },
  positionSpot: {
    position: 'absolute',
    width: POSITION_SPOT_SIZE,
    height: POSITION_SPOT_SIZE,
    borderRadius: POSITION_SPOT_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  positionSpotSelected: {
    backgroundColor: 'rgba(255,127,92,0.18)',
  },
  positionSpotDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.gray500,
  },
  positionSpotDotSelected: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  positionSelectedLabel: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.accent,
  },

  // 위치/시간 정보 선택 패널
  infoPickerWrapper: {
    alignItems: 'center',
  },
  infoChipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  infoChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: COLORS.gray200,
  },
  infoChipSelected: {
    backgroundColor: COLORS.accent,
  },
  infoChipText: {
    fontSize: 13,
    color: COLORS.gray500,
  },
  infoChipTextSelected: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  infoPreviewText: {
    marginTop: 14,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.black,
  },
});
