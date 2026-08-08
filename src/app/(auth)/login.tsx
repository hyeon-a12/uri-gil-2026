import { router } from 'expo-router';
import { useState } from 'react';
import { Image } from 'react-native';
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

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      Alert.alert('입력 확인', '이메일을 입력해주세요.');
      return;
    }

    if (!trimmedEmail.includes('@')) {
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

    // TODO: 로그인 API 연결
    console.log({
      email: trimmedEmail,
      password,
    });

    router.replace('/(tabs)/home');
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
          <Image
  source={require('@/assets/images/urigil-logo.png')}
  style={styles.logo}
  resizeMode="contain"
/>
          <Text style={styles.title}>다시 만나서 반가워요!</Text>

          <Text style={styles.description}>
            로그인하고 나만의 여행 기록을 확인해보세요.
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
              returnKeyType="next"
            />

            <Text style={styles.label}>비밀번호</Text>

            <View style={styles.passwordInputContainer}>
              <TextInput
                style={styles.passwordInput}
                value={password}
                onChangeText={setPassword}
                placeholder="비밀번호를 입력해주세요"
                placeholderTextColor="#8A8A8A"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />

              <TouchableOpacity
                style={styles.passwordToggle}
                onPress={() => setShowPassword((prev) => !prev)}
              >
                <Text style={styles.passwordToggleText}>
                  {showPassword ? '숨기기' : '보기'}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.findPasswordButton}
              onPress={() => {
                Alert.alert(
                  '비밀번호 찾기',
                  '비밀번호 찾기 화면은 추후 연결하면 됩니다.',
                );
              }}
            >
              <Text style={styles.findPasswordText}>
                비밀번호를 잊으셨나요?
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.loginButton}
              activeOpacity={0.85}
              onPress={handleLogin}
            >
              <Text style={styles.loginButtonText}>로그인</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.joinRow}>
            <Text style={styles.joinDescription}>
              아직 계정이 없으신가요?
            </Text>

            <TouchableOpacity onPress={() => router.push('/join')}>
              <Text style={styles.joinText}>회원가입</Text>
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
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingTop: 50,
    paddingBottom: 40,
  },

  logo: {
  width: 90,
  height: 90,
  alignSelf: 'center',
  marginBottom: 30,
},

  title: {
    fontFamily: 'SpoqaHanSansNeo-Bold',
    color: '#222222',
    fontSize: 28,
    lineHeight: 38,
  },

  description: {
    fontFamily: 'SpoqaHanSansNeo-Regular',
    color: '#8A8A8A',
    fontSize: 15,
    lineHeight: 23,
    marginTop: 10,
  },

  form: {
    marginTop: 36,
  },

  label: {
    fontFamily: 'SpoqaHanSansNeo-Medium',
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
    fontFamily: 'SpoqaHanSansNeo-Regular',
    fontSize: 15,
    marginBottom: 20,
  },

  passwordInputContainer: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDDDDD',
    borderRadius: 16,
    marginBottom: 8,
  },

  passwordInput: {
    flex: 1,
    height: '100%',
    paddingLeft: 17,
    paddingRight: 8,
    color: '#222222',
    fontFamily: 'SpoqaHanSansNeo-Regular',
    fontSize: 15,
  },

  passwordToggle: {
    height: '100%',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },

  passwordToggleText: {
    fontFamily: 'SpoqaHanSansNeo-Medium',
    color: '#FF7F5C',
    fontSize: 13,
  },

  findPasswordButton: {
    alignSelf: 'flex-end',
    paddingVertical: 10,
  },

  findPasswordText: {
    fontFamily: 'SpoqaHanSansNeo-Regular',
    color: '#8A8A8A',
    fontSize: 13,
  },

  loginButton: {
    height: 56,
    borderRadius: 16,
    backgroundColor: '#FF7F5C',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },

  loginButtonText: {
    fontFamily: 'SpoqaHanSansNeo-Bold',
    color: '#FFFFFF',
    fontSize: 16,
  },

  joinRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 28,
  },

  joinDescription: {
    fontFamily: 'SpoqaHanSansNeo-Regular',
    color: '#8A8A8A',
    fontSize: 14,
  },

  joinText: {
    fontFamily: 'SpoqaHanSansNeo-Bold',
    color: '#FF7F5C',
    fontSize: 14,
    marginLeft: 8,
  },
});