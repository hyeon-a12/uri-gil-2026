import { Alert as RNAlert, Platform } from 'react-native';

type AlertButton = {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

type AlertOptions = {
  cancelable?: boolean;
  onDismiss?: () => void;
};

/**
 * Alert.alert의 웹 대응 버전. 네이티브에서는 기존 Alert.alert 그대로 동작하고,
 * 웹에서는 브라우저 기본 팝업(window.alert / window.confirm)으로 대체합니다.
 * 버튼이 1개 이하면 alert, 2개 이상이면 confirm으로 매핑합니다.
 * (웹은 커스텀 버튼 3개 이상을 지원하지 않아 확인/취소 개념으로 단순화합니다.
 * options(4번째 인자)는 네이티브 전용 설정이라 웹에서는 사용하지 않습니다.)
 */
export function showAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[],
  options?: AlertOptions,
) {
  if (Platform.OS !== 'web') {
    RNAlert.alert(title, message, buttons, options);
    return;
  }

  const fullMessage = message ? message : title;

  if (!buttons || buttons.length <= 1) {
    window.alert(fullMessage);
    buttons?.[0]?.onPress?.();
    return;
  }

  const confirmButton =
    buttons.find((b) => b.style === 'destructive') ??
    buttons[buttons.length - 1];
  const cancelButton = buttons.find((b) => b.style === 'cancel');

  if (window.confirm(fullMessage)) {
    confirmButton?.onPress?.();
  } else {
    cancelButton?.onPress?.();
  }
}

/**
 * react-native의 Alert 모듈과 동일한 인터페이스를 가진 객체.
 * 이걸 Alert 대신 import하면, 코드 한 줄도 안 바꾸고 웹 대응이 됩니다.
 */
export const Alert = {
  alert: showAlert,
};