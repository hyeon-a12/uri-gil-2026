import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
  type CameraType,
} from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { AppText as Text } from '@/components/AppText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { navigateToLocationConfirm } from '@/navigation/recordingNavigation';
import { useTripStore } from '@/store/useTripStore';
import { type ShootingStyleId } from '@/services/folderService';
import CameraChangeIcon from '@/assets/images/camera_change.svg';
import { getAllFolders } from '@/services/folderService';

const MAX_CLIPS = 15;
const DEFAULT_CLIP_SECONDS = 10;
const MIN_CLIP_SECONDS = 5;
const MAX_CLIP_SECONDS_CAP = 10;

// 게이지(그리드 스타일 진행률 배지)에서 "여기서 0.5x로 바꾸세요" 타이밍 비율.
const ZOOM_SWITCH_RATIO = 0.5;

// 셔터 버튼(styles.shutterButton)과 같은 값으로 유지해야 합니다. 버튼이 정사각형이
// 아니라서(90×77), 진행률 링은 더 작은 쪽인 높이에 맞춰 원형을 유지하고 버튼 안에서
// 가로로만 중앙 정렬합니다 — 이전엔 링이 90×90으로 하드코딩돼 있어서 버튼 높이가
// 줄어들 때마다 링 중심이 안쪽 원(흰 동그라미)과 어긋났었습니다.
const SHUTTER_BUTTON_WIDTH = 90;
const SHUTTER_BUTTON_HEIGHT = 70;
const SHUTTER_RING_STROKE = 3.75;
const SHUTTER_RING_SIZE = SHUTTER_BUTTON_HEIGHT;
const SHUTTER_RING_CENTER = SHUTTER_RING_SIZE / 2;
const SHUTTER_RING_RADIUS = SHUTTER_RING_CENTER - SHUTTER_RING_STROKE;
const SHUTTER_RING_OFFSET_X = (SHUTTER_BUTTON_WIDTH - SHUTTER_RING_SIZE) / 2;
const SHUTTER_RING_CIRCUMFERENCE = 2 * Math.PI * SHUTTER_RING_RADIUS;

const COLORS = {
  accent: '#FF7F5C',
  white: '#FFFFFF',
  black: '#222222',
  gridLine: 'rgba(255,255,255,0.45)',
  ring: 'rgba(255,255,255,0.4)',
  pillBg: 'var(--placeholder)', // 아래 실제 스타일에서 rgba로 대체
  textSecondary: '#8A8A8A',
};

// 0.5×는 selectedLens로 초광각 렌즈("Back Ultra Wide Camera")로 물리적으로
// 전환해서 처리합니다(아래 selectedLens 계산 참고) — 이건 정상 동작 확인됨.
//
// 1×는 초광각이 아닌 "Back Camera"(광각 렌즈)를 쓰지만, iOS 네이티브 코드
// (CameraSessionManager.swift)가 zoom prop을 선형이 아니라
//   videoZoomFactor = pow(device.activeFormat.videoMaxZoomFactor, zoom)
// 로 지수적으로 매핑해서 zoom=0이 항상 정확한 1배(pow(x,0)=1)여야 하는데도
// 실기기에서는 확대돼 보였습니다. 그래서 zoom=0 대신, 실기기에서 눈으로
// 확인해 실제 1배로 보이는 값을 그대로 씁니다. 더/덜 당겨지면 이 값을 조정하세요.
const IOS_ONE_X_ZOOM_VALUE = 0.0005;

// 안드로이드는 expo-camera에 렌즈 선택 API 자체가 없고(ExpoCameraView.kt),
// zoom 값도 항상 max(1f, ...)로 1배 밑으로 못 내려가게 고정돼 있어서 0.5×를
// 구현할 방법이 없습니다. 그래서 0.5× pill은 iOS에서만 보여줍니다.
const ZOOM_LEVELS =
  Platform.OS === 'ios'
    ? ([
        { label: '0.5×', value: 0 },
        { label: '1×', value: IOS_ONE_X_ZOOM_VALUE },
      ] as const)
    : ([{ label: '1×', value: 0 }] as const);

