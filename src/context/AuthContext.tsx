import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState, AppStateStatus } from "react-native";
import Toast from "react-native-toast-message";

import { env } from "@/config/env";
import { ApiError, getAccessToken, setAccessToken, setUnauthorizedHandler } from "@/lib/apiClient";
import * as tokenStorage from "@/lib/tokenStorage";
import * as authService from "@/services/auth";
import type { LoginOtpSentResponse } from "@/services/auth";
import * as meService from "@/services/me";
import type { CurrentUser, UserRole } from "@/types/api";

const ACCESS_TOKEN_KEY = "ogasela_access_token";
const REFRESH_TOKEN_KEY = "ogasela_refresh_token";
const CHECK_INTERVAL_MS = 15_000;

type AuthContextValue = {
  user: CurrentUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /**
   * Step 1 of sign-up (details already collected) + password/terms - registers the account, then
   * immediately requests a login OTP for it (registration itself issues no tokens). Returns the
   * masked contact info the code was sent to, same as requestLoginOtp - the caller navigates to
   * the OTP-entry screen with it exactly the same way a normal login would.
   */
  registerThenRequestLoginOtp: (input: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
    accountType: UserRole;
    businessName: string | null;
  }) => Promise<LoginOtpSentResponse>;
  /** Step 1 of login: phone-or-email + password. No tokens yet - returns the masked contact info a 6-digit code was sent to. */
  requestLoginOtp: (credentials: { email?: string; phone?: string; password: string }) => Promise<LoginOtpSentResponse>;
  /** Step 2: the code from requestLoginOtp/registerThenRequestLoginOtp. Completes sign-in on success. */
  verifyLoginOtp: (credentials: { email?: string; phone?: string; code: string }) => Promise<CurrentUser>;
  /** Google/Apple/Facebook: signs in, or creates a Seller account on first use. Resolves to whether the account is new. */
  signInWithSocial: (input: {
    provider: authService.SocialProvider;
    token: string;
    name: string | null;
  }) => Promise<{ user: CurrentUser; isNewUser: boolean }>;
  logout: (reason?: string) => Promise<void>;
  /** Re-fetches /me - call after a profile edit so `user` reflects it without waiting for the next app open. */
  refreshUser: () => Promise<void>;
  registerActivity: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function persistTokens(accessToken: string, refreshToken: string): Promise<void> {
  await Promise.all([
    tokenStorage.setItem(ACCESS_TOKEN_KEY, accessToken),
    tokenStorage.setItem(REFRESH_TOKEN_KEY, refreshToken),
  ]);
  setAccessToken(accessToken);
}

/** The server said no to this session - as opposed to the request never getting an answer. */
function isSessionRejected(error: unknown): boolean {
  return error instanceof ApiError && error.status >= 400 && error.status < 500;
}

