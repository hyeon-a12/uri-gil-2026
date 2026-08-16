import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Animated,
  StyleSheet,
  Dimensions,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS as SHARED_COLORS } from '@/constants/color';
import { getRecordingsByFolder } from '@/services/recordingService';

const COLORS = {
  background: SHARED_COLORS.background,
  card: SHARED_COLORS.background,
  white: SHARED_COLORS.background,
  accent: SHARED_COLORS.accent,
  primarySoft: SHARED_COLORS.main, // 연한 메인테마색
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
  { id: 'both', label: '시간 + 위치' },
];

type InfoTextAlign = 'left' | 'center' | 'right';

const ALIGN_OPTIONS: {
  id: InfoTextAlign;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}[] = [
  { id: 'left', label: '왼쪽 정렬', icon: 'format-align-left' },
  { id: 'center', label: '중앙 정렬', icon: 'format-align-center' },
  { id: 'right', label: '오른쪽 정렬', icon: 'format-align-right' },
];

type FontId =
  | 'pretendard'
  | 'maruburi'
  | 'keriskedu'
  | 'hakgyoansimnadeuri'
  | 'hakgyoansimbyeolbichhaneul';

const FONT_OPTIONS: { id: FontId; label: string }[] = [
  { id: 'pretendard', label: 'Pretendard' },
  { id: 'maruburi', label: '마루 부리' },
  { id: 'keriskedu', label: '케리스 케듀체' },
  { id: 'hakgyoansimnadeuri', label: '학교안심 나들이' },
  { id: 'hakgyoansimbyeolbichhaneul', label: '학교안심 별빛하늘' },
];

// 미리보기·글꼴 선택 칩에서 실제로 적용할 폰트 패밀리 이름.
// _layout.tsx의 useFonts에 등록된 이름과 반드시 일치해야 해요.
const FONT_FAMILY_MAP: Record<FontId, { regular: string; bold: string }> = {
  pretendard: { regular: 'Pretendard-Regular', bold: 'Pretendard-Bold' },
  maruburi: { regular: 'MaruBuri-Regular', bold: 'MaruBuri-Bold' },
  keriskedu: { regular: 'KERISKEDU-Regular', bold: 'KERISKEDU-Bold' },
  // 학교안심 나들이/별빛하늘은 Regular 웨이트가 없어서 Light를 기본(비볼드)으로 씀
  hakgyoansimnadeuri: {
    regular: 'HakgyoansimNadeuri-Light',
    bold: 'HakgyoansimNadeuri-Bold',
  },
  hakgyoansimbyeolbichhaneul: {
    regular: 'HakgyoansimByeolbichhaneul-Light',
    bold: 'HakgyoansimByeolbichhaneul-Bold',
  },
};

function getFontFamily(fontId: FontId, bold: boolean): string {
  return bold ? FONT_FAMILY_MAP[fontId].bold : FONT_FAMILY_MAP[fontId].regular;
}

const TEXT_COLOR_OPTIONS = ['#FFFFFF', '#222222', '#FF7F5C', '#FFD54F', '#7EC8E3'];

const MIN_TEXT_FONT_SIZE = 10;
const MAX_TEXT_FONT_SIZE = 28;

function clampFontSize(size: number): number {
  return Math.min(MAX_TEXT_FONT_SIZE, Math.max(MIN_TEXT_FONT_SIZE, size));
}

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

const DEFAULT_TEXT_POSITION: TextPosition = 'center';

// ── 편집 상태 ────────────────────────────────────────────────
// "정보"(infoContentType)/"위치"(textPosition)/"정렬"(textAlign)/시간·장소
// 각각의 글꼴·색상·크기(timeStyle/placeStyle)는 클립마다 다르게 두면 오히려
// 헷갈려서 영상 전체에 하나만 적용되는 전역 설정으로 뺐습니다. 음소거는
// 클립마다 다르게 쓰는 게 자연스러워서 clipId를 키로 쓰는 객체로 클립별
// 독립 설정을 유지합니다.
interface TextElementStyle {
  fontId: FontId;
  bold: boolean;
  color: string;
  fontSize: number;
}

const DEFAULT_TEXT_ELEMENT_STYLE: TextElementStyle = {
  fontId: 'pretendard',
  bold: false,
  color: '#FFFFFF',
  fontSize: 15,
};

function isDefaultTextElementStyle(style: TextElementStyle): boolean {
  return (
    style.fontId === DEFAULT_TEXT_ELEMENT_STYLE.fontId &&
    style.bold === DEFAULT_TEXT_ELEMENT_STYLE.bold &&
    style.color === DEFAULT_TEXT_ELEMENT_STYLE.color &&
    style.fontSize === DEFAULT_TEXT_ELEMENT_STYLE.fontSize
  );
}