interface PermissionScreenProps {
  loading?: boolean;
  title?: string;
  description?: string;
  buttonLabel?: string;
  onPress?: () => void;
  iconName?: React.ComponentProps<typeof Ionicons>['name'];
}

function PermissionScreen({
  loading = false,
  title,
  description,
  buttonLabel,
  onPress,
  iconName = 'camera-outline',
}: PermissionScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.permissionScreen,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="large" color={COLORS.accent} />
      ) : (
        <>
          <View style={styles.permissionIconContainer}>
            <Ionicons name={iconName} size={34} color={COLORS.accent} />
          </View>
          <Text allowFontScaling={false} style={styles.permissionTitle}>
            {title}
          </Text>
          <Text allowFontScaling={false} style={styles.permissionDescription}>
            {description}
          </Text>
          {buttonLabel && onPress ? (
            <Pressable
              onPress={onPress}
              style={({ pressed }) => [
                styles.permissionButton,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text
                allowFontScaling={false}
                style={styles.permissionButtonText}
              >
                {buttonLabel}
              </Text>
            </Pressable>
          ) : null}
        </>
      )}
    </View>
  );
}

/** 3분할 구도 보조선. 촬영 스타일과 무관하게 항상 켜져 있는 일반적인
 * 카메라 구도 가이드예요("그리드 선택" 촬영 스타일과는 다른 개념입니다 —
 * 그건 여러 클립을 분할 화면으로 합치는 편집 포맷이고, 이건 그냥 눈금선). */
function CompositionGrid() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      <View style={[styles.gridLineVertical, { left: '33.333%' }]} />
      <View style={[styles.gridLineVertical, { left: '66.666%' }]} />
      <View style={[styles.gridLineHorizontal, { top: '33.333%' }]} />
      <View style={[styles.gridLineHorizontal, { top: '66.666%' }]} />
    </View>
  );
}

/** 화면 중앙 스타일 가이드 자리 (그리드 제외 — 인형/사람 스타일용).
 * 지금은 기본 스타일만 있어서 비어있고, 나중에 여기 분기를 추가하면 돼요. */
function CenterGuide({ shootingStyle }: { shootingStyle: ShootingStyleId }) {
  return null;
}

