import { router } from 'expo-router';
import { useRef, useState } from 'react';
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

// ─── 단계 타입 ────────────────────────────────────────────────────────────────
type Step = 'email' | 'verify' | 'reset';

// ─── 상수 ─────────────────────────────────────────────────────────────────────
const CODE_LENGTH = 6;
const CODE_EXPIRE_SECONDS = 180; // 3분

// ─── 유틸: mm:ss 포맷 ─────────────────────────────────────────────────────────
function formatTimer(seconds: number) {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function FindPasswordScreen() {
  // 단계
  const [step, setStep] = useState<Step>('email');

  // 이메일 단계
  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);

  // 인증코드 단계
  const [code, setCode] = useState('');
  const [timer, setTimer] = useState(CODE_EXPIRE_SECONDS);
  const [timerExpired, setTimerExpired] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 비밀번호 재설정 단계
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // ── 타이머 시작 ─────────────────────────────────────────────────────────────
  const startTimer = () => {
    setTimer(CODE_EXPIRE_SECONDS);
    setTimerExpired(false);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setTimerExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // ── 이메일 제출 → 인증코드 발송 ──────────────────────────────────────────────
  const handleSendCode = async () => {
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
      // TODO: 실제 API 호출로 교체
      // await sendPasswordResetCode(trimmed);
      await new Promise((r) => setTimeout(r, 800)); // 모의 지연

      startTimer();
      setStep('verify');
    } catch {
      Alert.alert('오류', '인증코드 전송에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSending(false);
    }
  };

  // ── 코드 재전송 ─────────────────────────────────────────────────────────────
  const handleResend = async () => {
    try {
      // TODO: 실제 API 호출로 교체
      await new Promise((r) => setTimeout(r, 600));
      setCode('');
      startTimer();
      Alert.alert('전송 완료', '인증코드를 다시 전송했습니다.');
    } catch {
      Alert.alert('오류', '재전송에 실패했습니다. 다시 시도해주세요.');
    }
  };

  // ── 인증코드 확인 ────────────────────────────────────────────────────────────
  const handleVerifyCode = async () => {
    if (code.length < CODE_LENGTH) {
      Alert.alert('입력 확인', `인증코드 ${CODE_LENGTH}자리를 입력해주세요.`);
      return;
    }
    if (timerExpired) {
      Alert.alert('시간 초과', '인증코드가 만료되었습니다. 재전송해주세요.');
      return;
    }

    try {
      // TODO: 실제 API 호출로 교체
      // await verifyCode(email, code);
      await new Promise((r) => setTimeout(r, 600));

      if (timerRef.current) clearInterval(timerRef.current);
      setStep('reset');
    } catch {
      Alert.alert('인증 실패', '인증코드가 올바르지 않습니다. 다시 확인해주세요.');
    }
  };

  // ── 새 비밀번호 저장 ─────────────────────────────────────────────────────────
  const handleResetPassword = async () => {
    if (newPassword.length < 8) {
      Alert.alert('입력 확인', '비밀번호는 8자 이상 입력해주세요.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('입력 확인', '비밀번호가 일치하지 않습니다.');
      return;
    }

    try {
      // TODO: 실제 API 호출로 교체
      // await resetPassword(email, code, newPassword);
      await new Promise((r) => setTimeout(r, 600));

      Alert.alert('완료', '비밀번호가 변경되었습니다.\n다시 로그인해주세요.', [
        // replace로 새 로그인 화면을 만들지 않고, 원래 있던 로그인 화면으로
        // 그대로 돌아갑니다(router.replace는 스택에 로그인 화면이 하나 더
        // 쌓여서 뒤로가기 흐름이 꼬입니다).
        { text: '로그인하기', onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert('오류', '비밀번호 변경에 실패했습니다. 다시 시도해주세요.');
    }
  };

  // ── 뒤로가기 ─────────────────────────────────────────────────────────────────
  const handleBack = () => {
    if (step === 'email') {
      router.back();
    } else if (step === 'verify') {
      if (timerRef.current) clearInterval(timerRef.current);
      setCode('');
      setStep('email');
    } else {
      setNewPassword('');
      setConfirmPassword('');
      setStep('verify');
      startTimer();
    }
  };

  // ─── 단계별 헤더 텍스트 ────────────────────────────────────────────────────
  const headerMap: Record<Step, { title: string; desc: string }> = {
    email: {
      title: '비밀번호 찾기',
      desc: '가입할 때 사용한 이메일을 입력하면\n인증코드를 보내드릴게요.',
    },
    verify: {
      title: '인증코드 확인',
      desc: `${email}로\n전송된 6자리 코드를 입력해주세요.`,
    },
    reset: {
      title: '새 비밀번호 설정',
      desc: '이전과 다른 비밀번호로\n설정하시는 것을 권장해요.',
    },
  };

  const { title, desc } = headerMap[step];

  // ─── 렌더 ─────────────────────────────────────────────────────────────────
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
          {/* 상단 내비게이션 */}
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>

          {/* 단계 인디케이터 */}
          <StepIndicator current={step} />

          {/* 헤더 */}
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{desc}</Text>

          {/* ── 1단계: 이메일 입력 ── */}
          {step === 'email' && (
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
                onSubmitEditing={handleSendCode}
              />
              <HapticPressable
                style={[styles.primaryButton, isSending && styles.buttonDisabled]}
                onPress={handleSendCode}
                disabled={isSending}
              >
                <Text style={styles.primaryButtonText}>
                  {isSending ? '전송 중...' : '인증코드 받기'}
                </Text>
              </HapticPressable>
            </View>
          )}

          {/* ── 2단계: 인증코드 확인 ── */}
          {step === 'verify' && (
            <View style={styles.form}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>인증코드</Text>
                <Text style={[styles.timer, timerExpired && styles.timerExpired]}>
                  {timerExpired ? '만료됨' : formatTimer(timer)}
                </Text>
              </View>

              <TextInput
                style={[styles.input, styles.codeInput]}
                value={code}
                onChangeText={(t) => setCode(t.replace(/[^0-9]/g, '').slice(0, CODE_LENGTH))}
                placeholder="6자리 코드"
                placeholderTextColor="#8A8A8A"
                keyboardType="number-pad"
                returnKeyType="done"
                maxLength={CODE_LENGTH}
                onSubmitEditing={handleVerifyCode}
              />

              <TouchableOpacity style={styles.resendButton} onPress={handleResend}>
                <Text style={styles.resendText}>인증코드 재전송</Text>
              </TouchableOpacity>

              <HapticPressable style={styles.primaryButton} onPress={handleVerifyCode}>
                <Text style={styles.primaryButtonText}>확인</Text>
              </HapticPressable>
            </View>
          )}

          {/* ── 3단계: 새 비밀번호 설정 ── */}
          {step === 'reset' && (
            <View style={styles.form}>
              <Text style={styles.label}>새 비밀번호</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={styles.passwordInput}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="8자 이상 입력해주세요"
                  placeholderTextColor="#8A8A8A"
                  secureTextEntry={!showNew}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowNew((p) => !p)}
                >
                  <Text style={styles.eyeText}>{showNew ? '숨기기' : '보기'}</Text>
                </TouchableOpacity>
              </View>

              <PasswordStrengthBar password={newPassword} />

              <Text style={[styles.label, { marginTop: 20 }]}>비밀번호 확인</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={styles.passwordInput}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="비밀번호를 다시 입력해주세요"
                  placeholderTextColor="#8A8A8A"
                  secureTextEntry={!showConfirm}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleResetPassword}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowConfirm((p) => !p)}
                >
                  <Text style={styles.eyeText}>{showConfirm ? '숨기기' : '보기'}</Text>
                </TouchableOpacity>
              </View>

              {confirmPassword.length > 0 && (
                <Text
                  style={[
                    styles.matchHint,
                    newPassword === confirmPassword ? styles.matchOk : styles.matchFail,
                  ]}
                >
                  {newPassword === confirmPassword
                    ? '✓ 비밀번호가 일치합니다'
                    : '✗ 비밀번호가 일치하지 않습니다'}
                </Text>
              )}

              <HapticPressable
                style={[styles.primaryButton, { marginTop: 28 }]}
                onPress={handleResetPassword}
              >
                <Text style={styles.primaryButtonText}>비밀번호 변경하기</Text>
              </HapticPressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── 단계 인디케이터 ──────────────────────────────────────────────────────────
function StepIndicator({ current }: { current: Step }) {
  const steps: Step[] = ['email', 'verify', 'reset'];
  const idx = steps.indexOf(current);
  return (
    <View style={indicator.row}>
      {steps.map((s, i) => (
        <View key={s} style={indicator.item}>
          <View style={[indicator.dot, i <= idx && indicator.dotActive]}>
            {i < idx ? (
              <Text style={indicator.checkmark}>✓</Text>
            ) : (
              <Text style={[indicator.num, i === idx && indicator.numActive]}>
                {i + 1}
              </Text>
            )}
          </View>
          {i < steps.length - 1 && (
            <View style={[indicator.line, i < idx && indicator.lineActive]} />
          )}
        </View>
      ))}
    </View>
  );
}

const indicator = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotActive: {
    backgroundColor: '#FF7F5C',
  },
  num: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 12,
    color: '#AAAAAA',
  },
  numActive: {
    color: '#FFFFFF',
  },
  checkmark: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 12,
    color: '#FFFFFF',
  },
  line: {
    width: 36,
    height: 2,
    backgroundColor: '#F0F0F0',
    marginHorizontal: 4,
  },
  lineActive: {
    backgroundColor: '#FF7F5C',
  },
});

// ─── 비밀번호 강도 바 ─────────────────────────────────────────────────────────
function PasswordStrengthBar({ password }: { password: string }) {
  const getStrength = () => {
    if (password.length === 0) return { level: 0, label: '', color: '#F0F0F0' };
    if (password.length < 8) return { level: 1, label: '너무 짧아요', color: '#FF4D4D' };
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);
    const score = [hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length;
    if (score <= 1) return { level: 2, label: '보통', color: '#FFAA00' };
    if (score === 2) return { level: 3, label: '양호', color: '#44CC88' };
    return { level: 4, label: '강력', color: '#22AA66' };
  };

  const { level, label, color } = getStrength();
  if (password.length === 0) return null;

  return (
    <View style={strength.container}>
      <View style={strength.barRow}>
        {[1, 2, 3, 4].map((i) => (
          <View
            key={i}
            style={[strength.segment, { backgroundColor: i <= level ? color : '#F0F0F0' }]}
          />
        ))}
      </View>
      <Text style={[strength.label, { color }]}>{label}</Text>
    </View>
  );
}

const strength = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  barRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  label: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 12,
    minWidth: 32,
    textAlign: 'right',
  },
});

// ─── 메인 스타일 ──────────────────────────────────────────────────────────────
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
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 9,
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
  codeInput: {
    letterSpacing: 6,
    fontSize: 20,
    textAlign: 'center',
  },
  timer: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 14,
    color: '#FF7F5C',
  },
  timerExpired: {
    color: '#FF4D4D',
  },
  resendButton: {
    alignSelf: 'center',
    paddingVertical: 10,
    marginBottom: 8,
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
  passwordRow: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDDDDD',
    borderRadius: 16,
  },
  passwordInput: {
    flex: 1,
    height: '100%',
    paddingLeft: 17,
    paddingRight: 8,
    color: '#222222',
    fontFamily: 'Pretendard-Regular',
    fontSize: 15,
    letterSpacing: 0,
  },
  eyeButton: {
    height: '100%',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  eyeText: {
    fontFamily: 'Pretendard-Medium',
    color: '#FF7F5C',
    fontSize: 13,
  },
  matchHint: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 13,
    marginTop: 8,
    marginLeft: 4,
  },
  matchOk: {
    color: '#22AA66',
  },
  matchFail: {
    color: '#FF4D4D',
  },
});
