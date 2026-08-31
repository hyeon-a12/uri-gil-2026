import React, { useMemo, useState } from 'react';
import { StyleSheet, View, ActivityIndicator, Text } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

/**
 * ─────────────────────────────────────────────────────────────
 * 왜 WebView + 실제로 호스팅된 페이지인가
 * ─────────────────────────────────────────────────────────────
 * @react-native-kakao/map 같은 네이티브 SDK는 development build가
 * 필요해서 Expo Go에서 바로 못 씁니다. 카카오맵 JavaScript SDK를
 * WebView에 로드하는 방식은 react-native-webview(이미 설치돼 있음)만
 * 으로 Expo Go에서도 동작해서 이 방식을 씁니다.
 *
 * 처음에는 `source={{ html, baseUrl }}`로 페이지를 즉석에서 만들어
 * 넘겼는데, iOS의 WKWebView는 이 방식(loadHTMLString)일 때 하위
 * 리소스 요청(카카오 SDK <script>)에 baseUrl을 Referer로 제대로
 * 안 실어줍니다(Android의 loadDataWithBaseURL은 문제없음). 그래서
 * 카카오 디벨로퍼스의 "등록된 도메인" 검사를 iOS에서만 통과하지
 * 못했어요.
 *
 * 그래서 지도 페이지를 GitHub Pages에 실제로 올려두고, WebView가
 * `source={{ uri }}`로 "진짜 네트워크 요청"을 하도록 바꿨습니다.
 * 진짜 페이지 로드는 두 플랫폼 다 정상적인 Referer를 보내기 때문에
 * 문제가 없습니다. 지도에 표시할 핀/위치 등은 매번 이 페이지를 다시
 * 배포할 필요 없이 URL 쿼리 파라미터로 넘겨줍니다.
 *
 * 호스팅된 페이지 소스는 이 저장소 안의 docs/urigil-kakao-map/index.html
 * 이고, 이 저장소(uri-gil-2026)의 GitHub Pages(main 브랜치 /docs 폴더)로
 * 배포됩니다 — 더는 다른 개인 저장소에 의존하지 않습니다. 지도 페이지를
 * 고칠 땐 그 파일을 수정해서 main에 푸시하면 됩니다.
 *
 * 카카오 디벨로퍼스 콘솔 > 플랫폼 > Web에는 아래 MAP_PAGE_ORIGIN을
 * 등록해야 합니다(등록된 origin은 그대로라 이번 이전으로 재등록은 필요 없음).
 */

const MAP_PAGE_ORIGIN = 'https://hyeon-a12.github.io';
const MAP_PAGE_URL = `${MAP_PAGE_ORIGIN}/uri-gil-2026/urigil-kakao-map/`;

export type KakaoMapPin = {
  id: string;
  lat: number;
  lng: number;
  /** 핀 안에 넣을 텍스트 한 글자~두 글자 (예: 이니셜). 비우면 점만 표시 */
  label?: string;
  /** 핀 색상. 기본값은 앱 포인트 컬러 */
  color?: string;
};

export type KakaoMapCurrentLocation = {
  lat: number;
  lng: number;
};

type KakaoMapViewProps = {
  pins: KakaoMapPin[];
  height: number;
  /** expo-location으로 가져온 사용자 실제 GPS 위치. 있으면 지도 중심으로 쓰고
   * 파란 점(pulse) 마커로 따로 표시합니다. 아직 못 가져왔으면 null. */
  currentLocation?: KakaoMapCurrentLocation | null;
  /** 숫자가 작을수록 확대. 카카오맵 레벨 기본 범위는 1~14 */
  level?: number;
  /** 방문 경로 점선 색상 */
  pathColor?: string;
  /**
   * "내 위치로" 버튼을 누를 때마다 값을 증가시켜서 넘겨주세요. 위치 좌표가
   * 이전과 완전히 같으면(제자리에서 다시 누른 경우) URL 문자열도 바뀌지
   * 않아서 WebView가 재로드를 건너뛰는데, 이 토큰이 매번 URL을 바꿔줘서
   * 항상 재중심(recenter)이 실제로 일어나게 만듭니다. 또한 지도 페이지에
   * "핀 전체를 감싸지 말고 내 위치로만 중심을 옮겨라"라는 신호도 됩니다.
   */
  focusOnLocationToken?: number;
  /**
   * "내 위치로" 중심 이동 시, 지도 컨테이너의 기하학적 중앙 대신 이 값(px)
   * 만큼 위로 올려서 중심을 잡습니다. 바텀시트처럼 지도 아래쪽을 가리는
   * 오버레이가 있을 때, 내 위치 마커가 그 밑에 가려지지 않게 하기 위함입니다.
   */
  centerOffsetY?: number;
  onError?: (message: string) => void;
};