export default function CameraScreen() {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);

  const currentTrip = useTripStore((state) => state.currentTrip);
  const shootingStyle: ShootingStyleId = currentTrip?.shootingStyle ?? 'basic';

  const rawMaxClipSeconds =
    currentTrip?.clipLengthSeconds && currentTrip.clipLengthSeconds > 0
      ? currentTrip.clipLengthSeconds
      : DEFAULT_CLIP_SECONDS;
  const maxClipSeconds = Math.min(
    Math.max(rawMaxClipSeconds, MIN_CLIP_SECONDS),
    MAX_CLIP_SECONDS_CAP,
  );

  const [cameraPermission, requestCameraPermission] =
    useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] =
    useMicrophonePermissions();

  const [facing, setFacing] = useState<CameraType>('back');
  const [zoomIndex, setZoomIndex] = useState(ZOOM_LEVELS.length - 1); // 기본 1x (배열의 마지막 항목)
  const [clipCount, setClipCount] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [availableLenses, setAvailableLenses] = useState<string[]>([]);

  const permissionsReady =
    cameraPermission?.granted === true &&
    microphonePermission?.granted === true;

  const canRecord = clipCount < MAX_CLIPS && permissionsReady;
  const progress = Math.min(elapsedSeconds / maxClipSeconds, 1);

  // getAvailableLensesAsync()가 돌려주는 건 표시용 이름(localizedName)이라
  // 정확한 문자열을 미리 알 수 없습니다 — 키워드로 찾습니다. "wide" 계열 렌즈는
  // ultra/tele/dual/triple/depth가 이름에 안 들어간 것으로 골라서, 여러 렌즈를
  // 합친 가상 기기가 아니라 순수 광각 렌즈 하나만 쓰도록 합니다.
  const ultrawideLensName = availableLenses.find((name) =>
    name.toLowerCase().includes('ultra'),
  );
  const wideLensName = availableLenses.find((name) => {
    const lower = name.toLowerCase();
    return (
      !lower.includes('ultra') &&
      !lower.includes('tele') &&
      !lower.includes('dual') &&
      !lower.includes('triple') &&
      !lower.includes('depth') &&
      !lower.includes('lidar')
    );
  });

  // 0.5×는 초광각 렌즈를 찾으면 그쪽으로, 못 찾으면(매칭 실패) 그냥 광각 렌즈로
  // 폴백합니다(그러면 1×와 똑같이 보이는 게 지금 상태라는 뜻이라, 아래 console.log로
  // 남긴 실제 렌즈 이름 목록을 확인해서 매칭 키워드를 다시 잡아야 해요).
  const selectedLens =
    zoomIndex === 0 ? ultrawideLensName ?? wideLensName : wideLensName;

  // 렌즈 지원 여부는 iOS에서만 조회 가능합니다(expo-camera 제약). 카메라가
  // 마운트된 뒤에 물어봐야 해서 permissionsReady가 true가 된 다음에 시도합니다.
  useEffect(() => {
    if (Platform.OS !== 'ios' || !permissionsReady) return;

    let cancelled = false;
    (async () => {
      try {
        const lenses = await cameraRef.current?.getAvailableLensesAsync();
        if (!cancelled && lenses) {
          setAvailableLenses(lenses);
          // 기기/로케일마다 표시 이름이 달라서, wideLensName 키워드 매칭이
          // 안 맞으면 이 로그를 보고 위 필터 키워드를 조정하세요.
          console.log('[Camera] 사용 가능한 렌즈 목록:', lenses);
        }
      } catch (error) {
        console.warn('[Camera] 사용 가능한 렌즈 조회 실패:', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [permissionsReady]);

  useEffect(() => {
    if (!isRecording) return;

    const interval = setInterval(() => {
      setElapsedSeconds((s) => (s >= maxClipSeconds ? maxClipSeconds : s + 1));
    }, 1000);

    const markerTimeout = setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }, ZOOM_SWITCH_RATIO * maxClipSeconds * 1000);

    return () => {
      clearInterval(interval);
      clearTimeout(markerTimeout);
    };
  }, [isRecording, maxClipSeconds]);

  const requestPermissions = async () => {
    const cameraResult = await requestCameraPermission();
    if (!cameraResult.granted) return;
    await requestMicrophonePermission();
  };

  const toggleFacing = () => {
    if (isRecording) return;
    setFacing((f) => (f === 'back' ? 'front' : 'back'));
  };

  const toggleFlash = () => {
    setFlashEnabled((f) => !f);
  };

  const handleClose = () => {
    if (isRecording) cameraRef.current?.stopRecording();
    router.back();
  };

  const handleRecordPress = async () => {
    if (isRecording) return; // 자동 정지 방식이라 탭으로 중지 불가

    if (hasFolders === false) {
      Alert.alert(
        '저장할 여행이 없습니다.',
        '클립 관리에서 여행을 생성하세요.',
      );
      return;
    }

    if (!cameraRef.current || !canRecord) {
      if (clipCount >= MAX_CLIPS) {
        Alert.alert(
          '촬영 가능한 클립 수를 초과했습니다',
          `한 여행에서는 최대 ${MAX_CLIPS}개의 클립을 촬영할 수 있어요.`,
        );
      }
      return;
    }

    setIsRecording(true);
    setElapsedSeconds(0);

    const startedAt = Date.now();

    try {
      const video = await cameraRef.current.recordAsync({
        maxDuration: maxClipSeconds,
      });
      if (!video?.uri) {
        throw new Error('촬영된 영상 경로를 확인할 수 없습니다.');
      }

      const durationMs = Date.now() - startedAt;

      setClipCount((currentCount) =>
        Math.min(currentCount + 1, MAX_CLIPS),
      );

      navigateToLocationConfirm(video.uri, undefined, durationMs);
    } catch (error) {
      console.error('Video recording failed:', error);
      Alert.alert('촬영에 실패했습니다', '잠시 후 다시 촬영해주세요.');
    } finally {
      setIsRecording(false);
      setElapsedSeconds(0);
    }
  };

  if (Platform.OS === 'web') {
    return (
      <PermissionScreen
        iconName="phone-portrait-outline"
        title="실제 기기에서 카메라를 확인해주세요"
        description={
          '웹 브라우저에서는 앱 카메라 기능이 제한될 수 있어요.\nExpo Go에서 QR 코드를 스캔해 확인해주세요.'
        }
        buttonLabel="이전 화면으로"
        onPress={() => router.back()}
      />
    );
  }

  if (!cameraPermission || !microphonePermission) {
    return <PermissionScreen loading />;
  }

  if (!permissionsReady) {
    return (
      <PermissionScreen
        title="카메라 권한이 필요해요"
        description={
          '여행 클립을 촬영하려면 카메라와 마이크 접근 권한을 허용해주세요.'
        }
        buttonLabel="권한 허용하기"
        onPress={requestPermissions}
      />
    );
  }

  return (
    <View style={styles.screen}>
      {/* 카메라 프리뷰 — 둥근 모서리 사각형 안, 녹화 영상과 같은 16:9 비율로 고정.
          previewArea가 상단 안전영역 아래 남는 공간 전체를 차지하고, 그 안에서
          previewWrapper를 수직 중앙 정렬합니다. */}
      <View style={[styles.previewArea, { paddingTop: insets.top + 8 }]}>
        <View style={styles.previewWrapper}>
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing={facing}
            mode="video"
            zoom={ZOOM_LEVELS[zoomIndex].value}
            videoQuality="720p"
            enableTorch={flashEnabled}
            selectedLens={selectedLens}
          />

          <CompositionGrid />

          <View pointerEvents="none" style={styles.guideArea}>
            <CenterGuide shootingStyle={shootingStyle} />
          </View>

          <Pressable
            hitSlop={16}
            onPress={handleClose}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={22} color={COLORS.white} />
          </Pressable>
        </View>
      </View>

      {/* 플래시(왼쪽) + 줌 선택(중앙 정렬) + 카메라 전환(오른쪽) — 셋 다 같은 높이.
          화면 자체는 녹화 중에도 안 바뀌도록 숨기지 않고 그대로 두지만, 줌 pill은
          녹화 중엔 눌러도 무시됩니다 — 0.5×↔1× 전환이 selectedLens로 실제 렌즈를
          바꾸는 방식이라, 녹화 중에 렌즈를 바꾸면 캡처 세션이 재구성되면서 진행 중이던
          녹화가 그대로 끊겨버립니다(expo-camera의 구조적 한계). 카메라 전환도 같은
          이유로 toggleFacing 안에서 녹화 중엔 무시됩니다. */}
      <View style={styles.zoomRow}>
        <View style={styles.zoomRowSide}>
          <Pressable hitSlop={12} onPress={toggleFlash}>
            <Ionicons
              name={flashEnabled ? 'flash' : 'flash-outline'}
              size={22}
              color={COLORS.black}
            />
          </Pressable>
        </View>

        <View style={styles.zoomPillGroup}>
          {ZOOM_LEVELS.map((level, index) => {
            const selected = zoomIndex === index;
            return (
              <Pressable
                key={level.label}
                disabled={isRecording}
                onPress={() => setZoomIndex(index)}
                style={[
                  styles.zoomPill,
                  selected && styles.zoomPillSelected,
                  isRecording && styles.zoomPillDisabled,
                ]}
              >
                <Text
                  allowFontScaling={false}
                  style={[
                    styles.zoomPillText,
                    selected && styles.zoomPillTextSelected,
                  ]}
                >
                  {level.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.zoomRowSide, styles.zoomRowSideRight]}>
          <Pressable hitSlop={12} onPress={toggleFacing}>
            <CameraChangeIcon width={22} height={22} fill={COLORS.black} />
          </Pressable>
        </View>
      </View>

      {/* 셔터 버튼 */}
      <View
        style={[styles.bottomRow, { paddingBottom: insets.bottom || 20 }]}
      >
        <Pressable
          disabled={!canRecord || isRecording}
          onPress={handleRecordPress}
          style={({ pressed }) => [
            styles.shutterButton,
            pressed && { opacity: 0.85 },
            (!canRecord || isRecording) && { opacity: isRecording ? 1 : 0.4 },
          ]}
        >
          <Svg
            width={SHUTTER_RING_SIZE}
            height={SHUTTER_RING_SIZE}
            style={{ position: 'absolute', top: 0, left: SHUTTER_RING_OFFSET_X }}
          >
            <Circle
              cx={SHUTTER_RING_CENTER}
              cy={SHUTTER_RING_CENTER}
              r={SHUTTER_RING_RADIUS}
              stroke={COLORS.ring}
              strokeWidth={SHUTTER_RING_STROKE}
              fill="none"
            />
            {isRecording && (
              <Circle
                cx={SHUTTER_RING_CENTER}
                cy={SHUTTER_RING_CENTER}
                r={SHUTTER_RING_RADIUS}
                stroke={COLORS.accent}
                strokeWidth={SHUTTER_RING_STROKE}
                fill="none"
                strokeDasharray={`${SHUTTER_RING_CIRCUMFERENCE} ${SHUTTER_RING_CIRCUMFERENCE}`}
                strokeDashoffset={SHUTTER_RING_CIRCUMFERENCE * (1 - progress)}
                strokeLinecap="round"
                rotation={-90}
                origin={`${SHUTTER_RING_CENTER}, ${SHUTTER_RING_CENTER}`}
              />
            )}
          </Svg>
          <View
            style={
              isRecording ? styles.shutterInnerRecording : styles.shutterInner
            }
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FAF8F1',
  },

  // 상단 안전영역 아래 남는 공간 전체를 차지하면서, 그 안에서 previewWrapper를
  // 수직으로 가운데 정렬합니다.
  previewArea: {
    flex: 1,
    justifyContent: 'center',
  },
  previewWrapper: {
    aspectRatio: 9 / 16, // 녹화 영상(videoQuality="720p" → 1280×720, 16:9)과 프리뷰 비율을 맞춤
    marginHorizontal: 10,
    borderRadius: 24,
    backgroundColor: '#000000',
    position: 'relative',
    overflow: 'hidden',
  },
  closeButton: {
    position: 'absolute',
    top: 14,
    left: 14,
  },

  gridLineVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth * 2,
    backgroundColor: COLORS.gridLine,
  },
  gridLineHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: COLORS.gridLine,
  },

  guideArea: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 카메라 화면 쪽 간격(paddingTop)은 1.3배로 늘리고, 셔터 버튼 쪽 간격
  // (paddingBottom)은 이전에 맞춰둔 대로 좁게 유지합니다.
  zoomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 26,
    paddingBottom: 4,
  },
  // 줌 배율 pill 그룹을 화면 중앙에 두기 위한 좌우 spacer. 오른쪽 spacer 안에만
  // 카메라 전환 버튼을 넣어서, pill 그룹 자체는 정확히 중앙 정렬되게 합니다.
  zoomRowSide: {
    flex: 1,
  },
  zoomRowSideRight: {
    alignItems: 'flex-end',
  },
  zoomPillGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  zoomPill: {
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 20,
  },
  zoomPillSelected: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#EDEAE2',
  },
  zoomPillDisabled: {
    opacity: 0.4,
  },
  zoomPillText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  zoomPillTextSelected: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.black,
  },

  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingTop: 0,
  },
  // width/height는 위쪽 SHUTTER_BUTTON_WIDTH/HEIGHT 상수와 반드시 같은 값을
  // 유지해야 진행률 링이 버튼 중앙에 정확히 맞습니다.
  shutterButton: {
    width: SHUTTER_BUTTON_WIDTH,
    height: SHUTTER_BUTTON_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 3.5,
    borderColor: '#EDEAE2',
    backgroundColor: COLORS.white,
  },
  shutterInnerRecording: {
    width: 32.5,
    height: 32.5,
    borderRadius: 7.5,
    backgroundColor: COLORS.accent,
  },

  permissionScreen: {
    flex: 1,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAF8F1',
  },
  permissionIconContainer: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF3DF',
  },
  permissionTitle: {
    marginTop: 24,
    color: COLORS.black,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  permissionDescription: {
    marginTop: 10,
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
  permissionButton: {
    minWidth: 168,
    height: 50,
    marginTop: 30,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 25,
    backgroundColor: COLORS.accent,
  },
  permissionButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
});
