import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { setAccessToken, setUnauthorizedHandler } from './api-client';
import {
  fetchCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
  verifyMFA as verifyMFARequest,
  type AuthUser,
} from './auth-service';
import { clearTokens, loadTokens, saveTokens } from './storage';

type AuthStatus = 'loading' | 'unauthenticated' | 'mfaPending' | 'authenticated';

type AuthState = {
  status: AuthStatus;
  user: AuthUser | null;
  mfaChallengeToken: string | null;
};

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<{ mfaRequired: boolean }>;
  verifyMFA: (otp: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    status: 'loading',
    user: null,
    mfaChallengeToken: null,
  });

  const clearSession = useCallback(async () => {
    await clearTokens();
    setAccessToken(null);
    setState({ status: 'unauthenticated', user: null, mfaChallengeToken: null });
  }, []);

  const clearSessionRef = useRef(clearSession);
  useEffect(() => {
    clearSessionRef.current = clearSession;
  }, [clearSession]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      void clearSessionRef.current();
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const tokens = await loadTokens();
      if (!tokens) {
        if (!cancelled) {
          setState({ status: 'unauthenticated', user: null, mfaChallengeToken: null });
        }
        return;
      }
      setAccessToken(tokens.accessToken);
      try {
        const user = await fetchCurrentUser();
        if (!cancelled) {
          setState({ status: 'authenticated', user, mfaChallengeToken: null });
        }
      } catch {
        if (!cancelled) {
          await clearTokens();
          setAccessToken(null);
          setState({ status: 'unauthenticated', user: null, mfaChallengeToken: null });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await loginRequest({ email, password });

    if (result.status === 'mfaRequired') {
      setState({
        status: 'mfaPending',
        user: result.user,
        mfaChallengeToken: result.mfaChallengeToken,
      });
      return { mfaRequired: true };
    }

    await saveTokens({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
    setAccessToken(result.accessToken);
    setState({ status: 'authenticated', user: result.user, mfaChallengeToken: null });
    return { mfaRequired: false };
  }, []);

  const verifyMFA = useCallback(
    async (otp: string) => {
      if (!state.mfaChallengeToken) {
        throw new Error('No MFA challenge in progress');
      }
      const tokens = await verifyMFARequest(state.mfaChallengeToken, otp);
      await saveTokens(tokens);
      setAccessToken(tokens.accessToken);
      const user = state.user ?? (await fetchCurrentUser());
      setState({ status: 'authenticated', user, mfaChallengeToken: null });
    },
    [state.mfaChallengeToken, state.user],
  );

  const logout = useCallback(async () => {
    await logoutRequest();
    await clearSession();
  }, [clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, login, verifyMFA, logout }),
    [state, login, verifyMFA, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