const DEFAULT_ACCENT = '#FF7F5C';

function buildMapUrl(
  pins: KakaoMapPin[],
  currentLocation: KakaoMapCurrentLocation | null | undefined,
  level: number,
  pathColor: string,
  focusOnLocationToken: number | undefined,
  centerOffsetY: number | undefined,
): string {
  const jsKey = process.env.EXPO_PUBLIC_KAKAO_JS_KEY ?? '';

  const params = new URLSearchParams({
    appkey: jsKey,
    pins: JSON.stringify(pins),
    level: String(level),
    pathColor,
  });

  if (currentLocation) {
    params.set('currentLocation', JSON.stringify(currentLocation));
  }

  if (focusOnLocationToken !== undefined) {
    params.set('centerMode', 'me');
    params.set('focusToken', String(focusOnLocationToken));

    if (centerOffsetY) {
      params.set('centerOffsetY', String(centerOffsetY));
    }
  }

  return `${MAP_PAGE_URL}?${params.toString()}`;
}

export default function KakaoMapView({
  pins,
  height,
  currentLocation,
  level = 4,
  pathColor = DEFAULT_ACCENT,
  focusOnLocationToken,
  centerOffsetY,
  onError,
}: KakaoMapViewProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mapUrl = useMemo(
    () => buildMapUrl(pins, currentLocation, level, pathColor, focusOnLocationToken, centerOffsetY),
    [pins, currentLocation, level, pathColor, focusOnLocationToken, centerOffsetY],
  );

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'console') {
        // 아래 injectedJavaScriptBeforeContentLoaded가 웹뷰 안의
        // console.log/warn/error를 전부 여기로 끌어옵니다 — 지도 페이지
        // 자체를 못 고치는 상황에서도(원격 배포된 페이지) Metro 터미널
        // 에서 실제로 무슨 일이 있었는지 볼 수 있어요.
        console.log('[KakaoMapView:console]', data.message);
      } else if (data.type === 'error') {
        console.warn('[KakaoMapView]', data.message);
        setErrorMessage(data.message);
        onError?.(data.message);
      } else if (data.type === 'ready') {
        setErrorMessage(null);
      }
    } catch {
      // 파싱 실패는 무시 — 지도 동작 자체엔 영향 없음
    }
  };

  return (
    <View style={[styles.container, { height }]}>
      <WebView
        originWhitelist={['*']}
        source={{ uri: mapUrl }}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        // 예전엔 여기서 androidLayerType="software"를 강제했습니다 — Android에서
        // WebView가 하드웨어 서피스로 그려져서 형제 뷰(홈 화면의 바텀시트 등)
        // 위로 겹쳐 보이는 문제 때문이었어요. 근데 'software'로 바꾸면 카카오맵이
        // 캔버스/WebGL로 그리는 실제 지도 부분이 흰 사각형으로 안 그려지는
        // 부작용이 있어서(배경 워터마크만 보이고 그 위 지도만 빈 흰 박스) 제거했습니다.
        // 대신 지도 위에 떠야 하는 형제 뷰들엔 zIndex뿐 아니라 elevation도
        // 같이 줘서(예: my-route.tsx의 mapControls, HomeScreen의 topBarWrapper)
        // 안드로이드에서도 확실히 지도 위로 올라오게 합니다.
        // 페이지 자체 스크립트가 실행되기 전에 console.*을 가로채서
        // RN 쪽으로 넘깁니다. injectedJavaScript(로드 후 실행)가 아니라
        // BeforeContentLoaded를 쓰는 이유: 우리 지도 페이지의 로그는
        // 페이지가 파싱되자마자 동기적으로 찍히기 때문에, 늦게 주입하면
        // 놓칩니다.
        injectedJavaScriptBeforeContentLoaded={`(function() {
          ['log', 'warn', 'error'].forEach(function (level) {
            var original = console[level];
            console[level] = function () {
              var args = Array.prototype.slice.call(arguments);
              var text = args.map(function (a) {
                try { return typeof a === 'string' ? a : JSON.stringify(a); }
                catch (e) { return String(a); }
              }).join(' ');
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'console', message: '[' + level + '] ' + text }));
              }
              original.apply(console, args);
            };
          });
          true;
        })();`}
        onMessage={handleMessage}
        onError={(event) => {
          const message = 'WebView 로드 실패: ' + event.nativeEvent.description;
          console.warn('[KakaoMapView]', message);
          setErrorMessage(message);
        }}
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={DEFAULT_ACCENT} />
          </View>
        )}
      />
      {errorMessage && (
        <View style={styles.errorBanner} pointerEvents="none">
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
  },
  errorBanner: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 8,
    padding: 10,
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 12,
  },
});