async function clearTokens(): Promise<void> {
  // Even on native, a keychain/keystore write can fail for reasons outside our control - either
  // way, failing to clear the stored token shouldn't crash whatever caused this (an
  // expired-session redirect, a 401 handler, etc). setAccessToken(null) below still runs regardless.
  await Promise.all([
    tokenStorage.deleteItem(ACCESS_TOKEN_KEY).catch(() => {}),
    tokenStorage.deleteItem(REFRESH_TOKEN_KEY).catch(() => {}),
  ]);
  setAccessToken(null);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const lastActivityRef = useRef<number>(Date.now());
  const appState = useRef<AppStateStatus>(AppState.currentState);

  const logout = useCallback(async (reason?: string) => {
    const refreshToken = await tokenStorage.getItem(REFRESH_TOKEN_KEY);

    // Best-effort: clear the device's push token registration and revoke the refresh token
    // server-side, but never let either failure block the local sign-out.
    if (getAccessToken()) {
      await meService.setPushToken(null).catch(() => {});
    }
    if (refreshToken) {
      await authService.logout(refreshToken).catch(() => {});
    }

    await clearTokens();
    setUser(null);
    if (reason) {
      Toast.show({ type: "info", text1: "Signed out", text2: reason });
    }
  }, []);

  // Wired into apiClient so any 401 mid-request gets one silent refresh-and-retry, without
  // apiClient needing to import this context directly (would be circular).
  useEffect(() => {
    setUnauthorizedHandler(async () => {
      const storedRefreshToken = await tokenStorage.getItem(REFRESH_TOKEN_KEY);
      if (!storedRefreshToken) return false;

      try {
        const tokens = await authService.refresh(storedRefreshToken);
        await persistTokens(tokens.accessToken, tokens.refreshToken);
        return true;
      } catch (error) {
        // Only a refresh the server actually rejected ends the session - a dropped connection
        // mid-refresh shouldn't sign the user out.
        if (isSessionRejected(error)) {
          await clearTokens();
          setUser(null);
        }
        return false;
      }
    });

    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const accessToken = await tokenStorage.getItem(ACCESS_TOKEN_KEY);
        if (!accessToken) return;

        setAccessToken(accessToken);
        const me = await meService.getCurrentUser();
        setUser(me);
      } catch (error) {
        // Access token expired and refresh (via the 401 handler above) also failed - start
        // signed out rather than stuck loading. Opening the app offline isn't that: keep the
        // tokens so the next launch with a connection is still signed in.
        if (isSessionRejected(error)) await clearTokens();
        else setAccessToken(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const completeLogin = useCallback(async (): Promise<CurrentUser> => {
    const me = await meService.getCurrentUser();
    setUser(me);
    lastActivityRef.current = Date.now();
    return me;
  }, []);

  const registerThenRequestLoginOtp = useCallback(
    async (input: {
      fullName: string;
      email: string;
      phone: string;
      password: string;
      accountType: UserRole;
      businessName: string | null;
    }): Promise<LoginOtpSentResponse> => {
      await authService.register({
        phone: input.phone,
        email: input.email,
        password: input.password,
        accountType: input.accountType,
        businessName: input.businessName,
        rcNumber: null,
        nin: null,
        name: input.fullName,
      });

      return authService.login({ phone: input.phone, password: input.password });
    },
    []
  );

  const requestLoginOtp = useCallback(
    (credentials: { email?: string; phone?: string; password: string }): Promise<LoginOtpSentResponse> => {
      // Any failure here (bad credentials, an internal-role account that must use admin/login, no
      // phone on file) surfaces the backend's own message as-is.
      return authService.login(credentials);
    },
    []
  );

  const verifyLoginOtp = useCallback(
    async (credentials: { email?: string; phone?: string; code: string }): Promise<CurrentUser> => {
      const tokens = await authService.verifyLoginOtp(credentials);
      await persistTokens(tokens.accessToken, tokens.refreshToken);
      return completeLogin();
    },
    [completeLogin]
  );

  const signInWithSocial = useCallback(
    async (input: { provider: authService.SocialProvider; token: string; name: string | null }) => {
      // New accounts are Sellers, matching the app's own sign-up form.
      const result = await authService.socialLogin({ ...input, accountType: "Seller" });
      await persistTokens(result.accessToken, result.refreshToken);
      const me = await completeLogin();
      return { user: me, isNewUser: result.isNewUser };
    },
    [completeLogin]
  );

  const refreshUser = useCallback(async () => {
    const me = await meService.getCurrentUser();
    setUser(me);
  }, []);

  const registerActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  useEffect(() => {
    const timeoutMs = env.autoLogoutMinutes * 60_000;

    const maybeLogout = () => {
      if (!user) return;
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed >= timeoutMs) {
        logout("You were logged out after a period of inactivity.");
      }
    };

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === "active") {
        maybeLogout();
      }
      appState.current = nextState;
    });

    const interval = setInterval(maybeLogout, CHECK_INTERVAL_MS);

    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, [user, logout]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      registerThenRequestLoginOtp,
      requestLoginOtp,
      verifyLoginOtp,
      signInWithSocial,
      logout,
      refreshUser,
      registerActivity,
    }),
    [
      user,
      isLoading,
      registerThenRequestLoginOtp,
      requestLoginOtp,
      verifyLoginOtp,
      signInWithSocial,
      logout,
      refreshUser,
      registerActivity,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
