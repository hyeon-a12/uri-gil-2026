import { router } from 'expo-router';
import { useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { extractErrorMessage } from '@/services/api';
import { isValidEmail } from '@/utils/validation';
import { AUTH_STYLES, AuthHeader, IconButton } from '@/components/web/AuthChrome.web';

/**
 * join.tsx(네이티브)의 웹 버전입니다. Manus 프로토타입의 Signup 화면
 * 디자인을 그대로 옮겼습니다.
 *
 * 딱 하나, 원본 프로토타입과 다르게 유지한 부분이 있습니다: 프로토타입은
 * 약관 체크박스가 2개("이용약관", "개인정보 처리방침")뿐인데, 우리 실제
 * 백엔드/약관 체계는 4개(서비스 이용약관 / 위치기반서비스 이용약관 /
 * 개인정보 수집·이용 / 만 14세 이상)를 요구합니다(네이티브 join.tsx와 동일).
 * 디자인 톤(체크박스·행 스타일)은 프로토타입 그대로 쓰되, 항목 개수는
 * 실제 정책·서버 요구사항에 맞춰 4개 + 전체동의 토글로 유지했습니다.
 *
 * 약관 "보기"도 프로토타입은 자체 바텀시트에 안내 문구를 띄우는데,
 * 우리는 실제 서비스/위치기반/개인정보 약관이 각각 별도의 실제 노션
 * 페이지로 존재해서(법적으로 필요한 진짜 약관 전문), 그 실제 페이지를
 * 새 탭으로 여는 기존 동작을 그대로 유지했습니다.
 */

const API_URL = 'https://uri-gil-2026-production.up.railway.app';

const SERVICE_TERMS_URL = 'https://rectangular-random-c6d.notion.site/3dbeee87fea8808a931bf3fa2b664655';
const LOCATION_TERMS_URL = 'https://rectangular-random-c6d.notion.site/3dbeee87fea88029b7d5e96126d03aba';
const PRIVACY_POLICY_URL = 'https://rectangular-random-c6d.notion.site/444eee87fea883bc854a81944d60553c';

export default function JoinScreenWeb() {
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [agreeService, setAgreeService] = useState(false);
  const [agreeLocation, setAgreeLocation] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeAge, setAgreeAge] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const handleEmailBlur = () => {
    const trimmed = email.trim();
    if (trimmed && !isValidEmail(trimmed)) {
      setEmailError('올바른 이메일 형식을 입력해주세요.');
    }
  };

  const requiredAgreed = agreeService && agreeLocation && agreePrivacy && agreeAge;

  const toggleAll = () => {
    const next = !requiredAgreed;
    setAgreeService(next);
    setAgreeLocation(next);
    setAgreePrivacy(next);
    setAgreeAge(next);
  };

  const openUrl = (url: string) => {
    window.open(url, '_blank', 'noopener');
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedNickname = nickname.trim();
    const trimmedEmail = email.trim();

    if (!trimmedNickname) {
      window.alert('닉네임을 입력해주세요.');
      return;
    }
    if (trimmedNickname.length < 2 || trimmedNickname.length > 10) {
      window.alert('닉네임은 2자 이상 10자 이하로 입력해주세요.');
      return;
    }
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
    if (!passwordConfirm) {
      window.alert('비밀번호 확인을 입력해주세요.');
      return;
    }
    if (password !== passwordConfirm) {
      window.alert('비밀번호가 일치하지 않습니다.');
      return;
    }
    if (!requiredAgreed) {
      window.alert('필수 약관에 모두 동의해주세요.');
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
          agreed_service: agreeService,
          agreed_privacy: agreePrivacy,
          agreed_age: agreeAge,
          terms_version: 'v1',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        window.alert(extractErrorMessage(data, '알 수 없는 오류가 발생했습니다.'));
        return;
      }

      window.alert('회원가입이 완료되었습니다.');
      router.replace('/login');
    } catch (err) {
      console.error(err);
      window.alert('서버와 연결할 수 없습니다. 인터넷 연결을 확인해주세요.');
    }
  };

  return (
    <main className="uri-signup-page">
      <style>{AUTH_STYLES}</style>

      <AuthHeader title="회원가입" back={() => router.back()} />

      <div className="uri-signup-body">
        <p className="uri-signup-lead">
          여행을 시작할
          <br />
          준비가 되셨나요?
        </p>

        <form onSubmit={handleJoin} className="uri-field-stack">
          <label>
            닉네임
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="2~10자로 입력해주세요"
              maxLength={10}
            />
          </label>

          <label>
            이메일
            <input
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError(null);
              }}
              onBlur={handleEmailBlur}
              className={emailError ? 'uri-input-error' : ''}
              placeholder="example@email.com"
              type="email"
            />
            {emailError && <small className="uri-error-message">{emailError}</small>}
          </label>

          <label>
            비밀번호
            <div className="uri-password-wrap">
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="8자 이상 입력해주세요"
                type={showPassword ? 'text' : 'password'}
              />
              <IconButton label="비밀번호 표시" onClick={() => setShowPassword((v) => !v)}>
                <Feather name={showPassword ? 'eye-off' : 'eye'} size={19} color="#767676" />
              </IconButton>
            </div>
          </label>

          <label>
            비밀번호 확인
            <div className="uri-password-wrap">
              <input
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                placeholder="비밀번호를 다시 입력해주세요"
                type={showPasswordConfirm ? 'text' : 'password'}
              />
              <IconButton label="비밀번호 확인 표시" onClick={() => setShowPasswordConfirm((v) => !v)}>
                <Feather name={showPasswordConfirm ? 'eye-off' : 'eye'} size={19} color="#767676" />
              </IconButton>
            </div>
            {passwordConfirm && passwordConfirm !== password && (
              <small className="uri-error-message">비밀번호가 일치하지 않아요</small>
            )}
          </label>

          <div className="uri-terms">
            <p>약관 동의</p>

            <div className="uri-all-agree-row">
              <button
                type="button"
                className={`uri-check-box${requiredAgreed ? ' uri-checked' : ''}`}
                onClick={toggleAll}
                aria-label="전체 동의"
              >
                {requiredAgreed && <Feather name="check" size={14} color="#fff" />}
              </button>
              <span>전체 동의</span>
            </div>

            <div className="uri-term-divider" />

            <TermRow
              checked={agreeService}
              onToggle={() => setAgreeService((v) => !v)}
              label="[필수] 서비스 이용약관 동의"
              onView={() => openUrl(SERVICE_TERMS_URL)}
            />
            <TermRow
              checked={agreeLocation}
              onToggle={() => setAgreeLocation((v) => !v)}
              label="[필수] 위치기반서비스 이용약관 동의"
              onView={() => openUrl(LOCATION_TERMS_URL)}
            />
            <TermRow
              checked={agreePrivacy}
              onToggle={() => setAgreePrivacy((v) => !v)}
              label="[필수] 개인정보 수집 및 이용 동의"
              onView={() => openUrl(PRIVACY_POLICY_URL)}
            />
            <TermRow
              checked={agreeAge}
              onToggle={() => setAgreeAge((v) => !v)}
              label="[필수] 만 14세 이상입니다."
            />
          </div>

          <button type="submit" className="uri-app-button uri-wide-cta">
            가입하기
          </button>
        </form>
      </div>
    </main>
  );
}

function TermRow({
  checked,
  onToggle,
  label,
  onView,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  onView?: () => void;
}) {
  return (
    <div className="uri-term-row">
      <button
        type="button"
        className={`uri-check-box${checked ? ' uri-checked' : ''}`}
        onClick={onToggle}
        aria-label={label}
      >
        {checked && <Feather name="check" size={14} color="#fff" />}
      </button>
      <span>{label}</span>
      {onView && (
        <button type="button" className="uri-view-link" onClick={onView}>
          보기
        </button>
      )}
    </div>
  );
}
