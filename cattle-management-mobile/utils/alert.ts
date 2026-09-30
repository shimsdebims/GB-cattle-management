import { Alert as NativeAlert, Platform, type AlertButton } from 'react-native';

/**
 * Drop-in replacement for React Native's `Alert` that also works in a browser.
 *
 * On the web `Alert.alert` from react-native-web does nothing, so on the
 * iPhone (which runs the web build) every confirmation — delete, undo sale,
 * log out — and every error message was silently swallowed.
 *
 * On the web:
 *  - no buttons, or one        → window.alert, then that button's onPress
 *  - a cancel + an action      → window.confirm; OK runs the action,
 *                                Cancel runs the cancel button's onPress
 */
function webAlert(title: string, message?: string, buttons?: AlertButton[]): void {
  const text = message ? `${title}\n\n${message}` : title;
  const list = buttons ?? [];

  if (list.length <= 1) {
    window.alert(text);
    list[0]?.onPress?.();
    return;
  }

  const cancel = list.find((b) => b.style === 'cancel');
  // The first non-cancel button is the action; the app never offers more.
  const action = list.find((b) => b !== cancel);

  if (window.confirm(text)) action?.onPress?.();
  else cancel?.onPress?.();
}

export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[]): void {
    if (Platform.OS === 'web') webAlert(title, message, buttons);
    else NativeAlert.alert(title, message, buttons);
  },
};