interface GlobalEditState {
  infoContentType: InfoContentType | null;
  textPosition: TextPosition;
  textAlign: InfoTextAlign;
  timeStyle: TextElementStyle;
  placeStyle: TextElementStyle;
}

const DEFAULT_GLOBAL_EDIT_STATE: GlobalEditState = {
  infoContentType: null,
  textPosition: DEFAULT_TEXT_POSITION,
  textAlign: 'left',
  timeStyle: { ...DEFAULT_TEXT_ELEMENT_STYLE },
  placeStyle: { ...DEFAULT_TEXT_ELEMENT_STYLE },
};

function isDefaultGlobalEditState(state: GlobalEditState): boolean {
  return (
    state.infoContentType === DEFAULT_GLOBAL_EDIT_STATE.infoContentType &&
    state.textPosition === DEFAULT_GLOBAL_EDIT_STATE.textPosition &&
    state.textAlign === DEFAULT_GLOBAL_EDIT_STATE.textAlign &&
    isDefaultTextElementStyle(state.timeStyle) &&
    isDefaultTextElementStyle(state.placeStyle)
  );
}

interface ClipEditState {
  isMuted: boolean;
}

const DEFAULT_CLIP_EDIT_STATE: ClipEditState = {
  isMuted: false,
};

function isDefaultClipEditState(state: ClipEditState): boolean {
  return (
    state.isMuted === DEFAULT_CLIP_EDIT_STATE.isMuted
  );
}

function getTimeLabel(clip: EditableClip | null): string {
  if (!clip?.recordedAt) return '-';
  return new Date(clip.recordedAt).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function getPlaceLabel(clip: EditableClip | null): string {
  return clip?.placeName ?? '-';
}

function formatTimer(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

async function renderVideo(exportData: {
  folderId?: string;
  clips: Array<{
    id: string;
    videoUri: string;
    isMuted: boolean;
  }>;
  globalSetting: {
    infoContentType: string | null;
    textPosition: string;
    textAlign: string;
    timeStyle: TextElementStyle;
    placeStyle: TextElementStyle;
  };
}): Promise<{ success: boolean; message?: string }> {
  try {
    console.log('[renderVideo] 렌더링 시작', exportData);

    const response = await fetch('http://172.30.1.65:3000/process-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(exportData)
    });

    if (!response.ok) throw new Error(`서버 렌더링 실패: ${response.status}`);

    const result = await response.json();
    console.log('[renderVideo] 서버 응답:', result);

    if (!result.success) {
      return {
        success: false,
        message: result.message ?? '서버 처리 실패',
      };
    }

    const { downloadUrl } = await response.json();
    if (result.downloadUrl) {
      const localPath = FileSystem.documentDirectory + `output_${Date.now()}.mp4`;
      await FileSystem.downloadAsync(downloadUrl, localPath);

      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        return { success: false, message: '갤러리 접근 권한이 필요합니다.' };
      }
      await MediaLibrary.saveToLibraryAsync(localPath);
    }

    return { success: true };
  } catch (error) {
    console.error('[renderVideo] 실패:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : '알 수 없는 오류',
    };
  }
}

