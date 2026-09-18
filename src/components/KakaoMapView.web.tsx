import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * KakaoMapView.tsx의 웹 버전입니다. 네이티브는 react-native-webview로 지도
 * 페이지(GitHub Pages에 호스팅된 docs/urigil-kakao-map/index.html)를 불러오는데,
 * react-native-webview 자체가 웹 플랫폼을 지원하지 않아 그대로 쓸 수 없습니다.
 *
 * 다행히 그 지도 페이지는 애초에 순수 웹 페이지라(WebView 전용 API에 기대지
 * 않음), 웹에서는 같은 URL을 <iframe>으로 그대로 불러오면 됩니다 — 지도
 * 페이지 자체는 수정할 필요가 없습니다. panTo만 WebView의 postMessage 대신
 * iframe.contentWindow.postMessage로 보냅니다(지도 페이지가 이미 두 경우 모두
 * window의 'message' 이벤트로 받도록 구현돼 있어 페이지 쪽 코드는 그대로 동작).
 *
 * 다만 지도 페이지의 ready/error 알림은 window.ReactNativeWebView가 있을
 * 때만 전송되고, 없으면(iframe 포함) 화면 하단 디버그 오버레이로만 표시하도록
 * 만들어져 있어 — 이 컴포넌트에서는 그 알림을 받아 에러 배너로 보여주는 기능은
 * 생략했습니다(핵심 지도 표시 자체와는 무관한 부가 기능이라 이번 범위에서 제외).
 */

const MAP_PAGE_ORIGIN = 'https://hyeon-a12.github.io';
const MAP_PAGE_URL = `${MAP_PAGE_ORIGIN}/uri-gil-2026/urigil-kakao-map/`;

export type KakaoMapPin = {
  id: string;
  lat: number;
  lng: number;
  label?: string;
  color?: string;
  excludeFromPath?: boolean;
};

export type KakaoMapCurrentLocation = {
  lat: number;
  lng: number;
};

type KakaoMapViewProps = {
  pins: KakaoMapPin[];
  height: number;
  currentLocation?: KakaoMapCurrentLocation | null;
  level?: number;
  pathColor?: string;
  focusOnLocationToken?: number;
  centerOffsetY?: number;
  onError?: (message: string) => void;
};

export type KakaoMapViewHandle = {
  panTo: (lat: number, lng: number) => void;
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

const KakaoMapView = forwardRef<KakaoMapViewHandle, KakaoMapViewProps>(function KakaoMapView({
  pins,
  height,
  currentLocation,
  level = 4,
  pathColor = DEFAULT_ACCENT,
  focusOnLocationToken,
  centerOffsetY,
}, ref) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      panTo: (lat: number, lng: number) => {
        iframeRef.current?.contentWindow?.postMessage(
          JSON.stringify({ type: 'panTo', lat, lng }),
          '*',
        );
      },
    }),
    [],
  );

  const mapUrl = useMemo(
    () => buildMapUrl(pins, currentLocation, level, pathColor, focusOnLocationToken, centerOffsetY),
    [pins, currentLocation, level, pathColor, focusOnLocationToken, centerOffsetY],
  );

  return (
    <View style={[styles.container, { height }]}>
      <iframe
        ref={iframeRef}
        src={mapUrl}
        title="우리길 지도"
        style={{ width: '100%', height: '100%', border: 'none' }}
        allow="geolocation"
      />
    </View>
  );
});

export default KakaoMapView;

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
  },
});
