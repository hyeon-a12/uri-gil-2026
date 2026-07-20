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

const MAX_CLIP_SECONDS = 5;

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
        style={StyleSheet.absoluteFillObject}
        facing={facing}
        mode="video"
        zoom={ZOOM_LEVELS[zoomIndex].value}
        videoQuality="720p"
      />

      {isRecording ? <View style={styles.recordingBorder} pointerEvents="none" /> : null}

      <Pressable
        style={[styles.closeButton, { top: insets.top + 16, left: insets.left + 16 }]}
        onPress={handleClose}
        hitSlop={12}>
        <Text style={styles.closeIcon}>✕</Text>
      </Pressable>

      {isRecording ? (
        <View style={[styles.timerBadge, { top: insets.top + 16 }]}>
          <Text style={styles.timerText}>{formatTimer(elapsedSeconds)}</Text>
        </View>
      ) : null}

      <View style={[styles.zoomFloatContainer, { right: 104 }]}>
        {ZOOM_LEVELS.map((level, index) => {
          const active = index === zoomIndex;
          return (
            <Pressable
              key={level.label}
              style={styles.zoomItem}
              disabled={isRecording}
              onPress={() => setZoomIndex(index)}>
              <Text style={[styles.zoomText, active && styles.zoomTextActive]}>
                {level.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.rightSidebar}>
        <Pressable
          style={[styles.flipButton, {marginTop: insets.top + 24}, isRecording && styles.disabledOpacity]}
          onPress={toggleFacing}
          disabled={isRecording}>
          <View style={styles.flipIconCircle}>
            <Text style={styles.flipIcon}>⟲</Text>
          </View>
        </Pressable>

        <View style={styles.recordButtonContainer}>
          <Pressable onPress={handleRecordPress} style={styles.recordButtonWrap}>
            <View style={[styles.progressRing, { opacity: isRecording ? 1 : 0 }]}>
              <View
                style={[
                  styles.progressArc,
                  { transform: [{ rotate: `${progress * 360}deg` }] },
                ]}
              />
            </View>
            <View style={styles.recordButtonOuter}>
              <View style={[styles.recordButtonInner, isRecording && styles.recordButtonActive]} />
            </View>
          </Pressable>
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
    ...StyleSheet.absoluteFillObject,
    borderWidth: 6,
    borderColor: COLORS.cameraRecordingBorder,
  },
  closeButton: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  closeIcon: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '400',
  },
  timerBadge: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    zIndex: 10,
  },
  timerText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
  zoomFloatContainer: {
    position: 'absolute',
    top: '50%',
    transform: [{ translateY: -80 }],
    alignItems: 'center',
    gap: 16,
    zIndex: 10,
  },
  zoomItem: {
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  zoomText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  zoomTextActive: {
    color: '#FFCC00',
    fontSize: 14,
    fontWeight: '800',
  },
  rightSidebar: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 88,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
  },
  flipButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  flipIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flipIcon: {
    color: '#FFF',
    fontSize: 22,
  },
  disabledOpacity: {
    opacity: 0.3,
  },
  recordButtonContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordButtonWrap: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordButtonOuter: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: '#FFF',
  },
  recordButtonInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E53935',
  },
  recordButtonActive: {
    width: 36,
    height: 36,
    borderRadius: 6,
  },
  progressRing: {
    position: 'absolute',
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  progressArc: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFF',
    marginTop: -4,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#FFF',
    gap: 12,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  permissionBody: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  permissionButton: {
    marginTop: 8,
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  permissionButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