export default function VideoEditScreen() {
  const insets = useSafeAreaInsets();

  const { clipIds, folderId } = useLocalSearchParams<{
    clipIds?: string;
    folderId?: string;
  }>();

  const selectedClipIds = useMemo(() => {
    if (!clipIds) return [];
    return clipIds.split(',').filter((id) => id.length > 0);
  }, [clipIds]);

  const [clips, setClips] = useState<EditableClip[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!folderId || selectedClipIds.length === 0) {
        setClips([]);
        setIsLoading(false);
        return;
      }

      try {
        const allRecords = await getRecordingsByFolder(folderId);
        const editableClips: EditableClip[] = [];

        for (const id of selectedClipIds) {
          const record = allRecords.find((r) => r.id === id);
          if (!record) continue;

          editableClips.push({
            id: record.id,
            videoUri: record.videoUri,
            thumbnailUri: record.thumbnail,
            placeName: record.location?.placeName ?? undefined,
            recordedAt: record.recordedAt,
            durationSeconds: Math.floor((record.durationMs ?? 0) / 1000),
          });
        }
        
        setClips(editableClips);
      } catch (error) {
        console.error('[VideoEditScreen] 클립 로드 실패', error);
        setClips([]);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [folderId, selectedClipIds]);

  // 프리뷰 박스 하단이 화면 맨 위에서 몇 px 떨어져 있는지 실측한 값. 헤더 높이는
  // safe area(insets.top)에 따라 기기마다 달라져서 고정 숫자로 계산할 수 없어,
  // onLayout으로 실제 위치를 재서 바텀시트 높이를 거기 맞춰 늘립니다.
  const [previewBottomY, setPreviewBottomY] = useState<number | null>(null);

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

  const [editingClipId, setEditingClipId] = useState<string | null>(null);

  useEffect(() => {
    if (clips.length > 0 && !editingClipId) {
      setEditingClipId(clips[0].id);
    }
  }, [clips]);

  const editingClip = clips.find((c) => c.id === editingClipId) ?? null;

  // 정보 종류/위치/정렬/시간·장소 스타일은 영상 전체에 하나만 적용되는 전역 설정입니다.
  const [globalEditState, setGlobalEditState] = useState<GlobalEditState>(
    DEFAULT_GLOBAL_EDIT_STATE,
  );

  function updateGlobalEditState(patch: Partial<GlobalEditState>) {
    setGlobalEditState((prev) => ({ ...prev, ...patch }));
  }

  function updateTextElementStyle(
    target: 'time' | 'place',
    patch: Partial<TextElementStyle>,
  ) {
    setGlobalEditState((prev) => ({
      ...prev,
      [target === 'time' ? 'timeStyle' : 'placeStyle']: {
        ...(target === 'time' ? prev.timeStyle : prev.placeStyle),
        ...patch,
      },
    }));
  }

  // 음소거는 클립마다 따로 관리합니다.
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

  // 화면 렌더링 쪽에서 전역 설정 + 지금 편집 중인 클립의 설정을 한 번에 쓰기
  // 편하도록 합쳐둔 값이에요. 실제 저장은 위 두 state에 분리해서 합니다.
  const editingState = { ...globalEditState, ...getEditState(editingClipId) };

  const hasUnsavedChanges =
    !isDefaultGlobalEditState(globalEditState) ||
    Object.values(editStates).some((state) => !isDefaultClipEditState(state));

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

  // "텍스트" 시트 안의 서브탭: 표시(정보 종류·정렬) / 스타일(시간·장소 글꼴·색상·크기)
  const [sheetTab, setSheetTab] = useState<'display' | 'style'>('display');
  // 스타일 탭 안에서 지금 편집 중인 대상(시간 또는 장소)
  const [styleTarget, setStyleTarget] = useState<'time' | 'place'>('time');

  // 정보 종류에서 시간/장소 중 하나만 골랐으면 스타일 탭도 그 하나만 보여줍니다.
  const showTimeStyle = editingState.infoContentType !== 'location';
  const showPlaceStyle = editingState.infoContentType !== 'time';
  const effectiveStyleTarget: 'time' | 'place' =
    !showTimeStyle && showPlaceStyle
      ? 'place'
      : showTimeStyle && !showPlaceStyle
        ? 'time'
        : styleTarget;
  const currentTextStyle =
    effectiveStyleTarget === 'time'
      ? editingState.timeStyle
      : editingState.placeStyle;

  // 프리뷰에 떠 있는 시간/장소 텍스트를 직접 탭하면 그 요소를 스타일 편집
  // 대상으로 고르고, 텍스트 시트의 스타일 탭을 바로 엽니다.
  function handlePreviewTextTap(target: 'time' | 'place') {
    setStyleTarget(target);
    setSheetTab('style');
    setActiveTool('text');
  }

  // 시트 안 내용이 길어져서 스크롤될 때, 오른쪽에 지금 스크롤 위치를 보여주는
  // 얇은 바를 직접 그리기 위한 값들이에요(네이티브 스크롤바는 커스텀 스타일을
  // 줄 수 없어서 showsVerticalScrollIndicator를 끄고 이걸로 대체했습니다).
  // 스크롤 위치 자체는 매 프레임 setState로 리렌더하면 뚝뚝 끊기고 과하게
  // 움직여 보여서, 네이티브 드라이버로 도는 Animated.Value로 따로 뺐습니다.
  const [sheetScrollViewportHeight, setSheetScrollViewportHeight] = useState(0);
  const [sheetScrollContentHeight, setSheetScrollContentHeight] = useState(0);
  const sheetScrollY = useRef(new Animated.Value(0)).current;
  // Animated.event를 JSX 안에서 매 렌더 새로 만들면 "Changing onScroll listener
  // at runtime is not supported" 에러가 나서, ref로 한 번만 만들어 재사용합니다.
  // useNativeDriver: true로 두면 여기 ScrollView 조합에서 onScroll이 함수가
  // 아니라 이벤트 객체로 넘어가면서 크래시가 나서(TypeError: onScroll is not
  // a function), JS 드라이버로 돌립니다 — 조금 덜 매끄럽지만 안전합니다.
  const handleSheetScroll = useRef(
    Animated.event(
      [{ nativeEvent: { contentOffset: { y: sheetScrollY } } }],
      { useNativeDriver: false },
    ),
  ).current;

  // 스크롤할 내용이 실제로 뷰포트보다 길 때만 바를 보여줍니다.
  const isSheetScrollable =
    sheetScrollContentHeight > sheetScrollViewportHeight;
  const SHEET_SCROLLBAR_MIN_THUMB = 24;
  const sheetScrollThumbHeight = isSheetScrollable
    ? Math.max(
        SHEET_SCROLLBAR_MIN_THUMB,
        (sheetScrollViewportHeight / sheetScrollContentHeight) *
          sheetScrollViewportHeight,
      )
    : 0;
  const sheetScrollThumbTranslateY = sheetScrollY.interpolate({
    inputRange: [
      0,
      Math.max(1, sheetScrollContentHeight - sheetScrollViewportHeight),
    ],
    outputRange: [
      0,
      Math.max(0, sheetScrollViewportHeight - sheetScrollThumbHeight),
    ],
    extrapolate: 'clamp',
  });

  // Text/Position 패널은 백드롭 + 아래에서 올라오는 시트예요.
  // Mute는 그런 "화면"이 아니라 바로 토글되는 가벼운 동작이라
  // sheetTranslateY 애니메이션 대상에서 제외했습니다.
  const isSheetTool = activeTool === 'text' || activeTool === 'position';
  const sheetTranslateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  // 시트를 실제로 화면에 그릴지 여부. isSheetTool이 꺼지자마자 바로 언마운트해버리면
  // 내려가는 애니메이션이 재생될 틈도 없이 사라져서, 닫히는 애니메이션이 끝난
  // 뒤에야(onAnimationEnd 콜백) false로 바꿔줍니다.
  const [isSheetMounted, setIsSheetMounted] = useState(false);

  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (isSheetTool) {
      setIsSheetMounted(true);
      Animated.spring(sheetTranslateY, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 4,
      }).start();
    } else {
      Animated.timing(sheetTranslateY, {
        toValue: SCREEN_HEIGHT,
        duration: 220,
        useNativeDriver: true,
      }).start(() => {
        setIsSheetMounted(false);
      });
    }
  }, [isSheetTool, sheetTranslateY]);

  function closeSheet() {
    setActiveTool(null);
  }

  function handleToolPress(toolId: ToolId) {
    if (toolId === 'mute') {
      // 클립이 선택돼 있을 때만 그 클립의 음소거를 바로 뒤집습니다. 선택된
      // 클립이 없으면 updateEditingClipState가 아무 동작도 하지 않습니다.
      updateEditingClipState({ isMuted: !editingState.isMuted });
      return;
    }
    setActiveTool((prev) => (prev === toolId ? null : toolId));
  }

  function handleBackPress() {
    if (isExporting) {
      Alert.alert(
        '영상 생성 중이에요',
        '완료될 때까지 기다려주세요.'
      );
      return;
    }

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
    if (clips.length === 0) {
      Alert.alert(
        '편집할 클립이 없어요.',
        '클립을 선택해주세요.'
      );
      return;
    }

    if (isExporting) return;

    Alert.alert(
      '영상 생성하기',
      `${clips.length}개의 클립으로 영상을 만들까요?\n예상 길이: ${formatTimer(totalDurationSeconds)}`,
      [
        { text: '취소', style: 'cancel'},
        {
          text: '만들기',
          onPress: async () => {
            setIsExporting(true);

            const exportData = {
              folderId,
              clips: clips.map((clip) => ({
                id: clip.id,
                videoUri: clip.videoUri ?? '',
                isMuted: getEditState(clip.id).isMuted,
              })),
              globalSetting: {
                infoContentType: globalEditState.infoContentType,
                textPosition: globalEditState.textPosition,
                textAlign: globalEditState.textAlign,
                timeStyle: globalEditState.timeStyle,
                placeStyle: globalEditState.placeStyle,
              },
            };

            const result = await renderVideo(exportData);

            setIsExporting(false);

            if (result.success) {
              Alert.alert(
                '완료',
                '영상이 갤러리에 저장되었어요.',
                [
                  {
                    text: '확인',
                    onPress: () => {
                      router.replace('/');
                    },
                  },
                ],
                { cancelable: false },
              );
            } else {
              Alert.alert(
                '영상 만들기 실패',
                result.message ??
                '영상을 만드는 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.',
                [{ text: '확인' }],
              );
            }
          },
        },
      ],
    );
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
      <Pressable
        style={styles.previewWrapper}
        onPress={deselectClip}
        onLayout={(e) => {
          const { y, height } = e.nativeEvent.layout;
          setPreviewBottomY(y + height);
        }}
      >
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

        {/* 편집 대상 클립에 실제로 설정된 정보 배지 미리보기 —
            시간/장소 텍스트를 직접 탭하면 그 요소의 스타일 편집 화면이 열립니다. */}
        {editingState.infoContentType && (
          <View
            pointerEvents="box-none"
            style={[
              styles.infoOverlay,
              TEXT_POSITION_STYLE[editingState.textPosition],
            ]}
          >
            {(editingState.infoContentType === 'time' ||
              editingState.infoContentType === 'both') && (
              <Pressable
                onPress={() => handlePreviewTextTap('time')}
                style={
                  activeTool === 'text' &&
                  sheetTab === 'style' &&
                  effectiveStyleTarget === 'time'
                    ? styles.previewTextTapTargetActive
                    : styles.previewTextTapTarget
                }
              >
                <Text
                  allowFontScaling={false}
                  style={[
                    styles.infoOverlayText,
                    {
                      textAlign: editingState.textAlign,
                      color: editingState.timeStyle.color,
                      fontSize: editingState.timeStyle.fontSize,
                      fontFamily: getFontFamily(
                        editingState.timeStyle.fontId,
                        editingState.timeStyle.bold,
                      ),
                    },
                  ]}
                >
                  {getTimeLabel(editingClip)}
                </Text>
              </Pressable>
            )}
            {(editingState.infoContentType === 'location' ||
              editingState.infoContentType === 'both') && (
              <Pressable
                onPress={() => handlePreviewTextTap('place')}
                style={
                  activeTool === 'text' &&
                  sheetTab === 'style' &&
                  effectiveStyleTarget === 'place'
                    ? styles.previewTextTapTargetActive
                    : styles.previewTextTapTarget
                }
              >
                <Text
                  allowFontScaling={false}
                  style={[
                    styles.infoOverlayText,
                    {
                      textAlign: editingState.textAlign,
                      color: editingState.placeStyle.color,
                      fontSize: editingState.placeStyle.fontSize,
                      fontFamily: getFontFamily(
                        editingState.placeStyle.fontId,
                        editingState.placeStyle.bold,
                      ),
                    },
                  ]}
                >
                  {getPlaceLabel(editingClip)}
                </Text>
              </Pressable>
            )}
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

      {/* Text/Position: 백드롭 + 아래에서 올라오는 시트 */}
      {isSheetMounted && (
        <>
          <Pressable style={styles.backdrop} onPress={closeSheet} />
          <Animated.View
            style={[
              styles.sheet,
              {
                paddingBottom: insets.bottom || 16,
                // 시트 상단이 프리뷰 하단과 정확히 맞닿도록, 화면 전체 높이에서
                // 실측한 프리뷰 하단 위치를 뺀 만큼을 시트 높이로 쓰되, 프리뷰와
                // 딱 붙지 않도록 3px 간격을 남깁니다.
                height:
                  previewBottomY !== null
                    ? SCREEN_HEIGHT - previewBottomY - 5
                    : undefined,
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

            {/* 표시 / 스타일 서브탭 — 스크롤 영역 밖에 고정해서, 내용을 스크롤해도
                안 움직이고 오른쪽 스크롤바도 이 아래부터만 표시됩니다. */}
            {activeTool === 'text' && (
              <View style={styles.sheetTabRow}>
                <TouchableOpacity
                  onPress={() => setSheetTab('display')}
                  style={[
                    styles.sheetTabButton,
                    sheetTab === 'display' && styles.sheetTabButtonActive,
                  ]}
                >
                  <Text
                    allowFontScaling={false}
                    style={[
                      styles.sheetTabButtonText,
                      sheetTab === 'display' &&
                        styles.sheetTabButtonTextActive,
                    ]}
                  >
                    표시
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setSheetTab('style')}
                  style={[
                    styles.sheetTabButton,
                    sheetTab === 'style' && styles.sheetTabButtonActive,
                  ]}
                >
                  <Text
                    allowFontScaling={false}
                    style={[
                      styles.sheetTabButtonText,
                      sheetTab === 'style' &&
                        styles.sheetTabButtonTextActive,
                    ]}
                  >
                    스타일
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.sheetScrollWrapper}>
              <ScrollView
                style={styles.sheetScroll}
                contentContainerStyle={styles.sheetScrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                scrollEventThrottle={16}
                onLayout={(e) =>
                  setSheetScrollViewportHeight(e.nativeEvent.layout.height)
                }
                onContentSizeChange={(_w, h) => setSheetScrollContentHeight(h)}
                onScroll={handleSheetScroll}
              >
            {activeTool === 'text' && (
              <View>
                {sheetTab === 'display' && (
                  <View style={{ marginTop: 18 }}>
                    <Text
                      allowFontScaling={false}
                      style={styles.sheetSectionLabel}
                    >
                      정보
                    </Text>
                    <View style={styles.infoChipRow}>
                      {INFO_CONTENT_OPTIONS.map((option) => {
                        const isSelected =
                          editingState.infoContentType === option.id;
                        return (
                          <TouchableOpacity
                            key={option.id}
                            onPress={() =>
                              // 이미 선택된 걸 다시 누르면 꺼짐(off). 모든 클립에 공통으로 적용됩니다.
                              updateGlobalEditState({
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
                      정렬
                    </Text>
                    <View style={styles.alignChipRow}>
                      {ALIGN_OPTIONS.map((align) => {
                        const isSelected = editingState.textAlign === align.id;
                        return (
                          <TouchableOpacity
                            key={align.id}
                            onPress={() =>
                              updateGlobalEditState({ textAlign: align.id })
                            }
                            style={[
                              styles.alignChip,
                              isSelected && styles.alignChipSelected,
                            ]}
                            accessibilityLabel={align.label}
                          >
                            {isSelected && (
                              <View style={styles.fontChipCheckBadge}>
                                <Ionicons
                                  name="checkmark"
                                  size={10}
                                  color={COLORS.white}
                                />
                              </View>
                            )}
                            <MaterialCommunityIcons
                              name={align.icon}
                              size={18}
                              color={isSelected ? COLORS.accent : COLORS.gray500}
                            />
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                {sheetTab === 'style' && (
                  <View style={{ marginTop: 18 }}>
                    {/* 편집 대상 라디오 — 시간/장소를 하나만 보여줄 땐 고를 게
                        없어서 숨깁니다. 프리뷰의 텍스트를 직접 탭해도 바뀝니다. */}
                    {showTimeStyle && showPlaceStyle && (
                      <View style={styles.styleTargetRadioRow}>
                        {(
                          [
                            { id: 'time' as const, label: '시간' },
                            { id: 'place' as const, label: '장소' },
                          ]
                        ).map((option) => {
                          const isSelected = styleTarget === option.id;
                          return (
                            <TouchableOpacity
                              key={option.id}
                              style={styles.styleTargetRadioOption}
                              onPress={() => setStyleTarget(option.id)}
                            >
                              <View
                                style={[
                                  styles.styleTargetRadioCircle,
                                  isSelected &&
                                    styles.styleTargetRadioCircleSelected,
                                ]}
                              >
                                {isSelected && (
                                  <View style={styles.styleTargetRadioDot} />
                                )}
                              </View>
                              <Text
                                allowFontScaling={false}
                                style={[
                                  styles.styleTargetRadioLabel,
                                  isSelected &&
                                    styles.styleTargetRadioLabelSelected,
                                ]}
                              >
                                {option.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}

                    <Text
                      allowFontScaling={false}
                      style={styles.sheetSectionLabel}
                    >
                      글꼴 선택
                    </Text>
                    <View style={styles.fontSelectRow}>
                      <TouchableOpacity
                        hitSlop={8}
                        onPress={() =>
                          updateTextElementStyle(effectiveStyleTarget, {
                            bold: !currentTextStyle.bold,
                          })
                        }
                        style={[
                          styles.boldToggleButton,
                          currentTextStyle.bold && styles.boldToggleButtonActive,
                        ]}
                      >
                        <Text
                          allowFontScaling={false}
                          style={[
                            styles.boldToggleButtonText,
                            currentTextStyle.bold &&
                              styles.boldToggleButtonTextActive,
                          ]}
                        >
                          B
                        </Text>
                      </TouchableOpacity>
                      {/* 폰트가 늘어나도 볼드 버튼은 고정, 칩들만 가로 스크롤 */}
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.fontChipRow}
                      >
                        {FONT_OPTIONS.map((font) => {
                          const isSelected =
                            currentTextStyle.fontId === font.id;
                          return (
                            <TouchableOpacity
                              key={font.id}
                              onPress={() =>
                                updateTextElementStyle(effectiveStyleTarget, {
                                  fontId: font.id,
                                })
                              }
                              style={[
                                styles.fontChip,
                                isSelected && styles.fontChipSelected,
                              ]}
                            >
                              {isSelected && (
                                <View style={styles.fontChipCheckBadge}>
                                  <Ionicons
                                    name="checkmark"
                                    size={10}
                                    color={COLORS.white}
                                  />
                                </View>
                              )}
                              <Text
                                allowFontScaling={false}
                                style={[
                                  styles.fontChipText,
                                  {
                                    fontFamily: getFontFamily(
                                      font.id,
                                      currentTextStyle.bold,
                                    ),
                                  },
                                  isSelected && styles.fontChipTextSelected,
                                ]}
                              >
                                {font.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>

                    <Text
                      allowFontScaling={false}
                      style={[styles.sheetSectionLabel, { marginTop: 20 }]}
                    >
                      색상
                    </Text>
                    <View style={styles.colorSwatchRow}>
                      {TEXT_COLOR_OPTIONS.map((color) => {
                        const isSelected = currentTextStyle.color === color;
                        return (
                          <TouchableOpacity
                            key={color}
                            onPress={() =>
                              updateTextElementStyle(effectiveStyleTarget, {
                                color,
                              })
                            }
                            style={[
                              styles.colorSwatch,
                              { backgroundColor: color },
                              isSelected && styles.colorSwatchSelected,
                            ]}
                          />
                        );
                      })}
                    </View>

                    <Text
                      allowFontScaling={false}
                      style={[styles.sheetSectionLabel, { marginTop: 20 }]}
                    >
                      크기
                    </Text>
                    <View style={styles.sizeStepperRow}>
                      <TouchableOpacity
                        style={styles.sizeStepButton}
                        onPress={() =>
                          updateTextElementStyle(effectiveStyleTarget, {
                            fontSize: clampFontSize(
                              currentTextStyle.fontSize - 1,
                            ),
                          })
                        }
                      >
                        <Ionicons name="remove" size={16} color={COLORS.black} />
                      </TouchableOpacity>
                      <Text
                        allowFontScaling={false}
                        style={styles.sizeValueText}
                      >
                        {currentTextStyle.fontSize}px
                      </Text>
                      <TouchableOpacity
                        style={styles.sizeStepButton}
                        onPress={() =>
                          updateTextElementStyle(effectiveStyleTarget, {
                            fontSize: clampFontSize(
                              currentTextStyle.fontSize + 1,
                            ),
                          })
                        }
                      >
                        <Ionicons name="add" size={16} color={COLORS.black} />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
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
                          updateGlobalEditState({ textPosition: positionId })
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
              </ScrollView>

              {isSheetScrollable && (
                <View style={styles.sheetScrollTrack} pointerEvents="none">
                  <Animated.View
                    style={[
                      styles.sheetScrollThumb,
                      {
                        height: sheetScrollThumbHeight,
                        transform: [{ translateY: sheetScrollThumbTranslateY }],
                      },
                    ]}
                  />
                </View>
              )}
            </View>
          </Animated.View>
        </>
      )}
      {isExporting && (
        <View style={styles.exportingOverlay} pointerEvents='auto'>
          <View style={styles.exportingBox}>
            <ActivityIndicator size="large" color={COLORS.accent} />
            <Text allowFontScaling={false} style={styles.exportingTitle}>
              영상을 만드는 중...
            </Text>
            <Text allowFontScaling={false} style={styles.exportingSubtitle}>
              잠시만 기다려주세요
            </Text>
          </View>
        </View>
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
  // 프리뷰의 시간/장소 텍스트를 감싸는 탭 영역. 지금 스타일 편집 중인
  // 요소는 점선 테두리로 표시해서 어떤 걸 만지고 있는지 알 수 있게 합니다.
  previewTextTapTarget: {
    borderRadius: 4,
    padding: 2,
  },
  previewTextTapTargetActive: {
    borderRadius: 4,
    padding: 2,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.accent,
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

  // 백드롭 + 바텀시트 (Text/Position)
  // 뒷배경을 반투명하게 덮지 않고, 시트 바깥을 탭하면 닫히는 투명한 탭 영역으로만 씁니다.
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  // 배경(backgroundIvory)과 시트 색이 같아서, 테두리+그림자로 경계를 만듭니다.
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.background, // backgroundIvory
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 6,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  // 시트 높이가 고정이라(프리뷰 하단에 맞춤) 안의 내용이 넘칠 수 있어
  // 스크롤 가능하게 감쌉니다. 헤더(제목+완료 버튼)는 이 밖에 있어서 안 움직여요.
  sheetScrollWrapper: {
    flex: 1,
    flexDirection: 'row',
  },
  sheetScroll: {
    flex: 1,
  },
  sheetScrollContent: {
    paddingBottom: 12,
    paddingRight: 10,
  },
  // 오른쪽에 떠 있는 커스텀 스크롤 바 — 네이티브 스크롤바는 색/두께를 바꿀 수
  // 없어서 직접 그렸습니다. 스크롤할 내용이 있을 때만(isSheetScrollable) 보여요.
  sheetScrollTrack: {
    width: 3,
    marginLeft: 4,
    borderRadius: 2,
  },
  sheetScrollThumb: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    borderRadius: 2,
    backgroundColor: COLORS.gray200, // 프리뷰 박스(previewWrapper)와 같은 색
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
  // 볼드 버튼(고정)과 글꼴 칩 가로 스크롤을 한 줄에 배치
  fontSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  boldToggleButton: {
    width: 34,
    height: 34,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  boldToggleButtonActive: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.primarySoft,
  },
  boldToggleButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.black,
  },
  boldToggleButtonTextActive: {
    color: COLORS.accent,
  },

  // "표시 / 스타일" 서브탭 — 알약 모양 세그먼트 컨트롤
  sheetTabRow: {
    flexDirection: 'row',
    alignSelf: 'center',
    width: '90%',
    backgroundColor: COLORS.gray200,
    borderRadius: 10,
    padding: 3,
    gap: 3,
  },
  sheetTabButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  sheetTabButtonActive: {
    backgroundColor: COLORS.background,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  sheetTabButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.gray500,
  },
  sheetTabButtonTextActive: {
    color: COLORS.black,
  },

  // 지금 스타일 편집 중인 대상(시간/장소) 안내 배지 — 탭이 아니라 정보 표시용.
  // 실제 대상 변경은 프리뷰의 텍스트를 직접 탭해서 합니다.
  // 시간/장소 중 지금 스타일 편집 대상을 고르는 라디오 버튼.
  styleTargetRadioRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 18,
  },
  styleTargetRadioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  styleTargetRadioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: COLORS.gray500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  styleTargetRadioCircleSelected: {
    borderColor: COLORS.accent,
  },
  styleTargetRadioDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: COLORS.accent,
  },
  styleTargetRadioLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.gray500,
  },
  styleTargetRadioLabelSelected: {
    color: COLORS.black,
  },

  colorSwatchRow: {
    flexDirection: 'row',
    gap: 10,
  },
  colorSwatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: COLORS.divider,
  },
  colorSwatchSelected: {
    borderColor: COLORS.accent,
  },

  sizeStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  sizeStepButton: {
    width: 32,
    height: 32,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: COLORS.divider,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sizeValueText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.black,
    minWidth: 40,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },

  infoChipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  infoChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 9, 
    backgroundColor: COLORS.background, // 바텀시트와 같은 색
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  infoChipSelected: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.accent,
  },
  infoChipText: {
    fontSize: 13,
    color: COLORS.gray500,
  },
  infoChipTextSelected: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.accent,
  },

  alignChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  // 글꼴 칩과 같은 테두리/선택 스타일이지만, 텍스트 대신 아이콘 하나만 담는
  // 정사각형에 가까운 버튼이라 크기를 따로 둡니다.
  alignChip: {
    width: 44,
    height: 40,
    borderRadius: 9,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.divider,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative', // 체크 배지 위치 기준
  },
  alignChipSelected: {
    borderColor: COLORS.accent,
  },
  fontChipRow: {
    flexDirection: 'row',
    gap: 8,
    // 체크 배지가 칩 위/오른쪽으로 살짝 튀어나오는 만큼(top/right: -6) 여백을 줘서
    // 가로 스크롤뷰 안에서 잘리지 않게 함
    paddingTop: 6,
    paddingRight: 10,
  },
  fontChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 9, // 프리뷰 박스와 같은 둥근 정도
    backgroundColor: COLORS.background, // 바텀시트와 같은 색
    borderWidth: 1,
    borderColor: COLORS.divider,
    position: 'relative', // 체크 배지 위치 기준
  },
  fontChipSelected: {
    borderColor: COLORS.accent,
  },
  fontChipCheckBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accent,
  },
  fontChipText: {
    fontSize: 13,
    color: COLORS.gray500,
  },
  fontChipTextSelected: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.black,
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

  exportingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  exportingBox: {
    paddingHorizontal: 40,
    paddingVertical: 32,
    borderRadius: 16,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    gap: 14,
    minWidth: 240,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  exportingTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.black,
  },
  exportingSubtitle: {
    fontSize: 12,
    color: COLORS.gray500,
  },
});
