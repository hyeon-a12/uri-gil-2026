import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { HapticPressable } from '@/components/common';
import { apiFetch } from '@/services/api';

// 백엔드(uri_gil_backend/routers/auth.py)는 앱 안에서 인증코드를 확인하는 방식이
// 아니라, 이메일로 재설정 링크를 보내고 그 링크가 별도 웹페이지
// (urigil-reset-password GitHub Pages)로 연결되는 방식입니다. 실제 비밀번호
// 변경은 그 웹페이지에서 이뤄지므로, 앱은 이메일 제출까지만 담당합니다.
type Step = 'email' | 'sent';

export default function FindPasswordScreen() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);

  const submitEmail = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      Alert.alert('입력 확인', '이메일을 입력해주세요.');
      return;
    }
    if (!trimmed.includes('@')) {
      Alert.alert('입력 확인', '올바른 이메일 형식을 입력해주세요.');
      return;
    }

    setIsSending(true);
    try {
      await apiFetch('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: trimmed }),
      });
      setStep('sent');
    } catch (error) {
      console.error('[FindPassword] 재설정 이메일 발송 실패:', error);
      Alert.alert('오류', '이메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsSending(false);
    }
  };

  const handleBack = () => {
    if (step === 'sent') {
      setStep('email');
      return;
    }
    router.back();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>

          {step === 'email' ? (
            <>
              <Text style={styles.title}>비밀번호 찾기</Text>
              <Text style={styles.description}>
                가입할 때 사용한 이메일을 입력하면{'\n'}
                비밀번호 재설정 링크를 보내드릴게요.
              </Text>

              <View style={styles.form}>
                <Text style={styles.label}>이메일</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="example@email.com"
                  placeholderTextColor="#8A8A8A"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={submitEmail}
                />
                <HapticPressable
                  style={[styles.primaryButton, isSending && styles.buttonDisabled]}
                  onPress={submitEmail}
                  disabled={isSending}
                >
                  <Text style={styles.primaryButtonText}>
                    {isSending ? '전송 중...' : '재설정 링크 받기'}
                  </Text>
                </HapticPressable>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.title}>이메일을 확인해주세요</Text>
              <Text style={styles.description}>
                {email}로{'\n'}
                비밀번호 재설정 링크를 보냈어요.{'\n'}
                이메일의 링크를 눌러 새 비밀번호를 설정해주세요.
              </Text>

              <View style={styles.form}>
                <HapticPressable style={styles.primaryButton} onPress={() => router.back()}>
                  <Text style={styles.primaryButtonText}>로그인 화면으로</Text>
                </HapticPressable>

                <TouchableOpacity
                  style={styles.resendButton}
                  onPress={submitEmail}
                  disabled={isSending}
                >
                  <Text style={styles.resendText}>
                    {isSending ? '전송 중...' : '이메일을 못 받으셨나요? 다시 보내기'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 20,
    paddingBottom: 40,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    marginBottom: 24,
  },
  backArrow: {
    fontSize: 22,
    color: '#222222',
  },
  title: {
    fontFamily: 'Pretendard-Bold',
    color: '#222222',
    fontSize: 26,
    lineHeight: 36,
  },
  description: {
    fontFamily: 'Pretendard-Regular',
    color: '#8A8A8A',
    fontSize: 14,
    lineHeight: 22,
    marginTop: 10,
  },
  form: {
    marginTop: 36,
  },
  label: {
    fontFamily: 'Pretendard-Medium',
    color: '#222222',
    fontSize: 14,
    marginBottom: 9,
  },
  input: {
    height: 56,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDDDDD',
    borderRadius: 16,
    paddingHorizontal: 17,
    color: '#222222',
    fontFamily: 'Pretendard-Regular',
    fontSize: 15,
    letterSpacing: 0,
    marginBottom: 20,
  },
  resendButton: {
    alignSelf: 'center',
    paddingVertical: 14,
  },
  resendText: {
    fontFamily: 'Pretendard-Regular',
    color: '#8A8A8A',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  primaryButton: {
    height: 56,
    borderRadius: 16,
    backgroundColor: '#FF7F5C',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontFamily: 'Pretendard-Bold',
    color: '#FFFFFF',
    fontSize: 16,
  },
});
