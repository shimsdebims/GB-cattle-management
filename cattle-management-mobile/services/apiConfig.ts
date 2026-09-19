import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Resolves the API base URL without any hardcoded machine-specific address.
 *
 * Resolution order:
 *   1. EXPO_PUBLIC_API_URL             — explicit override (.env, CI, EAS secret)
 *   2. app.json → expo.extra.apiUrl    — committed per-project default
 *   3. Expo dev-server host            — auto-detects your LAN IP in dev
 *   4. Platform localhost fallback     — 10.0.2.2 on Android emulator
 *
 * Step 3 is what removes the old `YOUR_LAN_IP` chore: when you run `expo start`,
 * Metro already knows the host your phone used to load the bundle, so the API
 * lives at that same host on the backend port.
 */

const API_PORT = 8080;
const API_PATH = '/api';

function normalize(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, '');
  return trimmed.endsWith(API_PATH) ? trimmed : `${trimmed}${API_PATH}`;
}

/** Host that served the JS bundle, e.g. "192.168.100.38:8081". Dev only. */
function devServerHost(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    // Older/bare workflows expose it here instead.
    (Constants.expoGoConfig as { debuggerHost?: string } | undefined)?.debuggerHost;

  if (!hostUri) return null;

  const host = hostUri.split(':')[0];
  if (!host || host === 'localhost' || host === '127.0.0.1') return null;

  return host;
}

function localhostFallback(): string {
  // Android emulators cannot reach the host machine via "localhost".
  const host = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
  return `http://${host}:${API_PORT}`;
}

function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return normalize(fromEnv);

  const fromExtra = Constants.expoConfig?.extra?.apiUrl as string | undefined;
  if (fromExtra) return normalize(fromExtra);

  if (__DEV__) {
    const host = devServerHost();
    if (host) return normalize(`http://${host}:${API_PORT}`);
  }

  return normalize(localhostFallback());
}

export const API_BASE_URL = resolveBaseUrl();

export const API_TIMEOUT_MS = 15000;
