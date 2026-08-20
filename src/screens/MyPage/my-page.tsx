import { View } from 'react-native';
import { AppText as Text } from '@/components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS } from '@/constants/color';

export default function MyPageScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.textPrimary }}>마이 페이지</Text>
        <Text style={{ fontSize: 14, color: COLORS.textSecondary, marginTop: 8 }}>
          개인 페이지
        </Text>
      </View>
    </SafeAreaView>
  );
}
