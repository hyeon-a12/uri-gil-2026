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
import { AppText as Text } from '@/components/AppText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { navigateToLocationConfirm } from '@/navigation/recordingNavigation';
import { getAllFolders } from '@/services/folderService';

const MAX_CLIP_SECONDS = 10;
const MAX_CLIPS = 15;

const COLORS = {
  background: '#FFFFFF',
  white: '#FFFFFF',
  primary: '#FFB134',
  primaryDark: '#EA861F',
  primarySoft: '#FFF3DF',

  textPrimary: '#222222',
  textSecondary: '#8A8A8A',

  overlay: 'rgba(18, 18, 16, 0.48)',
  overlayStrong: 'rgba(18, 18, 16, 0.68)',
  overlayLight: 'rgba(255, 255, 255, 0.18)',

  recording: '#FF4D4F',
  recordingSoft: 'rgba(255, 77, 79, 0.22)',

  border: 'rgba(255, 255, 255, 0.42)',
};

const ZOOM_LEVELS = [
  {
    label: '0.5x',
    value: 0,
  },
  {
    label: '1x',
    value: 0,
  },
  {
    label: '2x',
    value: 0.45,
  },
  {
    label: '3x',
    value: 0.72,
  },
] as const;

function formatTimer(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(
    remainingSeconds,
  ).padStart(2, '0')}`;
}

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
        {
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
        />
      ) : (
        <>
          <View style={styles.permissionIconContainer}>
            <Ionicons
              name={iconName}
              size={34}
              color={COLORS.primary}
            />
          </View>

          <Text
            allowFontScaling={false}
            style={styles.permissionTitle}
          >
            {title}
          </Text>

          <Text
            allowFontScaling={false}
            style={styles.permissionDescription}
          >
            {description}
          </Text>

          {buttonLabel && onPress ? (
            <Pressable
              onPress={onPress}
              style={({ pressed }) => [
                styles.permissionButton,
                pressed && styles.permissionButtonPressed,
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

/**
 * 여행 클립 촬영 화면
 *
 * - 최대 10초 영상 촬영
 * - 최대 15개 클립 촬영
 * - 전·후면 카메라 변경
 * - 줌 배율 선택
 * - 촬영 완료 후 장소 확인 화면으로 이동
 */
export default function CameraScreen() {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);

  const [
    cameraPermission,
    requestCameraPermission,
  ] = useCameraPermissions();

  const [
    microphonePermission,
    requestMicrophonePermission,
  ] = useMicrophonePermissions();

  const [facing, setFacing] =
    useState<CameraType>('back');

  const [zoomIndex, setZoomIndex] = useState(1);

  const [clipCount, setClipCount] = useState(0);

  const [isRecording, setIsRecording] =
    useState(false);

  const [elapsedSeconds, setElapsedSeconds] =
    useState(0);

  const permissionsReady =
    cameraPermission?.granted === true &&
    microphonePermission?.granted === true;

  const progress = Math.min(
    elapsedSeconds / MAX_CLIP_SECONDS,
    1,
  );

  const [hasFolders, setHasFolders] = useState<boolean | null>(null);
  const canRecord = clipCount < MAX_CLIPS && permissionsReady && hasFolders === true;

  useEffect(() => {
    (async () => {
      try {
        const folders = await getAllFolders();
        setHasFolders(folders.length > 0);

        if (folders.length === 0) {
          Alert.alert(
            '저장할 여행이 없습니다.',
            '클립 관리에서 여행을 생성하세요.',
            [
              {
                text: '클립 관리로 이동',
                onPress: () => router.replace('/clip-manage'),
              },
              {
                text: '취소',
                style: 'cancel',
                onPress: () => router.back(),
              },
            ],
            { cancelable: false },
          );
        }
      } catch (error) {
        console.error('[CameraScreen] 폴더 조회 실패:', error);
        setHasFolders(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!isRecording) {
      return;
    }

    const interval = setInterval(() => {
      setElapsedSeconds((currentSeconds) => {
        if (currentSeconds >= MAX_CLIP_SECONDS) {
          return MAX_CLIP_SECONDS;
        }

        return currentSeconds + 1;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [isRecording]);

  const requestPermissions = async () => {
    const cameraResult =
      await requestCameraPermission();

    if (!cameraResult.granted) {
      return;
    }

    await requestMicrophonePermission();
  };

  const toggleFacing = () => {
    if (isRecording) {
      return;
    }

    setFacing((currentFacing) =>
      currentFacing === 'back'
        ? 'front'
        : 'back',
    );
  };

  const handleClose = () => {
    if (isRecording) {
      cameraRef.current?.stopRecording();
    }

    router.back();
  };

  const handleRecordPress = async () => {
    if (isRecording) {
      cameraRef.current?.stopRecording();
      return;
    }

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
      const video =
        await cameraRef.current.recordAsync({
          maxDuration: MAX_CLIP_SECONDS,
        });

      if (!video?.uri) {
        throw new Error(
          '촬영된 영상 경로를 확인할 수 없습니다.',
        );
      }

      const durationMs = Date.now() - startedAt;

      setClipCount((currentCount) =>
        Math.min(currentCount + 1, MAX_CLIPS),
      );

      navigateToLocationConfirm(video.uri, undefined, durationMs);
    } catch (error) {
      console.error(
        'Video recording failed:',
        error,
      );

      Alert.alert(
        '촬영에 실패했습니다',
        '잠시 후 다시 촬영해주세요.',
      );
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

  if (
    !cameraPermission ||
    !microphonePermission
  ) {
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
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        mode="video"
        zoom={ZOOM_LEVELS[zoomIndex].value}
        videoQuality="720p"
      />

      <View
        pointerEvents="none"
        style={styles.cameraDim}
      />

      {isRecording ? (
        <View
          pointerEvents="none"
          style={styles.recordingBorder}
        />
      ) : null}

      {/* 상단 영역 */}
      <View
        style={[
          styles.topBar,
          {
            top: insets.top + 12,
            left: insets.left + 16,
            right: insets.right + 16,
          },
        ]}
      >
        <Pressable
          hitSlop={10}
          onPress={handleClose}
          style={({ pressed }) => [
            styles.circleControlButton,
            pressed &&
              styles.circleControlButtonPressed,
          ]}
        >
          <Ionicons
            name="close"
            size={24}
            color={COLORS.white}
          />
        </Pressable>

        <View style={styles.recordingStatusArea}>
          {isRecording ? (
            <View style={styles.recordingBadge}>
              <View style={styles.recordingDot} />

              <Text
                allowFontScaling={false}
                style={styles.recordingBadgeText}
              >
                촬영 중
              </Text>
            </View>
          ) : (
            <View style={styles.readyBadge}>
              <Ionicons
                name="videocam-outline"
                size={16}
                color={COLORS.white}
              />

              <Text
                allowFontScaling={false}
                style={styles.readyBadgeText}
              >
                최대 {MAX_CLIP_SECONDS}초
              </Text>
            </View>
          )}
        </View>

        <View style={styles.timerContainer}>
          <Text
            allowFontScaling={false}
            style={styles.timerText}
          >
            {formatTimer(elapsedSeconds)}
          </Text>
        </View>
      </View>

      {/* 중앙 촬영 가이드 */}
      {!isRecording ? (
        <View
          pointerEvents="none"
          style={styles.guideArea}
        >
          <View style={styles.guideFrame}>
            <View
              style={[
                styles.guideCorner,
                styles.guideCornerTopLeft,
              ]}
            />

            <View
              style={[
                styles.guideCorner,
                styles.guideCornerTopRight,
              ]}
            />

            <View
              style={[
                styles.guideCorner,
                styles.guideCornerBottomLeft,
              ]}
            />

            <View
              style={[
                styles.guideCorner,
                styles.guideCornerBottomRight,
              ]}
            />
          </View>

          <Text
            allowFontScaling={false}
            style={styles.guideText}
          >
            여행의 순간을 10초 안에 담아보세요
          </Text>
        </View>
      ) : null}

      {/* 줌 선택 */}
      <View
        style={[
          styles.zoomContainer,
          {
            bottom: insets.bottom + 152,
          },
        ]}
      >
        {ZOOM_LEVELS.map((level, index) => {
          const selected = zoomIndex === index;

          return (
            <Pressable
              key={`${level.label}-${index}`}
              disabled={isRecording}
              onPress={() => setZoomIndex(index)}
              style={({ pressed }) => [
                styles.zoomButton,
                selected && styles.zoomButtonSelected,
                pressed &&
                  !isRecording &&
                  styles.zoomButtonPressed,
                isRecording &&
                  styles.zoomButtonDisabled,
              ]}
            >
              <Text
                allowFontScaling={false}
                style={[
                  styles.zoomButtonText,
                  selected &&
                    styles.zoomButtonTextSelected,
                ]}
              >
                {level.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* 하단 촬영 컨트롤 */}
      <View
        style={[
          styles.bottomControls,
          {
            paddingBottom: Math.max(
              insets.bottom,
              16,
            ),
          },
        ]}
      >
        <View style={styles.bottomSideArea}>
          <View style={styles.clipCountBadge}>
            <Ionicons
              name="film-outline"
              size={17}
              color={COLORS.white}
            />

            <Text
              allowFontScaling={false}
              style={styles.clipCountText}
            >
              {clipCount}/{MAX_CLIPS}
            </Text>
          </View>
        </View>

        <View style={styles.recordArea}>
          <Pressable
            disabled={!canRecord}
            onPress={handleRecordPress}
            style={({ pressed }) => [
              styles.recordButtonOuter,
              pressed &&
                styles.recordButtonOuterPressed,
              !canRecord &&
                styles.recordButtonDisabled,
            ]}
          >
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${progress * 100}%`,
                  },
                ]}
              />
            </View>

            <View
              style={[
                styles.recordButtonInner,
                isRecording &&
                  styles.recordButtonInnerRecording,
              ]}
            />
          </Pressable>

          <Text
            allowFontScaling={false}
            style={styles.recordHelpText}
          >
            {isRecording
              ? '눌러서 촬영 종료'
              : '눌러서 촬영 시작'}
          </Text>
        </View>

        <View style={styles.bottomSideArea}>
          <Pressable
            disabled={isRecording}
            onPress={toggleFacing}
            style={({ pressed }) => [
              styles.flipButton,
              pressed &&
                !isRecording &&
                styles.flipButtonPressed,
              isRecording &&
                styles.flipButtonDisabled,
            ]}
          >
            <Ionicons
              name="camera-reverse-outline"
              size={26}
              color={COLORS.white}
            />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },

  cameraDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
  },

  recordingBorder: {
    ...StyleSheet.absoluteFillObject,

    borderWidth: 5,
    borderColor: COLORS.recording,
  },

  topBar: {
    position: 'absolute',

    height: 52,

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  circleControlButton: {
    width: 46,
    height: 46,

    borderRadius: 23,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: COLORS.overlayStrong,

    borderWidth: 1,
    borderColor: COLORS.border,
  },

  circleControlButtonPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.96 }],
  },

  recordingStatusArea: {
    flex: 1,

    alignItems: 'center',
    justifyContent: 'center',
  },

  recordingBadge: {
    height: 36,

    paddingHorizontal: 13,

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',

    gap: 7,

    borderRadius: 18,

    backgroundColor: COLORS.overlayStrong,

    borderWidth: 1,
    borderColor: COLORS.recordingSoft,
  },

  recordingDot: {
    width: 8,
    height: 8,

    borderRadius: 4,

    backgroundColor: COLORS.recording,
  },

  recordingBadgeText: {
    color: COLORS.white,

    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
  },

  readyBadge: {
    height: 36,

    paddingHorizontal: 13,

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',

    gap: 6,

    borderRadius: 18,

    backgroundColor: COLORS.overlay,

    borderWidth: 1,
    borderColor: COLORS.border,
  },

  readyBadgeText: {
    color: COLORS.white,

    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },

  timerContainer: {
    minWidth: 58,
    height: 42,

    paddingHorizontal: 9,

    alignItems: 'center',
    justifyContent: 'center',

    borderRadius: 15,

    backgroundColor: COLORS.overlayStrong,

    borderWidth: 1,
    borderColor: COLORS.border,
  },

  timerText: {
    color: COLORS.white,

    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',

    fontVariant: ['tabular-nums'],
  },

  guideArea: {
    ...StyleSheet.absoluteFillObject,

    alignItems: 'center',
    justifyContent: 'center',
  },

  guideFrame: {
    width: '72%',
    aspectRatio: 0.82,

    position: 'relative',
  },

  guideCorner: {
    position: 'absolute',

    width: 28,
    height: 28,

    borderColor: 'rgba(255,255,255,0.76)',
  },

  guideCornerTopLeft: {
    top: 0,
    left: 0,

    borderTopWidth: 2,
    borderLeftWidth: 2,

    borderTopLeftRadius: 9,
  },

  guideCornerTopRight: {
    top: 0,
    right: 0,

    borderTopWidth: 2,
    borderRightWidth: 2,

    borderTopRightRadius: 9,
  },

  guideCornerBottomLeft: {
    bottom: 0,
    left: 0,

    borderBottomWidth: 2,
    borderLeftWidth: 2,

    borderBottomLeftRadius: 9,
  },

  guideCornerBottomRight: {
    right: 0,
    bottom: 0,

    borderRightWidth: 2,
    borderBottomWidth: 2,

    borderBottomRightRadius: 9,
  },

  guideText: {
    marginTop: 22,

    paddingHorizontal: 16,
    paddingVertical: 9,

    color: COLORS.white,

    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',

    textAlign: 'center',

    borderRadius: 18,

    backgroundColor: COLORS.overlay,
  },

  zoomContainer: {
    position: 'absolute',
    left: 0,
    right: 0,

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',

    gap: 9,
  },

  zoomButton: {
    minWidth: 48,
    height: 38,

    paddingHorizontal: 10,

    alignItems: 'center',
    justifyContent: 'center',

    borderRadius: 19,

    backgroundColor: COLORS.overlay,

    borderWidth: 1,
    borderColor: COLORS.border,
  },

  zoomButtonSelected: {
    minWidth: 52,
    height: 42,

    borderRadius: 21,

    backgroundColor: COLORS.white,
    borderColor: COLORS.white,
  },

  zoomButtonPressed: {
    opacity: 0.72,
  },

  zoomButtonDisabled: {
    opacity: 0.45,
  },

  zoomButtonText: {
    color: 'rgba(255,255,255,0.86)',

    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },

  zoomButtonTextSelected: {
    color: COLORS.textPrimary,

    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },

  bottomControls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,

    minHeight: 138,

    paddingHorizontal: 22,
    paddingTop: 18,

    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',

    backgroundColor:
      'rgba(12, 12, 10, 0.58)',
  },

  bottomSideArea: {
    flex: 1,
    height: 80,

    alignItems: 'center',
    justifyContent: 'center',
  },

  clipCountBadge: {
    minWidth: 64,
    height: 42,

    paddingHorizontal: 11,

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',

    gap: 6,

    borderRadius: 15,

    backgroundColor: COLORS.overlayLight,

    borderWidth: 1,
    borderColor: COLORS.border,
  },

  clipCountText: {
    color: COLORS.white,

    fontSize: 12,
    lineHeight: 17,
    fontWeight: '800',

    fontVariant: ['tabular-nums'],
  },

  recordArea: {
    width: 128,

    alignItems: 'center',
    justifyContent: 'flex-start',
  },

  recordButtonOuter: {
    width: 78,
    height: 78,

    borderRadius: 39,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor:
      'rgba(255,255,255,0.20)',

    borderWidth: 4,
    borderColor: COLORS.white,

    overflow: 'hidden',
  },

  recordButtonOuterPressed: {
    transform: [{ scale: 0.96 }],
  },

  recordButtonDisabled: {
    opacity: 0.45,
  },

  progressTrack: {
    position: 'absolute',
    left: 5,
    right: 5,
    bottom: 5,

    height: 4,

    borderRadius: 2,

    overflow: 'hidden',

    backgroundColor:
      'rgba(255,255,255,0.28)',
  },

  progressFill: {
    height: '100%',

    borderRadius: 2,

    backgroundColor: COLORS.recording,
  },

  recordButtonInner: {
    width: 58,
    height: 58,

    borderRadius: 29,

    backgroundColor: COLORS.recording,
  },

  recordButtonInnerRecording: {
    width: 34,
    height: 34,

    borderRadius: 8,
  },

  recordHelpText: {
    marginTop: 8,

    color: COLORS.white,

    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',

    textAlign: 'center',
  },

  flipButton: {
    width: 52,
    height: 52,

    borderRadius: 26,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: COLORS.overlayLight,

    borderWidth: 1,
    borderColor: COLORS.border,
  },

  flipButtonPressed: {
    opacity: 0.72,
    transform: [{ rotate: '20deg' }],
  },

  flipButtonDisabled: {
    opacity: 0.4,
  },

  permissionScreen: {
    flex: 1,

    paddingHorizontal: 28,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: COLORS.background,
  },

  permissionIconContainer: {
    width: 76,
    height: 76,

    borderRadius: 38,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: COLORS.primarySoft,
  },

  permissionTitle: {
    marginTop: 24,

    color: COLORS.textPrimary,

    fontSize: 20,
    lineHeight: 28,
    fontWeight: '800',

    textAlign: 'center',

    letterSpacing: -0.4,
  },

  permissionDescription: {
    marginTop: 10,

    color: COLORS.textSecondary,

    fontSize: 14,
    lineHeight: 22,
    fontWeight: '500',

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

    backgroundColor: COLORS.primary,

    shadowColor: COLORS.primary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,

    elevation: 4,
  },

  permissionButtonPressed: {
    backgroundColor: COLORS.primaryDark,

    transform: [{ scale: 0.98 }],
  },

  permissionButtonText: {
    color: COLORS.white,

    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
  },
});