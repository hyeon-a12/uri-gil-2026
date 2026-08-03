import { View } from 'react-native';
import { AppText as Text } from '@/components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '@/constants/color';

export default function MyRouteScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.white }}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.text }}>내 루트</Text>
        <Text style={{ fontSize: 14, color: COLORS.textSecondary, marginTop: 8 }}>
          (지도가 들어갈 자리)
        </Text>
      </View>
    </SafeAreaView>
  );
}