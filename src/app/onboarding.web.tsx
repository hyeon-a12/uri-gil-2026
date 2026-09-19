import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

/**
 * onboarding.tsx(네이티브, 가로 스와이프 캐러셀)의 웹 버전입니다.
 *
 * 팀에서 Manus로 만든 프로토타입 코드(App.tsx의 Intro/RouteMotif/LogoMark +
 * index.css)를 그대로 옮긴 버전입니다 — 이전 버전은 구조를 임의로 단순화
 * (feature-number/feature-icon/scroll-prompt/sticky CTA 등을 빠뜨림)했는데,
 * 이번엔 원본 마크업·클래스·문구·수치를 그대로 따랐습니다.
 *
 * 딱 하나만 원본과 다릅니다: 아이콘 라이브러리. 원본은 lucide-react를
 * 쓰는데, 이 프로젝트엔 없는 새 패키지라(package-lock.json 변경 시 예전에
 * 겪었던 EAS 빌드 emnapi 불일치 재발 우려 때문에 팀에서 새 의존성 추가를
 * 피하기로 함), 이미 설치된 @expo/vector-icons의 Feather/Ionicons/
 * MaterialCommunityIcons 중 시각적으로 가장 가까운 아이콘으로 1:1
 * 대응시켰습니다:
 *   ArrowDown→Feather arrow-down, ArrowRight→Feather arrow-right,
 *   Navigation→Feather navigation, Video→Feather video,
 *   Sparkles→Ionicons sparkles-outline, Coffee→Feather coffee,
 *   Camera→Feather camera, Mountain→MaterialCommunityIcons
 *   image-filter-hdr-outline, TreePine→MaterialCommunityIcons
 *   pine-tree-variant-outline.
 *
 * window.scrollY/IntersectionObserver는 브라우저 전용 API라 네이티브에서는
 * 쓸 수 없어 별도 파일(.web.tsx)로 분리했습니다.
 */

// 가입 화면(join.web.tsx)이 쓰는 것과 같은 실제 노션 개인정보처리방침 페이지입니다.
const PRIVACY_POLICY_URL = 'https://rectangular-random-c6d.notion.site/444eee87fea883bc854a81944d60553c';

