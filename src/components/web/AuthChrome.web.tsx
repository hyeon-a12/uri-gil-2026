import type { ReactNode } from 'react';
import { Feather } from '@expo/vector-icons';

/**
 * login.web.tsx / join.web.tsx가 같이 쓰는 UI 조각입니다. 팀이 Manus로 만든
 * 프로토타입(App.tsx의 AuthHeader/IconButton + index.css)을 그대로 옮겼습니다.
 * 로고 모양(LogoMark)은 onboarding.web.tsx에도 똑같이 정의돼 있는데, 파일마다
 * 독립적으로 <style> 태그를 주입하는 구조라 일부러 중복해서 정의했습니다
 * (공유 모듈로 뽑으면 import 순서에 따라 스타일 주입 시점이 꼬일 수 있어서,
 * 이 정도 중복은 감수하는 쪽을 택했습니다).
 */

// expo-font가 웹에 등록하는 폰트 family 이름은 "Pretendard"가 아니라
// "Pretendard-Regular"/"Pretendard-Bold"처럼 굵기별 이름 그대로입니다.
// 존재하지 않는 "Pretendard" 패밀리를 쓰면 조용히 sans-serif로 대체돼서
// RN Text로 그려지는 다른 화면들과 글꼴이 달라 보였습니다 — 굵은 텍스트는
// 전부 명시적으로 Pretendard-Bold/SemiBold/Medium + font-weight:normal
// (가짜 볼드 방지)로 바꿨습니다.
export const AUTH_STYLES = `
  .uri-logo-mark {
    position: relative; display: inline-block; width: 32px; height: 32px;
    border: 2px solid #222; border-radius: 50% 50% 50% 5px; transform: rotate(-45deg);
  }
  .uri-logo-mark span { position: absolute; width: 5px; height: 5px; border-radius: 50%; background: #FF7F5C; }
  .uri-logo-mark span:first-child { left: 7px; top: 7px; }
  .uri-logo-mark span:nth-child(2) { right: 6px; bottom: 8px; }
  .uri-logo-mark i {
    position: absolute; width: 9px; height: 6px; left: 10.5px; top: 12.5px;
    background: none; border: 1.5px solid transparent; border-top: none;
    border-bottom-color: #FF7F5C; border-radius: 50%;
    transform: rotate(45deg); transform-origin: center;
  }
  .uri-icon-button {
    width: 38px; height: 38px; border-radius: 12px; display: grid; place-items: center;
    color: #222; background: none; border: 0; cursor: pointer; transition: background 0.15s cubic-bezier(.23,1,.32,1);
  }
  .uri-icon-button:hover { background: #F5F5F5; }
  .uri-app-button {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    min-height: 48px; padding: 0 18px; border-radius: 12px; background: #FF7F5C;
    color: #fff; font-size: 14px; font-family: 'Pretendard-Bold', sans-serif; font-weight: normal; letter-spacing: -0.02em;
    border: 0; cursor: pointer; transition: background 0.16s cubic-bezier(.23,1,.32,1);
  }
  .uri-app-button:hover { background: #E8613D; }
  .uri-app-button:active { transform: scale(0.97); }
  .uri-app-button:disabled { background: #F5F5F5; color: #767676; cursor: not-allowed; }
  .uri-wide-cta { width: 100%; }

  .uri-auth-page, .uri-signup-page {
    display: flex; flex-direction: column; min-height: 100vh; padding: 0 26px;
    background: #fff; box-sizing: border-box; font-family: 'Pretendard-Regular', sans-serif;
  }
  .uri-auth-logo { display: flex; flex-direction: column; align-items: center; padding-top: 112px; }
  .uri-auth-logo .uri-logo-mark { width: 42px; height: 42px; border-width: 2.5px; }
  .uri-auth-logo strong { margin-top: 14px; font-size: 26px; letter-spacing: -0.09em; color: #222; font-family: 'Pretendard-Bold', sans-serif; font-weight: normal; }
  .uri-auth-logo span { margin-top: 9px; color: #767676; font-size: 13px; }

  .uri-simple-header { display: grid; grid-template-columns: 38px 1fr 38px; align-items: center; height: 70px; margin: 0 -4px; }
  .uri-simple-header strong { text-align: center; font-size: 17px; letter-spacing: -0.05em; color: #222; font-family: 'Pretendard-Bold', sans-serif; font-weight: normal; }

  .uri-auth-form { display: flex; flex-direction: column; gap: 17px; margin-top: 74px; }
  .uri-auth-form label, .uri-field-stack label {
    display: flex; flex-direction: column; gap: 8px; color: #444; font-size: 13px;
    font-family: 'Pretendard-SemiBold', sans-serif; font-weight: normal; letter-spacing: -0.02em;
  }
  .uri-auth-form input, .uri-field-stack input {
    width: 100%; height: 50px; padding: 0 14px; border: 1px solid transparent; border-radius: 12px;
    background: #F5F5F5; color: #222;
    /* iOS 사파리는 포커스한 input의 font-size가 16px보다 작으면 화면을
       자동으로 확대합니다 — 16px 미만이면 이 화면들(로그인/회원가입)을
       열 때마다 입력창 탭할 때 갑자기 확대되어 보였습니다. */
    font-size: 16px;
    transition: border-color 0.16s; box-sizing: border-box; font-family: 'Pretendard-Regular', sans-serif;
  }
  .uri-auth-form input:focus, .uri-field-stack input:focus { border-color: #FF7F5C; outline: 0; }
  .uri-auth-form input.uri-input-error { border-color: #E14D3F; }
  .uri-auth-form input::placeholder, .uri-field-stack input::placeholder { color: #aaa; }
  .uri-password-wrap { position: relative; }
  .uri-password-wrap .uri-icon-button { position: absolute; top: 6px; right: 4px; color: #767676; }
  .uri-error-message { color: #E14D3F !important; }
  .uri-auth-form small, .uri-field-stack small { font-size: 11px; font-family: 'Pretendard-Medium', sans-serif; font-weight: normal; color: #767676; }
  .uri-forgot-link {
    align-self: center; margin-top: 3px; color: #767676; font-size: 12px;
    text-decoration: underline; text-underline-offset: 3px; background: none; border: 0; cursor: pointer;
  }
  .uri-auth-foot { margin-top: auto; padding: 36px 0 32px; color: #767676; font-size: 13px; text-align: center; }
  .uri-auth-foot button { color: #FF7F5C; font-family: 'Pretendard-Bold', sans-serif; font-weight: normal; background: none; border: 0; cursor: pointer; font-size: 13px; }

  .uri-signup-body { padding-top: 26px; }
  .uri-signup-lead { margin: 0 0 33px; font-size: 24px; line-height: 1.35; font-family: 'Pretendard-Bold', sans-serif; font-weight: normal; letter-spacing: -0.07em; color: #222; }
  .uri-field-stack { display: flex; flex-direction: column; gap: 19px; }
  .uri-terms { margin: 33px 0 29px; padding-top: 24px; border-top: 1px solid #eee; }
  .uri-terms > p { margin: 0 0 15px; font-size: 14px; font-family: 'Pretendard-Bold', sans-serif; font-weight: normal; color: #222; }
  .uri-all-agree-row { display: flex; align-items: center; gap: 9px; height: 34px; color: #222; font-size: 13px; font-family: 'Pretendard-Bold', sans-serif; font-weight: normal; }
  .uri-term-divider { height: 1px; margin: 10px 0; background: #eee; }
  .uri-term-row { display: flex; align-items: center; gap: 9px; height: 31px; color: #555; font-size: 12px; }
  .uri-check-box {
    display: grid; place-items: center; flex: none; width: 19px; height: 19px;
    border: 1px solid #c8c8c8; border-radius: 6px; color: #fff; background: none; cursor: pointer; padding: 0;
  }
  .uri-check-box.uri-checked { border-color: #FF7F5C; background: #FF7F5C; }
  .uri-view-link {
    margin-left: auto; color: #767676; font-size: 11px; text-decoration: underline;
    text-underline-offset: 3px; background: none; border: 0; cursor: pointer;
  }
`;

export function LogoMark({ small = false }: { small?: boolean }) {
  return (
    <div className="uri-logo-mark" aria-label="우리길 로고" style={small ? { width: 24, height: 24, borderWidth: 1.7 } : undefined}>
      <span />
      <span />
      <i />
    </div>
  );
}

export function IconButton({
  label,
  onClick,
  children,
  className = '',
}: {
  label: string;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button aria-label={label} onClick={onClick} className={`uri-icon-button ${className}`}>
      {children}
    </button>
  );
}

export function AuthHeader({ title, back }: { title?: string; back?: () => void }) {
  if (!title) {
    return (
      <div className="uri-auth-logo">
        <LogoMark />
        <strong>우리길</strong>
        <span>나만의 여행을 기록하는 방법</span>
      </div>
    );
  }

  return (
    <header className="uri-simple-header">
      <IconButton label="뒤로가기" onClick={back}>
        <Feather name="chevron-left" size={22} color="#222" />
      </IconButton>
      <strong>{title}</strong>
      <span />
    </header>
  );
}
