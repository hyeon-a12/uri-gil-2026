import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { AppText as Text } from '@/components/AppText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { navigateToLocationConfirm } from '@/navigation/recordingNavigation';
import { saveRecording } from '@/services/recordingService';
import { useTripStore } from '@/store/useTripStore';
import { COLORS as SHARED_COLORS } from '@/constants/color';

/**
 * CameraScreen.tsx의 웹 버전입니다. Metro 플랫폼 확장자 규칙에 따라 웹
 * 번들에서는 이 파일이 자동으로 대신 쓰이고(camera.tsx 등 호출부는 수정
 * 불필요), expo-camera의 CameraView/recordAsync는 웹 구현이 없어서 여기서는
 * 브라우저의 getUserMedia + MediaRecorder로 대체 구현합니다.
 *
 * 촬영 스타일 가이드(인형/거울)와 줌/플래시는 웹 MVP 범위에서 제외했습니다 —
 * 실기기 카메라 렌즈 제어(zoom/selectedLens/torch)는 브라우저 표준 API로
 * 안정적으로 재현하기 어렵고, 핵심 플로우(촬영→저장)와 무관한 장식 요소라
 * 마감이 촉박한 이번 웹 전환에서는 우선순위 밖입니다.
 */

const MAX_CLIPS = 15;
const RECORD_DURATION_SECONDS = 3;

const COLORS = {
  accent: SHARED_COLORS.accent,
  white: SHARED_COLORS.background,
  black: SHARED_COLORS.textPrimary,
  backgroundIvory: SHARED_COLORS.backgroundIvory,
  ring: 'rgba(255,255,255,0.4)',
  textSecondary: SHARED_COLORS.textSecondary,
};

const SHUTTER_BUTTON_WIDTH = 90;
const SHUTTER_BUTTON_HEIGHT = 70;
const SHUTTER_RING_STROKE = 3.75;
const SHUTTER_RING_SIZE = SHUTTER_BUTTON_HEIGHT;
const SHUTTER_RING_CENTER = SHUTTER_RING_SIZE / 2;
const SHUTTER_RING_RADIUS = SHUTTER_RING_CENTER - SHUTTER_RING_STROKE;
const SHUTTER_RING_OFFSET_X = (SHUTTER_BUTTON_WIDTH - SHUTTER_RING_SIZE) / 2;
const SHUTTER_RING_CIRCUMFERENCE = 2 * Math.PI * SHUTTER_RING_RADIUS;

// MediaRecorder가 만들 파일 포맷. 브라우저가 지원하는 첫 번째 값을 씁니다
// (Android Chrome은 webm/vp9, Safari는 mp4만 지원하는 경우가 많습니다).
const CANDIDATE_MIME_TYPES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
  'video/mp4',
];

function pickSupportedMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return CANDIDATE_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

type PermissionState = 'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported' | 'error';

interface InfoScreenProps {
  loading?: boolean;
  title?: string;
  description?: string;
  buttonLabel?: string;
  onPress?: () => void;
  iconName?: React.ComponentProps<typeof Ionicons>['name'];
}

function InfoScreen({
  loading = false,
  title,
  description,
  buttonLabel,
  onPress,
  iconName = 'camera-outline',
}: InfoScreenProps) {
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
              <Text allowFontScaling={false} style={styles.permissionButtonText}>
                {buttonLabel}
              </Text>
            </Pressable>
          ) : null}
        </>
      )}
    </View>
  );
}