const INTRO_STYLES = `
  /*
   * expo-font가 웹에 등록하는 폰트 family 이름은 "Pretendard"가 아니라
   * "Pretendard-Regular"/"Pretendard-Bold"처럼 굵기별 이름 그대로입니다.
   * 존재하지 않는 "Pretendard" 패밀리를 쓰면 조용히 sans-serif로 대체돼서
   * RN Text로 그려지는 다른 화면들과 글꼴이 달라 보였습니다 — 굵은 텍스트는
   * 전부 명시적으로 Pretendard-Bold/ExtraBold + font-weight:normal(가짜
   * 볼드 방지)로 바꿨습니다.
   */
  html { background: #eeeeee; }
  .uri-intro-page { position: relative; background: #fff; font-family: 'Pretendard-Regular', sans-serif; }
  .uri-app-button {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    min-height: 48px; padding: 0 18px; border-radius: 12px; background: #FF7F5C;
    color: #fff; font-size: 14px; font-family: 'Pretendard-Bold', sans-serif; font-weight: normal; letter-spacing: -0.02em;
    border: 0; cursor: pointer;
    transition: background 0.16s cubic-bezier(.23,1,.32,1);
  }
  .uri-app-button:hover { background: #E8613D; }
  .uri-app-button:active { transform: scale(0.97); }
  .uri-wide-cta { width: 100%; }
  .uri-logo-mark {
    position: relative; display: inline-block; width: 32px; height: 32px;
    border: 2px solid #222; border-radius: 50% 50% 50% 5px; transform: rotate(-45deg);
  }
  .uri-logo-mark span { position: absolute; width: 5px; height: 5px; border-radius: 50%; background: #FF7F5C; }
  .uri-logo-mark span:first-child { left: 7px; top: 7px; }
  .uri-logo-mark span:nth-child(2) { right: 6px; bottom: 8px; }
  .uri-logo-mark i { position: absolute; width: 10px; height: 1.5px; background: #FF7F5C; left: 10px; top: 14px; transform: rotate(43deg); transform-origin: left center; }
  .uri-logo-mark-small { width: 24px; height: 24px; border-width: 1.7px; }
  .uri-logo-mark-small span { width: 4px; height: 4px; }
  .uri-logo-mark-small span:first-child { left: 5px; top: 5px; }
  .uri-logo-mark-small span:nth-child(2) { right: 4px; bottom: 5px; }
  .uri-logo-mark-small i { width: 7px; left: 7px; top: 10px; }

  .uri-intro-route-motif {
    position: fixed; z-index: 1; top: 0; left: 50%; width: 390px; height: 100vh;
    transform: translateX(-50%); pointer-events: none; overflow: hidden;
  }
  .uri-intro-route-motif svg { width: 100%; height: 100%; }
  .uri-contour { fill: none; stroke: #ddd; stroke-width: 1; opacity: 0.56; }
  .uri-route-segment {
    fill: none; stroke: #FF7F5C; stroke-width: 1.6; stroke-linecap: round;
    stroke-dasharray: 200; stroke-dashoffset: 200;
    transition: stroke-dashoffset 0.7s cubic-bezier(.23,1,.32,1);
  }
  .uri-route-segment.draw { stroke-dashoffset: 0; }
  .uri-route-dot { fill: #FF7F5C; }
  .uri-motif-icon { position: absolute; color: #c7c7c7; opacity: 0.75; }
  .uri-motif-mountain { left: 39px; top: 31%; }
  .uri-motif-coffee { right: 51px; top: 44%; }
  .uri-motif-camera { left: 42px; top: 63%; }
  .uri-motif-tree { right: 31px; top: 78%; }

  .uri-intro-section { position: relative; z-index: 2; min-height: 100vh; display: flex; }
  .uri-intro-content { position: relative; width: 100%; padding: 48px 28px; box-sizing: border-box; }
  .uri-intro-hero { background: linear-gradient(180deg, #fff 0%, rgba(245,245,245,.92) 100%); }
  .uri-hero-content { display: flex; flex-direction: column; }
  .uri-brand-lockup { display: flex; align-items: center; gap: 10px; font-size: 21px; font-family: 'Pretendard-ExtraBold', sans-serif; font-weight: normal; letter-spacing: -0.07em; color: #222; }
  .uri-hero-copy { margin-top: 156px; }
  .uri-eyebrow { margin: 0 0 12px; color: #767676; font-size: 10px; font-family: 'Pretendard-Bold', sans-serif; font-weight: normal; letter-spacing: 0.13em; }
  .uri-hero-copy h1, .uri-feature-copy h2, .uri-closing-content h2 {
    margin: 0; font-size: 33px; line-height: 1.25; letter-spacing: -0.07em; font-family: 'Pretendard-Bold', sans-serif; font-weight: normal; color: #222;
  }
  .uri-hero-copy > p:last-child, .uri-feature-copy > p:last-child {
    margin: 17px 0 0; color: #767676; font-size: 14px; line-height: 1.65; letter-spacing: -0.03em;
  }
  .uri-scroll-prompt { display: flex; align-items: center; gap: 7px; margin-top: auto; color: #767676; font-size: 12px; }
  .uri-intro-feature { align-items: center; }
  .uri-feature-a { background: linear-gradient(180deg, rgba(245,245,245,.92), rgba(255,255,255,.96)); }
  .uri-feature-b { background: linear-gradient(180deg, rgba(255,255,255,.96), rgba(245,245,245,.92)); }
  .uri-feature-c { background: linear-gradient(180deg, rgba(245,245,245,.92), rgba(255,255,255,.96)); }
  .uri-feature-copy { padding-bottom: 86px; }
  .uri-feature-number { color: #aaa; font-size: 11px; font-family: 'Pretendard-Bold', sans-serif; font-weight: normal; letter-spacing: 0.13em; }
  .uri-feature-icon {
    display: grid; place-items: center; width: 52px; height: 52px; margin: 20px 0 84px;
    background: #fff; border: 1px solid #e9e9e9; border-radius: 18px; color: #222;
    box-shadow: 0 9px 22px rgba(34,34,34,.04);
  }
  .uri-reveal { opacity: 0; transform: translateY(30px); transition: opacity 0.6s cubic-bezier(.23,1,.32,1), transform 0.6s cubic-bezier(.23,1,.32,1); }
  .uri-reveal.in-view { opacity: 1; transform: none; }
  .uri-intro-closing { min-height: 86vh; align-items: center; background: linear-gradient(180deg, rgba(255,255,255,.96), #f5f5f5); }
  .uri-closing-content { text-align: center; padding: 64px 28px; }
  .uri-closing-content .uri-logo-mark { margin-bottom: 31px; }
  .uri-closing-content h2 { font-size: 30px; }
  .uri-closing-content p { margin: 14px 0 36px; color: #767676; font-size: 14px; }
  .uri-intro-sticky {
    position: fixed; z-index: 20; top: 0; left: 50%; display: flex; align-items: center;
    justify-content: space-between; width: 390px; height: 64px; padding: 0 22px;
    background: rgba(255,255,255,.92); border-bottom: 1px solid rgba(221,221,221,.7);
    backdrop-filter: blur(10px); transform: translate(-50%, -100%); opacity: 0;
    transition: transform 0.22s cubic-bezier(.23,1,.32,1), opacity 0.22s cubic-bezier(.23,1,.32,1);
  }
  .uri-intro-sticky.is-visible { transform: translate(-50%, 0); opacity: 1; }
  .uri-intro-sticky-brand { display: flex; align-items: center; gap: 8px; font-size: 16px; letter-spacing: -0.05em; color: #222; }
  .uri-intro-sticky-brand strong { font-family: 'Pretendard-Bold', sans-serif; font-weight: normal; }
  .uri-sticky-cta { height: 34px; padding: 0 14px; background: #FF7F5C; border: 0; border-radius: 9px; color: #fff; font-size: 12px; font-family: 'Pretendard-Bold', sans-serif; font-weight: normal; cursor: pointer; }
  .uri-intro-footer { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 0 28px 40px; background: #f5f5f5; }
  .uri-footer-link { background: none; border: 0; padding: 0; color: #767676; font-size: 11px; text-decoration: underline; cursor: pointer; }
  .uri-footer-copyright { margin: 0; color: #767676; font-size: 10px; }
`;

