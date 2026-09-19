import { getProfile } from '@/services/profileService';
import { updateProfile } from '@/store/useProfileStore';
import { useAuthStore } from '@/store/useAuthStore';
import { hydrateCurrentTrip } from '@/store/useTripStore';
import { extractErrorMessage } from '@/services/api';
import { isValidEmail } from '@/utils/validation';
import * as SecureStore from '@/services/secureStorage';
import { router } from 'expo-router';
import { useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { AUTH_STYLES, AuthHeader, IconButton } from '@/components/web/AuthChrome.web';

/**
 * login.tsx(네이티브)의 웹 버전입니다. 팀이 Manus로 만든 프로토타입의
 * Login 화면 디자인을 그대로 옮기고, 실제 로그인 로직(검증/서버 호출/
 * 토큰 저장/프로필·여행 하이드레이션)은 네이티브 login.tsx와 동일하게
 * 유지했습니다 — 화면만 바뀌고 동작은 완전히 같습니다.
 */

const API_URL = 'https://uri-gil-2026-production.up.railway.app';

export default function LoginScreenWeb() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (emailError) setEmailError(null);
    if (error) setError(false);
  };

  const handleEmailBlur = () => {
    const trimmed = email.trim();
    if (trimmed && !isValidEmail(trimmed)) {
      setEmailError('올바른 이메일 형식을 입력해주세요.');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      window.alert('이메일을 입력해주세요.');
      return;
    }

    if (!isValidEmail(trimmedEmail)) {
      setEmailError('올바른 이메일 형식을 입력해주세요.');
      return;
    }

    if (!password) {
      window.alert('비밀번호를 입력해주세요.');
      return;
    }

    if (password.length < 8) {
      window.alert('비밀번호는 8자 이상 입력해주세요.');
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
        setError(true);
        window.alert(extractErrorMessage(data, '이메일 또는 비밀번호를 확인해주세요.'));
        return;
      }

      await SecureStore.setItemAsync('access_token', data.access_token);
      await SecureStore.setItemAsync('user_id', String(data.user_id));
      await SecureStore.setItemAsync('nickname', data.nickname);

      const existingProfile = await getProfile();
      await updateProfile({
        ...existingProfile,
        nickname: data.nickname,
      });

      await hydrateCurrentTrip();

      useAuthStore.getState().setLoggedIn(true);

      router.replace('/(tabs)/home');
    } catch (err) {
      console.error(err);
      window.alert('서버와 연결할 수 없습니다. 인터넷 연결을 확인해주세요.');
    }
  };

  return (
    <main className="uri-auth-page">
      <style>{AUTH_STYLES}</style>

      <AuthHeader />

      <form onSubmit={handleLogin} className="uri-auth-form">
        <label>
          이메일
          <input
            value={email}
            onChange={(e) => handleEmailChange(e.target.value)}
            onBlur={handleEmailBlur}
            className={emailError || error ? 'uri-input-error' : ''}
            placeholder="example@email.com"
            type="email"
          />
        </label>
        {emailError && <small className="uri-error-message">{emailError}</small>}

        <label>
          비밀번호
          <div className="uri-password-wrap">
            <input
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(false);
              }}
              className={error ? 'uri-input-error' : ''}
              placeholder="비밀번호를 입력해주세요"
              type={showPassword ? 'text' : 'password'}
            />
            <IconButton label="비밀번호 표시" onClick={() => setShowPassword((v) => !v)}>
              <Feather name={showPassword ? 'eye-off' : 'eye'} size={19} color="#767676" />
            </IconButton>
          </div>
        </label>

        <button className="uri-app-button uri-wide-cta" type="submit">
          로그인
        </button>

        <button type="button" className="uri-forgot-link" onClick={() => router.push('/find-password')}>
          비밀번호를 잊으셨나요?
        </button>
      </form>

      <div className="uri-auth-foot">
        아직 계정이 없으신가요? <button onClick={() => router.push('/join')}>회원가입</button>
      </div>
    </main>
  );
}
