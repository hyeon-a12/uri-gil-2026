import { type PropsWithChildren } from 'react';

/**
 * Expo Router 웹 빌드의 기본 루트 HTML 문서를 커스터마이즈합니다.
 *
 * 기본 템플릿(expo-router가 자동 주입하는 ScrollViewStyleReset)은
 * `body { overflow: hidden }`을 강제로 걸어둡니다 — "RN 화면은 항상 한
 * 화면 안에 담기고, 스크롤이 필요하면 화면 안의 ScrollView가 알아서
 * 처리한다"는 걸 전제로 한 설정입니다. 그런데 이 프로젝트의 웹 온보딩
 * (src/app/onboarding.web.tsx)처럼 브라우저 문서 자체가 세로로 길게
 * 스크롤되는 화면을 추가하면서 이 전제가 깨졌습니다 — body가
 * overflow:hidden이면 문서 자체가 아예 스크롤이 안 됩니다.
 *
 * body의 overflow만 auto로 바꿔서, 기존처럼 한 화면 안에 다 들어가는
 * 화면들은 지금까지와 동일하게 보이고(스크롤바가 생길 콘텐츠가 없으므로),
 * 문서 스크롤이 실제로 필요한 화면만 정상적으로 스크롤되게 합니다.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="ko">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <style
          id="expo-reset"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: `#root,body,html{height:100%}body{overflow-y:auto}#root{display:flex}`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