function LogoMark({ small = false }: { small?: boolean }) {
  return (
    <div className={`uri-logo-mark${small ? ' uri-logo-mark-small' : ''}`} aria-label="우리길 로고">
      <span />
      <span />
      <i />
    </div>
  );
}

function RouteMotif({ stage }: { stage: number }) {
  return (
    <div className="uri-intro-route-motif" aria-hidden="true">
      <svg viewBox="0 0 390 844" preserveAspectRatio="none">
        <path
          className="uri-contour"
          d="M-14 115C54 80 67 180 136 145S216 67 294 114s73 4 122-17M-22 530c79-31 111 27 162-3s42-74 111-44 68-15 151-45M-14 748c43-36 80 28 130 9s62-83 129-41 95-1 159-29"
        />
        <path className={`uri-route-segment${stage >= 1 ? ' draw' : ''}`} d="M76 170 C113 211, 161 226, 196 287" />
        <path className={`uri-route-segment${stage >= 2 ? ' draw' : ''}`} d="M196 287 C229 354, 167 411, 227 487" />
        <path className={`uri-route-segment${stage >= 3 ? ' draw' : ''}`} d="M227 487 C289 555, 248 645, 310 711" />
        <circle className="uri-route-dot" cx={76} cy={170} r={5} />
        <circle className="uri-route-dot" cx={196} cy={287} r={5} />
        <circle className="uri-route-dot" cx={227} cy={487} r={5} />
        <circle className="uri-route-dot" cx={310} cy={711} r={5} />
      </svg>
      <div className="uri-motif-icon uri-motif-mountain">
        <MaterialCommunityIcons name="image-filter-hdr-outline" size={20} color="#c7c7c7" />
      </div>
      <div className="uri-motif-icon uri-motif-coffee">
        <Feather name="coffee" size={18} color="#c7c7c7" />
      </div>
      <div className="uri-motif-icon uri-motif-camera">
        <Feather name="camera" size={18} color="#c7c7c7" />
      </div>
      <div className="uri-motif-icon uri-motif-tree">
        <MaterialCommunityIcons name="pine-tree-variant-outline" size={20} color="#c7c7c7" />
      </div>
    </div>
  );
}

