import { useEffect, useState } from 'react';

import { ApiError, authAPI } from '../services/api';
import {
  AuthState,
  clearSession,
  getAuthState,
  markOpen,
  restoreSession,
  subscribeToAuth,
} from '../services/authStore';

export function useAuthState(): AuthState {
  const [state, setState] = useState<AuthState>(getAuthState);
  useEffect(() => subscribeToAuth(setState), []);
  return state;
}

/**
 * Decides at startup whether to show the login screen.
 *
 *  - A saved session opens the app at once, even offline; a 401 later sends
 *    the user back to login.
 *  - With no session, ask the server: login off → open the app; login on → show
 *    the login screen. Unreachable → open the app offline, since the server is
 *    the only place that can refuse the data.
 */
export async function bootstrapAuth(): Promise<void> {
  if (await restoreSession()) return;

  try {
    const { auth_required } = await authAPI.me();
    if (auth_required) await clearSession();
    else markOpen();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      await clearSession();
    } else {
      markOpen();
    }
  }
}