export default function CameraScreen() {
  const insets = useSafeAreaInsets();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const currentTrip = useTripStore((state) => state.currentTrip);

  const { quickAddPlaceName, quickAddLatitude, quickAddLongitude, quickAddStopId } =
    useLocalSearchParams<{
      quickAddPlaceName?: string;
      quickAddLatitude?: string;
      quickAddLongitude?: string;
      quickAddStopId?: string;
    }>();

  const quickAddPlace = useMemo(() => {
    const latitude = Number(quickAddLatitude);
    const longitude = Number(quickAddLongitude);
    if (!quickAddPlaceName || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }
    return { name: quickAddPlaceName, latitude, longitude, stopId: quickAddStopId };
  }, [quickAddPlaceName, quickAddLatitude, quickAddLongitude, quickAddStopId]);

  const [permissionState, setPermissionState] = useState<PermissionState>('idle');
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [clipCount, setClipCount] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const canRecord = clipCount < MAX_CLIPS && permissionState === 'granted';
  const progress = Math.min(elapsedSeconds / RECORD_DURATION_SECONDS, 1);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const attachStream = useCallback((stream: MediaStream) => {
    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, []);

  const openCamera = useCallback(
    async (nextFacing: 'environment' | 'user') => {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setPermissionState('unsupported');
        return;
      }

      setPermissionState('requesting');
      stopStream();

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: nextFacing },
          audio: true,
        });
        attachStream(stream);
        setPermissionState('granted');
      } catch (error) {
        console.error('[Camera:web] getUserMedia 실패:', error);
        const name = (error as { name?: string })?.name;
        setPermissionState(name === 'NotAllowedError' ? 'denied' : 'error');
      }
    },
    [attachStream, stopStream],
  );

  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);

  useEffect(() => {
    if (!isRecording) return;

    const startedAt = Date.now();
    let frameId: number;
    const tick = () => {
      const elapsed = (Date.now() - startedAt) / 1000;
      setElapsedSeconds(Math.min(elapsed, RECORD_DURATION_SECONDS));
      if (elapsed < RECORD_DURATION_SECONDS) {
        frameId = requestAnimationFrame(tick);
      }
    };
    frameId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frameId);
  }, [isRecording]);

  const toggleFacing = () => {
    if (isRecording) return;
    const next = facing === 'environment' ? 'user' : 'environment';
    setFacing(next);
    void openCamera(next);
  };

  const handleClose = () => {
    stopStream();
    router.back();
  };

  const finishRecording = useCallback(
    (blob: Blob, durationMs: number) => {
      const videoUri = URL.createObjectURL(blob);

      if (quickAddPlace) {
        saveRecording({
          recordedAt: new Date().toISOString(),
          videoUri,
          durationMs,
          folderId: currentTrip!.id,
          location: {
            latitude: quickAddPlace.latitude,
            longitude: quickAddPlace.longitude,
            placeName: quickAddPlace.name,
            linkedStopId: quickAddPlace.stopId,
          },
        })
          .then(() => router.back())
          .catch((error) => {
            console.error('[Camera:web] 빠른 추가 저장 실패:', error);
            Alert.alert('저장에 실패했습니다', '잠시 후 다시 시도해주세요.');
          });
      } else {
        navigateToLocationConfirm(videoUri, undefined, durationMs);
      }
    },
    [quickAddPlace, currentTrip],
  );

  const handleRecordPress = () => {
    if (isRecording) return;

    if (!currentTrip) {
      Alert.alert(
        '진행 중인 여행이 없습니다',
        '촬영한 클립을 저장할 여행을 먼저 선택하거나 만들어주세요.',
      );
      return;
    }

    if (!canRecord || !streamRef.current) {
      if (clipCount >= MAX_CLIPS) {
        Alert.alert(
          '촬영 가능한 클립 수를 초과했습니다',
          `한 여행에서는 최대 ${MAX_CLIPS}개의 클립을 촬영할 수 있어요.`,
        );
      }
      return;
    }

    const mimeType = pickSupportedMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = mimeType
        ? new MediaRecorder(streamRef.current, { mimeType })
        : new MediaRecorder(streamRef.current);
    } catch (error) {
      console.error('[Camera:web] MediaRecorder 생성 실패:', error);
      Alert.alert('촬영을 시작할 수 없습니다', '이 브라우저는 영상 녹화를 지원하지 않아요.');
      return;
    }

    chunksRef.current = [];
    const startedAt = Date.now();

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };

    recorder.onstop = () => {
      const durationMs = Math.min(Date.now() - startedAt, RECORD_DURATION_SECONDS * 1000);
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'video/webm' });
      setClipCount((count) => Math.min(count + 1, MAX_CLIPS));
      setIsRecording(false);
      setElapsedSeconds(0);
      finishRecording(blob, durationMs);
    };

    mediaRecorderRef.current = recorder;
    setIsRecording(true);
    setElapsedSeconds(0);
    recorder.start();

    setTimeout(() => {
      if (recorder.state === 'recording') recorder.stop();
    }, RECORD_DURATION_SECONDS * 1000);
  };

  if (permissionState === 'idle') {
    return (
      <InfoScreen
        iconName="videocam-outline"
        title="카메라와 마이크가 필요해요"
        description={
          '여행 클립을 촬영하려면 카메라·마이크 접근이 필요해요.\n계속하면 브라우저가 권한을 물어봐요 — "허용"을 눌러주세요.'
        }
        buttonLabel="카메라 켜기"
        onPress={() => void openCamera(facing)}
      />
    );
  }

  if (permissionState === 'requesting') {
    return <InfoScreen loading />;
  }

  if (permissionState === 'unsupported') {
    return (
      <InfoScreen
        iconName="alert-circle-outline"
        title="이 브라우저에서는 카메라를 쓸 수 없어요"
        description={'최신 Chrome/Safari 브라우저로 다시 시도해주세요.'}
        buttonLabel="이전 화면으로"
        onPress={() => router.back()}
      />
    );
  }

  if (permissionState === 'denied' || permissionState === 'error') {
    return (
      <InfoScreen
        iconName="videocam-outline"
        title="카메라 권한이 필요해요"
        description={
          '여행 클립을 촬영하려면 브라우저의 카메라·마이크 접근을 허용해주세요.\n주소창 왼쪽 자물쇠 아이콘에서 권한을 허용한 뒤 다시 시도해주세요.'
        }
        buttonLabel="다시 시도"
        onPress={() => void openCamera(facing)}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.previewArea, { paddingTop: insets.top + 8 }]}>
        <View style={styles.previewWrapper}>
          {/* React Native Web 환경(순수 브라우저 DOM)이라 표준 <video> 태그를 그대로 씁니다. */}
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: facing === 'user' ? 'scaleX(-1)' : undefined,
            }}
          />

          <Pressable hitSlop={16} onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={22} color={COLORS.white} />
          </Pressable>
        </View>
      </View>

      <View style={styles.zoomRow}>
        <View style={styles.zoomRowSide} />
        <Text allowFontScaling={false} style={styles.hintText}>
          {RECORD_DURATION_SECONDS}초 클립을 촬영해요
        </Text>
        <View style={[styles.zoomRowSide, styles.zoomRowSideRight]}>
          <Pressable hitSlop={12} onPress={toggleFacing} disabled={isRecording}>
            <Ionicons
              name="camera-reverse-outline"
              size={24}
              color={isRecording ? COLORS.textSecondary : COLORS.black}
            />
          </Pressable>
        </View>
      </View>

      <View style={[styles.bottomRow, { paddingBottom: insets.bottom || 20 }]}>
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
          <View style={isRecording ? styles.shutterInnerRecording : styles.shutterInner} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.backgroundIvory,
  },
  previewArea: {
    flex: 1,
    justifyContent: 'center',
  },
  previewWrapper: {
    aspectRatio: 9 / 16,
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
  zoomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 26,
    paddingBottom: 4,
  },
  zoomRowSide: {
    flex: 1,
  },
  zoomRowSideRight: {
    alignItems: 'flex-end',
  },
  hintText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingTop: 0,
  },
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
    backgroundColor: COLORS.backgroundIvory,
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
