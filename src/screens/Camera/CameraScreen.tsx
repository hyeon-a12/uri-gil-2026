import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
  type CameraType,
} from 'expo-camera';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS } from '@/constants/color';
import { navigateToLocationConfirm } from '@/navigation/recordingNavigation';

const MAX_CLIP_SECONDS = 10;
const MAX_CLIPS = 15;

const ZOOM_LEVELS = [
  { label: '3', value: 0.85 },
  { label: '2', value: 0.65 },
  { label: '1x', value: 0 },
  { label: '.5', value: 0 },
] as const;

function formatTimer(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/** 인앱 카메라 — 기기 카메라 미리보기 + 짧은 영상 촬영 */
export default function CameraScreen() {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  const [facing, setFacing] = useState<CameraType>('back');
  const [zoomIndex, setZoomIndex] = useState(2);
  const [clipCount, setClipCount] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const permissionsReady =
    cameraPermission?.granted === true && micPermission?.granted === true;

  useEffect(() => {
    if (!isRecording) return;

    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isRecording]);

  const requestPermissions = async () => {
    await requestCameraPermission();
    await requestMicPermission();
  };

  const toggleFacing = () => {
    if (isRecording) return;
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
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

    if (!cameraRef.current) return;

    setIsRecording(true);
    setElapsedSeconds(0);

    try {
      const video = await cameraRef.current.recordAsync({
        maxDuration: MAX_CLIP_SECONDS,
      });

      if (video?.uri) {
        setClipCount((count) => count + 1);
        navigateToLocationConfirm(video.uri);
      }
    } catch (error) {
      console.error('Video recording failed:', error);
    } finally {
      setIsRecording(false);
      setElapsedSeconds(0);
    }
  };

  if (Platform.OS === 'web') {
    return (
      <View style={styles.centered}>
        <Text style={styles.permissionTitle}>카메라는 실제 기기에서만 사용할 수 있습니다.</Text>
        <Text style={styles.permissionBody}>Expo Go 앱으로 QR 코드를 스캔해 확인해 주세요.</Text>
        <Pressable style={styles.permissionButton} onPress={() => router.back()}>
          <Text style={styles.permissionButtonText}>돌아가기</Text>
        </Pressable>
      </View>
    );
  }

  if (!cameraPermission || !micPermission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  if (!permissionsReady) {
    return (
      <View style={styles.centered}>
        <Text style={styles.permissionTitle}>카메라 접근 권한이 필요합니다</Text>
        <Text style={styles.permissionBody}>
          여행 영상 촬영과 GPS 장소 매칭을 위해{'\n'}카메라와 마이크 권한을 허용해 주세요.
        </Text>
        <Pressable style={styles.permissionButton} onPress={requestPermissions}>
          <Text style={styles.permissionButtonText}>권한 허용하기</Text>
        </Pressable>
      </View>
    );
  }

  const progress = Math.min(elapsedSeconds / MAX_CLIP_SECONDS, 1);

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        mode="video"
        zoom={ZOOM_LEVELS[zoomIndex].value}
        videoQuality="720p"
      />

      {isRecording ? <View style={styles.recordingBorder} pointerEvents="none" /> : null}

      <Pressable
        style={[styles.closeButton, { top: insets.top + 12, left: insets.left + 16 }]}
        onPress={handleClose}
        hitSlop={12}>
        <Text style={styles.closeIcon}>✕</Text>
      </Pressable>

      {isRecording ? (
        <View style={[styles.timerBadge, { top: insets.top + 12 }]}>
          <Text style={styles.timerText}>{formatTimer(elapsedSeconds)}</Text>
        </View>
      ) : null}

      <View style={[styles.sidebar, { top: insets.top + 56, bottom: insets.bottom + 24 }]}>
        <Pressable
          style={[styles.iconButton, isRecording && styles.iconButtonDisabled]}
          onPress={toggleFacing}
          disabled={isRecording}>
          <Text style={styles.flipIcon}>⟲</Text>
        </Pressable>

        <View style={styles.zoomList}>
          {ZOOM_LEVELS.map((level, index) => {
            const active = index === zoomIndex;
            return (
              <Pressable
                key={level.label}
                style={styles.zoomItem}
                disabled={isRecording}
                onPress={() => setZoomIndex(index)}>
                <Text style={[styles.zoomText, active && styles.zoomTextActive]}>{level.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.recordArea}>
          <Pressable onPress={handleRecordPress} style={styles.recordButtonWrap}>
            <View style={[styles.progressRing, { opacity: isRecording ? 1 : 0 }]}>
              <View
                style={[
                  styles.progressArc,
                  { transform: [{ rotate: `${progress * 360}deg` }] },
                ]}
              />
            </View>
            <View style={[styles.recordButton, isRecording && styles.recordButtonActive]} />
          </Pressable>

          <Text style={styles.clipCounter}>
            {clipCount}/{MAX_CLIPS}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  recordingBorder: {
    ...StyleSheet.absoluteFill,
    borderWidth: 6,
    borderColor: COLORS.cameraRecordingBorder,
  },
  closeButton: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.cameraSidebar,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '700',
  },
  timerBadge: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: COLORS.cameraRecord,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  timerText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
  sidebar: {
    position: 'absolute',
    right: 16,
    width: 72,
    backgroundColor: COLORS.cameraSidebar,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonDisabled: {
    opacity: 0.4,
  },
  flipIcon: {
    color: COLORS.white,
    fontSize: 26,
    fontWeight: '700',
  },
  zoomList: {
    alignItems: 'center',
    gap: 10,
  },
  zoomItem: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  zoomText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    fontWeight: '600',
  },
  zoomTextActive: {
    color: COLORS.cameraZoomActive,
    fontSize: 16,
    fontWeight: '800',
  },
  recordArea: {
    alignItems: 'center',
    gap: 10,
  },
  recordButtonWrap: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRing: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  progressArc: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.white,
    marginTop: -2,
  },
  recordButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.cameraRecord,
  },
  recordButtonActive: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  clipCounter: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '600',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: COLORS.white,
    gap: 12,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
  },
  permissionBody: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  permissionButton: {
    marginTop: 8,
    backgroundColor: COLORS.locationSelect,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  permissionButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
  },
});
