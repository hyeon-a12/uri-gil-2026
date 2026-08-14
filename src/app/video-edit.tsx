import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Switch,
  Animated,
  StyleSheet,
  Dimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS as SHARED_COLORS } from '@/constants/color';

const COLORS = {
  background: SHARED_COLORS.backgroundIvory,
  card: SHARED_COLORS.background,
  white: SHARED_COLORS.background,
  accent: SHARED_COLORS.accent,
  black: SHARED_COLORS.textPrimary,
  gray500: SHARED_COLORS.textSecondary,
  gray200: SHARED_COLORS.borderIvory,
  divider: SHARED_COLORS.borderIvory,
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PREVIEW_HORIZONTAL_MARGIN = 40;
const PREVIEW_WIDTH = SCREEN_WIDTH - PREVIEW_HORIZONTAL_MARGIN * 2;

// ── 클립 데이터 ──────────────────────────────────────────────
interface EditableClip {
  id: string;
  thumbnailUri?: string;
  videoUri?: string; // mock엔 없어서 재생 버튼이 비활성화됩니다.
  placeName?: string;
  recordedAt?: string; // ISO
  durationSeconds: number;
}

// TODO: 클립 관리 화면에서 넘어온 실제 클립 목록(순서 포함)으로 교체
const MOCK_CLIPS: EditableClip[] = [
  {
    id: '1',
    placeName: '전주 한옥마을',
    recordedAt: '2026-07-24T14:30:00',
    durationSeconds: 6,
  },
  {
    id: '2',
    placeName: '전주 남부시장',
    recordedAt: '2026-07-24T15:05:00',
    durationSeconds: 8,
  },
  {
    id: '3',
    placeName: '전주 방수 맛집',
    recordedAt: '2026-07-24T17:20:00',
    durationSeconds: 5,
  },
];

// ── 도구바 ───────────────────────────────────────────────────
type ToolId = 'text' | 'position' | 'mute';

const TOOLS: { id: ToolId; label: string; icon: keyof typeof Ionicons.glyphMap }[] =
  [

    { id: 'text', label: '정보', icon: 'text-outline' },
    { id: 'position', label: '위치', icon: 'move-outline' },
    { id: 'mute', label: '음소거', icon: 'volume-high-outline' },
  ];

// "Aa" 도구 = 자유 텍스트가 아니라, 클립에 이미 있는 정보(장소/시간) 중
// 뭘 보여줄지 고르는 도구예요.
type InfoContentType = 'location' | 'time' | 'both';

const INFO_CONTENT_OPTIONS: { id: InfoContentType; label: string }[] = [
  { id: 'location', label: '위치' },
  { id: 'time', label: '시간' },
  { id: 'both', label: '위치 + 시간' },
];

type FontId = 'handwriting' | 'baemin' | 'myeongjo';

const FONT_OPTIONS: { id: FontId; label: string }[] = [
  { id: 'handwriting', label: '손글씨체' },
  { id: 'baemin', label: '배민체' },
  { id: 'myeongjo', label: '조선명조체' },
];

// 3×3 그리드. 화면에 그릴 때도 이 순서 그대로 3개씩 끊어서 3행으로 배치해요.
type TextPosition =
  | 'topLeft'
  | 'topCenter'
  | 'topRight'
  | 'middleLeft'
  | 'center'
  | 'middleRight'
  | 'bottomLeft'
  | 'bottomCenter'
  | 'bottomRight';

const TEXT_POSITION_GRID: TextPosition[] = [
  'topLeft',
  'topCenter',
  'topRight',
  'middleLeft',
  'center',
  'middleRight',
  'bottomLeft',
  'bottomCenter',
  'bottomRight',
];

const DEFAULT_TEXT_POSITION: TextPosition = 'bottomLeft';

// ── 클립별 편집 상태 ─────────────────────────────────────────
// 예전엔 텍스트/위치/폰트/음소거를 화면 전체에서 하나로 관리했는데,
// 그러면 클립 1에 텍스트를 넣었을 때 클립 2에도 똑같이 보이는 버그가
// 생겨요. 그래서 clipId를 키로 쓰는 객체로 바꿔서, 클립마다 독립적인
// 설정을 갖게 했습니다.
interface ClipEditState {
  infoContentType: InfoContentType | null;
  textPosition: TextPosition;
  fontId: FontId;
  isMuted: boolean;
}

const DEFAULT_CLIP_EDIT_STATE: ClipEditState = {
  infoContentType: null,
  textPosition: DEFAULT_TEXT_POSITION,
  fontId: 'handwriting',
  isMuted: false,
};

function isDefaultEditState(state: ClipEditState): boolean {
  return (
    state.infoContentType === DEFAULT_CLIP_EDIT_STATE.infoContentType &&
    state.textPosition === DEFAULT_CLIP_EDIT_STATE.textPosition &&
    state.fontId === DEFAULT_CLIP_EDIT_STATE.fontId &&
    state.isMuted === DEFAULT_CLIP_EDIT_STATE.isMuted
  );
}

/** 선택된 정보 조합(위치/시간/위치+시간)에 맞춰 실제 표시 문자열을 만들어요. */
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

function formatTimer(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function VideoEditScreen() {
  const insets = useSafeAreaInsets();

  const [clips] = useState<EditableClip[]>(MOCK_CLIPS);
  const totalDurationSeconds = useMemo(
    () => clips.reduce((sum, c) => sum + c.durationSeconds, 0),
    [clips],
  );

  // 눈금 간격은 전체 길이에 맞춰 자동으로 성깁니다 — 짧은 영상은 1초마다,
  // 길어질수록 5초/10초 단위로 넘어가서 눈금이 서로 겹치지 않게 해요.
  const rulerStepSeconds =
    totalDurationSeconds > 60 ? 10 : totalDurationSeconds > 20 ? 5 : 1;
  const rulerTicks = useMemo(() => {
    const ticks: number[] = [];
    for (let s = 0; s <= totalDurationSeconds; s += rulerStepSeconds) {
      ticks.push(s);
    }
    return ticks;
  }, [totalDurationSeconds, rulerStepSeconds]);

  const [editingClipId, setEditingClipId] = useState<string | null>(
    clips[0]?.id ?? null,
  );
  const editingClip = clips.find((c) => c.id === editingClipId) ?? null;

  const [editStates, setEditStates] = useState<Record<string, ClipEditState>>(
    {},
  );

  function getEditState(clipId: string | null): ClipEditState {
    if (!clipId) return DEFAULT_CLIP_EDIT_STATE;
    return editStates[clipId] ?? DEFAULT_CLIP_EDIT_STATE;
  }

  function updateEditingClipState(patch: Partial<ClipEditState>) {
    if (!editingClipId) return;
    setEditStates((prev) => ({
      ...prev,
      [editingClipId]: {
        ...getEditState(editingClipId),
        ...patch,
      },
    }));
  }

  const editingState = getEditState(editingClipId);

  const hasUnsavedChanges = Object.values(editStates).some(
    (state) => !isDefaultEditState(state),
  );

  // ── 재생 ────────────────────────────────────────────────
  // 클립이 선택돼 있으면(editingClipId) 그 클립 하나만 재생하고 끝나면 멈춰요.
  // 선택된 클립이 없으면 전체 클립을 이어서(playIndex 순서대로) 재생합니다.
  const [playIndex, setPlayIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const playingClip = editingClipId ? editingClip : clips[playIndex] ?? null;

  const player = useVideoPlayer(clips[playIndex]?.videoUri ?? null, (p) => {
    p.loop = false;
  });

  useEffect(() => {
    const subscription = player.addListener('playToEnd', () => {
      if (editingClipId) {
        // 단일 클립 모드: 다음 클립으로 안 넘어가고 그냥 멈춥니다.
        setIsPlaying(false);
        return;
      }
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
  }, [player, clips.length, editingClipId]);

  useEffect(() => {
    if (!playingClip?.videoUri) return;

    if (isPlaying) {
      // 재생 중인 클립이 음소거 설정돼 있으면 반영합니다.
      player.muted = getEditState(playingClip.id).isMuted;
      player.replace(playingClip.videoUri);
      player.play();
    } else {
      player.pause();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playingClip, isPlaying, player]);

  const hasPlayableClips = clips.some((c) => !!c.videoUri);

  function handlePlayPress() {
    if (!hasPlayableClips) return;
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }
    if (!editingClipId) {
      setPlayIndex(0);
    }
    setIsPlaying(true);
  }

  // 클립 타일을 다시 누르거나(선택 해제) 클립 영역 바깥을 누르면 선택을
  // 취소하고, 재생 모드도 전체 재생으로 되돌립니다.
  function deselectClip() {
    if (!editingClipId) return;
    setEditingClipId(null);
    setIsPlaying(false);
  }

  // ── 도구 패널 ────────────────────────────────────────────
  const [activeTool, setActiveTool] = useState<ToolId | null>(null);

  // Text/Position 패널은 백드롭 + 아래에서 올라오는 시트예요.
  // Mute는 그런 "화면"이 아니라 바로 토글되는 가벼운 동작이라
  // sheetTranslateY 애니메이션 대상에서 제외했습니다.
  const isSheetTool = activeTool === 'text' || activeTool === 'position';
  const sheetTranslateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (isSheetTool) {
      Animated.spring(sheetTranslateY, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 4,
      }).start();
    } else {
      sheetTranslateY.setValue(SCREEN_HEIGHT);
    }
  }, [isSheetTool, sheetTranslateY]);

  function closeSheet() {
    setActiveTool(null);
  }

  function handleToolPress(toolId: ToolId) {
    // 버튼을 누르면 켜져있던 값을 바로 뒤집는 게 아니라, 다른 도구들처럼
    // 선택 영역(뮤트는 스위치)을 열어서 사용자가 직접 켜고 끄게 합니다.
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
    // TODO: editStates(클립별 텍스트/위치/폰트/음소거)를 반영해서
    // 실제 내보내기(기기 저장) 로직 연결
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

        <View style={styles.headerTitleBlock}>
          <Text allowFontScaling={false} style={styles.headerTitle}>
            Uri-Gil
          </Text>
          <Text allowFontScaling={false} style={styles.headerSubtitle}>
            VIDEO EDITOR
          </Text>
        </View>

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

      {/* 프리뷰 — 빈 배경을 탭하면 선택된 클립을 해제합니다 */}
      <Pressable style={styles.previewWrapper} onPress={deselectClip}>
        {isPlaying && playingClip?.videoUri ? (
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

        {/* 편집 대상 클립에 실제로 설정된 정보 배지 미리보기 */}
        {editingState.infoContentType && (
          <View
            pointerEvents="none"
            style={[
              styles.infoOverlay,
              TEXT_POSITION_STYLE[editingState.textPosition],
            ]}
          >
            <Text allowFontScaling={false} style={styles.infoOverlayText}>
              {formatClipInfo(editingClip, editingState.infoContentType)}
            </Text>
          </View>
        )}

        {editingState.isMuted && (
          <View style={styles.mutedBadge}>
            <Ionicons name="volume-mute" size={14} color={COLORS.white} />
          </View>
        )}
      </Pressable>

      <TouchableOpacity
        style={[styles.playButton, !hasPlayableClips && { opacity: 0.4 }]}
        onPress={handlePlayPress}
        disabled={!hasPlayableClips}
        activeOpacity={0.8}
      >
        <Ionicons
          name={isPlaying ? 'pause' : 'play'}
          size={20}
          color={COLORS.accent}
        />
      </TouchableOpacity>

      {/* 시간 표시 — 빈 배경을 탭하면 선택된 클립을 해제합니다 */}
      <Pressable style={styles.timeRow} onPress={deselectClip}>
        <Text allowFontScaling={false} style={styles.timeLabel}>
          00:00
        </Text>
        <Text allowFontScaling={false} style={styles.timeLabel}>
          {formatTimer(totalDurationSeconds)}
        </Text>
      </Pressable>

      {/* 타임 룰러 — 빈 배경을 탭하면 선택된 클립을 해제합니다 */}
      <Pressable style={styles.rulerRow} onPress={deselectClip}>
        {rulerTicks.map((second) => {
          const isMajor = rulerStepSeconds >= 5 || second % 5 === 0;
          return (
            <View key={second} style={styles.rulerTickWrapper}>
              <View
                style={[styles.rulerTick, isMajor && styles.rulerTickMajor]}
              />
            </View>
          );
        })}
      </Pressable>

      {/* 클립 타임라인 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.timelineRow}
      >
        {clips.map((clip, index) => {
          const isEditing = clip.id === editingClipId;
          const isCurrentlyPlaying = isPlaying && playingClip?.id === clip.id;
          const clipState = getEditState(clip.id);

          return (
            <TouchableOpacity
              key={clip.id}
              onPress={() => {
                if (isEditing) {
                  // 이미 선택된 클립을 다시 누르면 선택 해제
                  deselectClip();
                  return;
                }
                setEditingClipId(clip.id);
                setIsPlaying(false);
              }}
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
                <Text allowFontScaling={false} style={styles.timelineBadgeText}>
                  {index + 1}
                </Text>
              </View>

              {clipState.isMuted && (
                <View style={styles.timelineMuteBadge}>
                  <Ionicons name="volume-mute" size={10} color="#FFFFFF" />
                </View>
              )}

              {isCurrentlyPlaying && (
                <View style={styles.nowPlayingBadge}>
                  <Ionicons name="volume-high" size={10} color="#FFFFFF" />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* 도구바 — 화면 끝에 딱 붙지 않고 페이지 배경이 아래로 보이게 여백을
          둬서 카드가 떠 있는 느낌을 줍니다. */}
      <View style={[styles.toolbarRow, { marginBottom: insets.bottom || 16 }]}>
        {TOOLS.map((tool) => {
          const isActive =
            activeTool === tool.id ||
            (tool.id === 'mute' && editingState.isMuted);
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
                    tool.id === 'mute' && editingState.isMuted
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

      {/* 뮤트: 백드롭 없는 가벼운 인라인 영역 */}
      {activeTool === 'mute' && (
        <View style={[styles.muteInlineRow, { paddingBottom: insets.bottom || 16 }]}>
          <Text allowFontScaling={false} style={styles.muteInlineLabel}>
            이 클립 음소거
          </Text>
          <Switch
            value={editingState.isMuted}
            onValueChange={(value) => updateEditingClipState({ isMuted: value })}
            trackColor={{ true: COLORS.accent, false: COLORS.gray200 }}
          />
        </View>
      )}

      {/* Text/Position: 백드롭 + 아래에서 올라오는 시트 */}
      {isSheetTool && (
        <>
          <Pressable style={styles.backdrop} onPress={closeSheet} />
          <Animated.View
            style={[
              styles.sheet,
              {
                paddingBottom: insets.bottom || 16,
                transform: [{ translateY: sheetTranslateY }],
              },
            ]}
          >
            <View style={styles.sheetHeader}>
              <Text allowFontScaling={false} style={styles.sheetHeaderTitle}>
                {activeTool === 'text' ? '텍스트' : '위치'}
              </Text>
              <TouchableOpacity
                hitSlop={10}
                onPress={closeSheet}
                style={styles.sheetCheckButton}
              >
                <Ionicons name="checkmark" size={18} color={COLORS.white} />
              </TouchableOpacity>
            </View>

            {activeTool === 'text' && (
              <View>
                <Text allowFontScaling={false} style={styles.sheetSectionLabel}>
                  어떤 정보를 보여줄까요?
                </Text>
                <View style={styles.infoChipRow}>
                  {INFO_CONTENT_OPTIONS.map((option) => {
                    const isSelected = editingState.infoContentType === option.id;
                    return (
                      <TouchableOpacity
                        key={option.id}
                        onPress={() =>
                          // 이미 선택된 걸 다시 누르면 꺼짐(off)
                          updateEditingClipState({
                            infoContentType:
                              editingState.infoContentType === option.id
                                ? null
                                : option.id,
                          })
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

                <Text
                  allowFontScaling={false}
                  style={[styles.sheetSectionLabel, { marginTop: 20 }]}
                >
                  글꼴 선택
                </Text>
                <View style={styles.fontChipRow}>
                  {FONT_OPTIONS.map((font) => {
                    const isSelected = editingState.fontId === font.id;
                    return (
                      <TouchableOpacity
                        key={font.id}
                        onPress={() =>
                          updateEditingClipState({ fontId: font.id })
                        }
                        style={[
                          styles.fontChip,
                          isSelected && styles.fontChipSelected,
                        ]}
                      >
                        <Text
                          allowFontScaling={false}
                          style={[
                            styles.fontChipText,
                            isSelected && styles.fontChipTextSelected,
                          ]}
                        >
                          {font.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {activeTool === 'position' && (
              <View style={styles.positionGridWrapper}>
                <Text allowFontScaling={false} style={styles.sheetSectionLabel}>
                  텍스트를 어디에 놓을까요?
                </Text>
                <View style={styles.positionGrid}>
                  {TEXT_POSITION_GRID.map((positionId) => {
                    const isSelected = editingState.textPosition === positionId;
                    return (
                      <TouchableOpacity
                        key={positionId}
                        onPress={() =>
                          updateEditingClipState({ textPosition: positionId })
                        }
                        style={styles.positionGridCell}
                      >
                        <View
                          style={[
                            styles.positionDot,
                            isSelected && styles.positionDotSelected,
                          ]}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </Animated.View>
        </>
      )}
    </View>
  );
}

// 프리뷰 위에 정보 배지를 실제로 배치할 때 쓰는 스타일 매핑.
// TEXT_POSITION_GRID 순서랑 무관하게 항상 9개 다 정의돼 있어야 해요.
const TEXT_POSITION_STYLE: Record<TextPosition, object> = {
  topLeft: { top: 12, left: 12 },
  topCenter: { top: 12, alignSelf: 'center' },
  topRight: { top: 12, right: 12 },
  middleLeft: { top: '50%', left: 12, marginTop: -12 },
  center: { top: '50%', alignSelf: 'center', marginTop: -12 },
  middleRight: { top: '50%', right: 12, marginTop: -12 },
  bottomLeft: { bottom: 12, left: 12 },
  bottomCenter: { bottom: 12, alignSelf: 'center' },
  bottomRight: { bottom: 12, right: 12 },
};

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
  headerTitleBlock: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.black,
  },
  headerSubtitle: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1,
    color: COLORS.gray500,
    marginTop: 1,
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
  infoOverlay: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: PREVIEW_WIDTH - 40,
  },
  infoOverlayText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
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
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    marginBottom: 7,
  },

  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 4,
  },
  timeLabel: {
    fontSize: 11,
    color: COLORS.gray500,
    fontVariant: ['tabular-nums'],
  },

  // 클립 타임라인 바로 위, 아래 클립 목록과 같은 가로 폭(paddingHorizontal 20)에
  // 맞춰서 눈금이 클립 시작 위치와 나란히 보이도록 정렬했어요.
  rulerRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  rulerTickWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  rulerTick: {
    width: 1,
    height: 5,
    backgroundColor: COLORS.divider,
  },
  rulerTickMajor: {
    height: 9,
    backgroundColor: COLORS.gray500,
  },

  timelineRow: {
    paddingHorizontal: 20,
    gap: 6,
  },
  timelineTile: {
    width: 84,
    aspectRatio: 3 / 4,
    borderRadius: 12,
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
  timelineMuteBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
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

  toolbarRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: COLORS.card,
    borderRadius: 20,
    marginHorizontal: 20,
    // marginTop: 16,
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
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

  // 뮤트 인라인 영역 (백드롭 없음)
  muteInlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    backgroundColor: COLORS.card,
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  muteInlineLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.black,
  },

  // 백드롭 + 바텀시트 (Text/Position)
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  sheetHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.black,
  },
  sheetCheckButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetSectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.black,
    marginBottom: 10,
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

  fontChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  fontChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: COLORS.gray200,
  },
  fontChipSelected: {
    backgroundColor: COLORS.black,
  },
  fontChipText: {
    fontSize: 13,
    color: COLORS.gray500,
  },
  fontChipTextSelected: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  positionGridWrapper: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  positionGrid: {
    width: 168,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  positionGridCell: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  positionDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.gray500,
  },
  positionDotSelected: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
});
