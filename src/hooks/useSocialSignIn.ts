import * as AppleAuthentication from "expo-apple-authentication";
import * as Facebook from "expo-auth-session/providers/facebook";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import Toast from "react-native-toast-message";

import { env } from "@/config/env";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/apiClient";
import type { SocialProvider } from "@/services/auth";
import type { CurrentUser } from "@/types/api";

// Lets the browser-based Google/Facebook flows hand control back to the app on web.
WebBrowser.maybeCompleteAuthSession();

// The provider hooks throw if their client id is blank, and hooks can't be skipped - so they get
// a placeholder and `isConfigured` keeps the placeholder from ever being used to prompt.
const NOT_CONFIGURED = "not-configured";

const googleConfigured =
  Platform.select({
    ios: !!env.googleIosClientId,
    android: !!env.googleAndroidClientId,
    default: !!env.googleWebClientId,
  }) ?? false;
const facebookConfigured = !!env.facebookAppId;

type SignedIn = { user: CurrentUser; isNewUser: boolean };

/**
 * Google, Apple and Facebook sign-in for the sign-in and sign-up sheets. Each provider gives the
 * app a token, which the API verifies before signing in (or creating the account).
 * `onSignedIn` runs after the session is stored; the caller decides where to navigate.
 */
export function useSocialSignIn(onSignedIn: (result: SignedIn) => void) {
  const { signInWithSocial } = useAuth();
  const [busy, setBusy] = useState<SocialProvider | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const onSignedInRef = useRef(onSignedIn);
  onSignedInRef.current = onSignedIn;

  const [, googleResponse, promptGoogle] = Google.useIdTokenAuthRequest({
    iosClientId: env.googleIosClientId || NOT_CONFIGURED,
    androidClientId: env.googleAndroidClientId || NOT_CONFIGURED,
    webClientId: env.googleWebClientId || NOT_CONFIGURED,
  });

  const [, facebookResponse, promptFacebook] = Facebook.useAuthRequest({
    clientId: env.facebookAppId || NOT_CONFIGURED,
    scopes: ["public_profile", "email"],
  });

  useEffect(() => {
    // Sign in with Apple is iOS-only here (Android would need Apple's web flow and a Services ID).
    if (Platform.OS !== "ios") return;
    AppleAuthentication.isAvailableAsync()
      .then(setAppleAvailable)
      .catch(() => setAppleAvailable(false));
  }, []);

  const complete = useCallback(
    async (provider: SocialProvider, token: string, name: string | null) => {
      try {
        const result = await signInWithSocial({ provider, token, name });
        onSignedInRef.current(result);
      } catch (err) {
        Toast.show({
          type: "error",
          text1: `${provider} sign-in failed`,
          text2: err instanceof ApiError ? err.message : "Please try again.",
        });
      } finally {
        setBusy(null);
      }
    },
    [signInWithSocial],
  );

  useEffect(() => {
    if (!googleResponse) return;
    if (googleResponse.type === "success" && googleResponse.params.id_token) {
      complete("Google", googleResponse.params.id_token, null);
    } else {
      if (googleResponse.type === "error") {
        Toast.show({
          type: "error",
          text1: "Google sign-in failed",
          text2: "Please try again.",
        });
      }
      setBusy(null);
    }
  }, [googleResponse, complete]);

  useEffect(() => {
    if (!facebookResponse) return;
    const accessToken =
      facebookResponse.type === "success"
        ? (facebookResponse.authentication?.accessToken ??
          facebookResponse.params.access_token)
        : undefined;
    if (accessToken) {
      complete("Facebook", accessToken, null);
    } else {
      if (facebookResponse.type === "error") {
        Toast.show({
          type: "error",
          text1: "Facebook sign-in failed",
          text2: "Please try again.",
        });
      }
      setBusy(null);
    }
  }, [facebookResponse, complete]);

  const notAvailable = (provider: SocialProvider) =>
    Toast.show({
      type: "info",
      text1: `${provider} sign-in isn't available yet`,
      text2: "Please use your email or phone number for now.",
    });

  const start = useCallback(
    async (provider: SocialProvider) => {
      if (busy) return;

      if (provider === "Google") {
        if (!googleConfigured) return notAvailable(provider);
        setBusy(provider);
        await promptGoogle();
        return;
      }

      if (provider === "Facebook") {
        if (!facebookConfigured) return notAvailable(provider);
        setBusy(provider);
        await promptFacebook();
        return;
      }

      setBusy(provider);
      try {
        const credential = await AppleAuthentication.signInAsync({
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
        });
        if (!credential.identityToken) {
          setBusy(null);
          return;
        }
        // Apple only shares the name on the very first sign-in, and never inside the token.
        const name =
          [credential.fullName?.givenName, credential.fullName?.familyName]
            .filter(Boolean)
            .join(" ") || null;
        await complete("Apple", credential.identityToken, name);
      } catch (err) {
        setBusy(null);
        if ((err as { code?: string }).code !== "ERR_REQUEST_CANCELED") {
          Toast.show({
            type: "error",
            text1: "Apple sign-in failed",
            text2: "Please try again.",
          });
        }
      }
    },
    [busy, promptGoogle, promptFacebook, complete],
  );

  return { start, busy, appleAvailable };
}
