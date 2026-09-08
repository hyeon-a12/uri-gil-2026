import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';

type MapLocateButtonProps = {
  onPress: () => void;
  /** 아이콘 색상. 기본값은 다크 텍스트 컬러 */
  color?: string;
};

/**
 * 지도 위에 떠 있는 원형 "내 위치로" 버튼입니다.
 * 지도가 있는 화면(내 루트, 촬영 후 장소 확인, 일정에 장소 추가)에서 모두
 * 같은 모양으로 재사용합니다 — 위치는 화면마다 다를 수 있어서 버튼 자체만
 * 내보내고, 화면 안에서의 배치(absolute position)는 호출하는 쪽이 정합니다.
 */
export function MapLocateButton({ onPress, color = '#1A1A1A' }: MapLocateButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
    >
      <Ionicons name="navigate-outline" size={23} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.93)',
  },
  buttonPressed: {
    opacity: 0.74,
    transform: [{ scale: 0.95 }],
  },
});
