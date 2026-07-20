import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { COLORS } from '@/constants/color';

export default function ClipManageScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>클립 관리</Text>
        <Text style={styles.description}>클립들 화면~</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  description: {
    marginTop: 8,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
});
