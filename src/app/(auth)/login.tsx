import { getProfile } from '@/services/profileService'; 
import { updateProfile } from '@/store/useProfileStore';
import * as SecureStore from 'expo-secure-store';
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
import { PrimaryButton } from '@/components/common';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
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

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        Alert.alert('로그인 실패', data.detail || '이메일 또는 비밀번호를 확인해주세요.');
        return;
      }

      // 토큰이랑 유저 정보를 안전한 저장소에 저장
      await SecureStore.setItemAsync('access_token', data.access_token);
      await SecureStore.setItemAsync('user_id', String(data.user_id));
      await SecureStore.setItemAsync('nickname', data.nickname);

      // 기존에 저장된 프로필(bio, avatarUri)은 유지하고, 닉네임만 서버 값으로 갱신
      const existingProfile = await getProfile();
      await updateProfile({
        ...existingProfile,
        nickname: data.nickname,
      });


      router.replace('/(tabs)/home');
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

            <PrimaryButton
              label="로그인"
              onPress={handleLogin}
              style={styles.loginButton}
            />
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

const API_URL = 'https://uri-gil-2026-production.up.railway.app';

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
    marginTop: 14,
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