export default function OnboardingScreenWeb() {
  const [sticky, setSticky] = useState(false);
  const [stage, setStage] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setSticky(y > 470);
      setStage(y > 2500 ? 3 : y > 1720 ? 2 : y > 920 ? 1 : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
          }
        });
      },
      { threshold: 0.22 },
    );

    root.querySelectorAll('.uri-reveal').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const goToLogin = () => router.replace('/login');

  return (
    <div className="uri-intro-page" ref={rootRef}>
      <style>{INTRO_STYLES}</style>

      <RouteMotif stage={stage} />

      <div className={`uri-intro-sticky${sticky ? ' is-visible' : ''}`}>
        <div className="uri-intro-sticky-brand">
          <LogoMark small />
          <strong>우리길</strong>
        </div>
        <button onClick={goToLogin} className="uri-sticky-cta">
          시작하기
        </button>
      </div>

      <section className="uri-intro-section uri-intro-hero">
        <div className="uri-intro-content uri-hero-content">
          <div className="uri-brand-lockup">
            <LogoMark />
            <span>우리길</span>
          </div>

          <div className="uri-hero-copy">
            <p className="uri-eyebrow">TRAVEL, YOUR WAY</p>
            <h1>
              여행의 모든 순간을
              <br />
              나만의 길로 남겨요.
            </h1>
            <p>
              머문 곳과 짧은 장면들이 모여
              <br />
              당신만의 여행 기록이 됩니다.
            </p>
          </div>

          <div className="uri-scroll-prompt">
            스크롤해서 알아보기 <Feather name="arrow-down" size={15} color="#767676" />
          </div>
        </div>
      </section>

      <section className="uri-intro-section uri-intro-feature uri-feature-a">
        <div className="uri-intro-content uri-reveal uri-feature-copy">
          <div className="uri-feature-number">01</div>
          <div className="uri-feature-icon">
            <Feather name="navigation" size={25} color="#222" />
          </div>
          <p className="uri-eyebrow">AUTOMATIC ROUTE</p>
          <h2>
            GPS로 다녀온 길을
            <br />
            자동으로 기록해요.
          </h2>
          <p>
            어디에 머물렀는지, 어떤 길을 걸었는지.
            <br />
            여행의 흐름을 놓치지 마세요.
          </p>
        </div>
      </section>

      <section className="uri-intro-section uri-intro-feature uri-feature-b">
        <div className="uri-intro-content uri-reveal uri-feature-copy">
          <div className="uri-feature-number">02</div>
          <div className="uri-feature-icon">
            <Feather name="video" size={25} color="#222" />
          </div>
          <p className="uri-eyebrow">SHORT CLIP</p>
          <h2>
            지나는 곳마다
            <br />
            짧은 영상을 남겨보세요.
          </h2>
          <p>
            오래 고민하지 않아도 괜찮아요.
            <br />
            마주친 순간을 가볍게 담아두세요.
          </p>
        </div>
      </section>

      <section className="uri-intro-section uri-intro-feature uri-feature-c">
        <div className="uri-intro-content uri-reveal uri-feature-copy">
          <div className="uri-feature-number">03</div>
          <div className="uri-feature-icon">
            <Ionicons name="sparkles-outline" size={25} color="#222" />
          </div>
          <p className="uri-eyebrow">TRIP STORY</p>
          <h2>
            기록과 클립이 모여
            <br />
            나만의 여행이 완성돼요.
          </h2>
          <p>
            흩어진 방문과 장면이 하나의 이야기로.
            <br />
            언제든 다시 꺼내볼 수 있어요.
          </p>
        </div>
      </section>

      <section className="uri-intro-section uri-intro-closing">
        <div className="uri-intro-content uri-reveal uri-closing-content">
          <LogoMark />
          <h2>
            지금 첫 여행을
            <br />
            시작해볼까요?
          </h2>
          <p>우리길과 함께 천천히, 더 깊이.</p>
          <button onClick={goToLogin} className="uri-app-button uri-wide-cta">
            시작하기 <Feather name="arrow-right" size={18} color="#fff" />
          </button>
        </div>
      </section>

      <footer className="uri-intro-footer">
        <button
          onClick={() => window.open(PRIVACY_POLICY_URL, '_blank', 'noopener')}
          className="uri-footer-link"
        >
          개인정보처리방침
        </button>
        <p className="uri-footer-copyright">© 2026 Uri-Gil</p>
      </footer>
    </div>
  );
}
