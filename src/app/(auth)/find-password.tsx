import { router } from 'expo-router';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function FindPasswordScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <TouchableOpacity
        style={styles.backButton}
        activeOpacity={0.7}
        onPress={() => router.back()}
      >
        <Text style={styles.backButtonText}>‹</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={styles.title}>비밀번호 찾기</Text>
        <Text style={styles.description}>
          비밀번호 찾기 기능은 준비 중이에요.{'\n'}조금만 기다려주세요.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    marginLeft: 12,
    marginTop: 6,
  },

  backButtonText: {
    color: '#222222',
    fontSize: 40,
    lineHeight: 42,
    fontFamily: 'Pretendard-Regular',
  },

  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },

  title: {
    fontFamily: 'Pretendard-Bold',
    color: '#222222',
    fontSize: 22,
    marginBottom: 10,
  },

  description: {
    fontFamily: 'Pretendard-Regular',
    color: '#8A8A8A',
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
  },
});
