import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Session state shared by the API client and the navigator.
 *
 * The token is kept in memory for synchronous access by the request
 * interceptor and persisted so the app opens straight in, even offline.
 */

export interface AuthUser {
  _id: string;
  username: string;
  role?: string;
}

export type AuthStatus = 'checking' | 'signedOut' | 'signedIn' | 'open';

export interface AuthState {
  status: AuthStatus;
  token: string | null;
  user: AuthUser | null;
}

const TOKEN_KEY = 'auth:token';
const USER_KEY = 'auth:user';

let state: AuthState = { status: 'checking', token: null, user: null };
const listeners = new Set<(s: AuthState) => void>();

const publish = (next: Partial<AuthState>) => {
  state = { ...state, ...next };
  listeners.forEach((l) => l(state));
};

export const getAuthState = (): AuthState => state;
export const getToken = (): string | null => state.token;

export function subscribeToAuth(listener: (s: AuthState) => void): () => void {
  listeners.add(listener);
  listener(state);
  return () => {
    listeners.delete(listener);
  };
}

/** Loads a saved session. Returns true when one was found. */
export async function restoreSession(): Promise<boolean> {
  try {
    const [token, user] = await Promise.all([
      AsyncStorage.getItem(TOKEN_KEY),
      AsyncStorage.getItem(USER_KEY),
    ]);
    if (token) {
      publish({ status: 'signedIn', token, user: user ? JSON.parse(user) : null });
      return true;
    }
  } catch (error) {
    console.warn('authStore: could not read the saved session', error);
  }
  return false;
}

export async function saveSession(token: string, user: AuthUser): Promise<void> {
  publish({ status: 'signedIn', token, user });
  try {
    await AsyncStorage.multiSet([
      [TOKEN_KEY, token],
      [USER_KEY, JSON.stringify(user)],
    ]);
  } catch (error) {
    console.warn('authStore: could not save the session', error);
  }
}

/**
 * Drops the session. Queued offline changes are kept: they are sent after the
 * next login, so nothing typed while logged out of date is lost.
 */
export async function clearSession(): Promise<void> {
  publish({ status: 'signedOut', token: null, user: null });
  try {
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
  } catch (error) {
    console.warn('authStore: could not clear the session', error);
  }
}

/** The server does not require login yet (AUTH_REQUIRED=false). */
export const markOpen = () => publish({ status: 'open' });
