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

const API_URL = 'https://uri-gil-2026-production.up.railway.app';

export default function JoinScreen() {
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);

  const handleJoin = async () => {
    const trimmedNickname = nickname.trim();
    const trimmedEmail = email.trim();

    if (!trimmedNickname) {
      Alert.alert('입력 확인', '닉네임을 입력해주세요.');
      return;
    }

    if (trimmedNickname.length < 2 || trimmedNickname.length > 10) {
      Alert.alert('입력 확인', '닉네임은 2자 이상 10자 이하로 입력해주세요.');
      return;
    }

    if (!trimmedEmail) {
      Alert.alert('입력 확인', '이메일을 입력해주세요.');
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(trimmedEmail)) {
      Alert.alert('입력 확인', '올바른 이메일 형식을 입력해주세요.');
      return;
    }

    if (!password) {
      Alert.alert('입력 확인', '비밀번호를 입력해주세요.');
      return;
    }

    if (password.length < 8) {
      Alert.alert('입력 확인', '비밀번호는 8자 이상 입력해주세요.');
      return;
    }

    if (!passwordConfirm) {
      Alert.alert('입력 확인', '비밀번호 확인을 입력해주세요.');
      return;
    }

    if (password !== passwordConfirm) {
      Alert.alert('입력 확인', '비밀번호가 일치하지 않습니다.');
      return;
    }

    if (!agreeTerms) {
      Alert.alert(
        '약관 동의',
        '이용약관 및 개인정보 처리방침에 동의해주세요.',
      );
      return;
    }

    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: trimmedNickname,
          email: trimmedEmail,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        Alert.alert('회원가입 실패', data.detail || '알 수 없는 오류가 발생했습니다.');
        return;
      }

      Alert.alert(
        '회원가입 완료',
        '회원가입이 완료되었습니다.',
        [
          {
            text: '로그인하기',
            onPress: () => router.replace('/login'),
          },
        ],
      );
    } catch (error) {
      console.error(error);
      Alert.alert('오류', '서버와 연결할 수 없습니다. 인터넷 연결을 확인해주세요.');
    }
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
          <TouchableOpacity
            style={styles.backButton}
            activeOpacity={0.7}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>‹</Text>
          </TouchableOpacity>

          <Text style={styles.title}>
            여행을 시작할{'\n'}준비가 되셨나요?
          </Text>

          <Text style={styles.description}>
            간단한 정보를 입력하고 여행 기록을 시작해보세요.
          </Text>

          <View style={styles.form}>
            <Text style={styles.label}>닉네임</Text>

            <TextInput
              style={styles.input}
              value={nickname}
              onChangeText={setNickname}
              placeholder="2~10자로 입력해주세요"
              placeholderTextColor="#8A8A8A"
              maxLength={10}
              autoCorrect={false}
              returnKeyType="next"
            />

            <Text style={styles.helperText}>
              앱에서 다른 사용자에게 표시되는 이름이에요.
            </Text>

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
              returnKeyType="next"
            />

            <Text style={styles.label}>비밀번호</Text>

            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                value={password}
                onChangeText={setPassword}
                placeholder="8자 이상 입력해주세요"
                placeholderTextColor="#8A8A8A"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />

              <TouchableOpacity
                style={styles.passwordToggle}
                onPress={() => setShowPassword((previous) => !previous)}
              >
                <Text style={styles.passwordToggleText}>
                  {showPassword ? '숨기기' : '보기'}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>비밀번호 확인</Text>

            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                value={passwordConfirm}
                onChangeText={setPasswordConfirm}
                placeholder="비밀번호를 다시 입력해주세요"
                placeholderTextColor="#8A8A8A"
                secureTextEntry={!showPasswordConfirm}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleJoin}
              />

              <TouchableOpacity
                style={styles.passwordToggle}
                onPress={() =>
                  setShowPasswordConfirm((previous) => !previous)
                }
              >
                <Text style={styles.passwordToggleText}>
                  {showPasswordConfirm ? '숨기기' : '보기'}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.agreementRow}
              activeOpacity={0.8}
              onPress={() => setAgreeTerms((previous) => !previous)}
            >
              <View
                style={[
                  styles.checkbox,
                  agreeTerms && styles.checkboxChecked,
                ]}
              >
                {agreeTerms && <Text style={styles.checkText}>✓</Text>}
              </View>

              <Text style={styles.agreementText}>
                이용약관 및 개인정보 처리방침에 동의합니다.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.joinButton}
              activeOpacity={0.85}
              onPress={handleJoin}
            >
              <Text style={styles.joinButtonText}>회원가입</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.loginRow}>
            <Text style={styles.loginDescription}>
              이미 계정이 있으신가요?
            </Text>

            <TouchableOpacity onPress={() => router.replace('/login')}>
              <Text style={styles.loginText}>로그인</Text>
            </TouchableOpacity>
          </View>
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
    paddingTop: 18,
    paddingBottom: 40,
  },

  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    marginBottom: 14,
  },

  backButtonText: {
    color: '#222222',
    fontSize: 40,
    lineHeight: 42,
    fontFamily: 'SpoqaHanSansNeo-Regular',
  },

  title: {
    color: '#222222',
    fontSize: 28,
    lineHeight: 39,
    fontFamily: 'SpoqaHanSansNeo-Bold',
  },

  description: {
    color: '#8A8A8A',
    fontSize: 15,
    lineHeight: 23,
    fontFamily: 'SpoqaHanSansNeo-Regular',
    marginTop: 10,
  },

  form: {
    marginTop: 32,
  },

  label: {
    color: '#222222',
    fontSize: 14,
    fontFamily: 'SpoqaHanSansNeo-Medium',
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
    fontSize: 15,
    fontFamily: 'SpoqaHanSansNeo-Regular',
    marginBottom: 20,
  },

  helperText: {
    color: '#8A8A8A',
    fontSize: 12,
    fontFamily: 'SpoqaHanSansNeo-Regular',
    marginTop: -12,
    marginBottom: 20,
    marginLeft: 4,
  },

  passwordContainer: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDDDDD',
    borderRadius: 16,
    marginBottom: 20,
  },

  passwordInput: {
    flex: 1,
    height: '100%',
    paddingLeft: 17,
    paddingRight: 8,
    color: '#222222',
    fontSize: 15,
    fontFamily: 'SpoqaHanSansNeo-Regular',
  },

  passwordToggle: {
    height: '100%',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },

  passwordToggleText: {
    color: '#FF7F5C',
    fontSize: 13,
    fontFamily: 'SpoqaHanSansNeo-Medium',
  },

  agreementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    paddingVertical: 8,
  },

  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#DDDDDD',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  checkboxChecked: {
    borderColor: '#FF7F5C',
    backgroundColor: '#FF7F5C',
  },

  checkText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  agreementText: {
    flex: 1,
    color: '#8A8A8A',
    fontSize: 13,
    lineHeight: 19,
    fontFamily: 'SpoqaHanSansNeo-Regular',
  },

  joinButton: {
    height: 56,
    borderRadius: 16,
    backgroundColor: '#FF7F5C',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
  },

  joinButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'SpoqaHanSansNeo-Bold',
  },

  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 26,
  },

  loginDescription: {
    color: '#8A8A8A',
    fontSize: 14,
    fontFamily: 'SpoqaHanSansNeo-Regular',
  },

  loginText: {
    color: '#FF7F5C',
    fontSize: 14,
    fontFamily: 'SpoqaHanSansNeo-Bold',
    marginLeft: 8,
  },
});