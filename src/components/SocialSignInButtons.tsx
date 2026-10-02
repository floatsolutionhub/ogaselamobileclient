import * as AppleAuthentication from "expo-apple-authentication";
import { router } from "expo-router";
import { View } from "react-native";
import Toast from "react-native-toast-message";

import { SocialButton } from "@/components/SocialButton";
import { useSocialSignIn } from "@/hooks/useSocialSignIn";
import { clearSignUpDraft } from "@/lib/signUpDraft";

type SocialSignInButtonsProps = {
  /** Only changes the wording - the API signs in an existing account or creates a new one either way. */
  mode: "signin" | "signup";
  redirect?: string;
};

/** Google, Apple (iOS only) and Facebook - the same one-tap flow on the sign-in and sign-up sheets. */
export function SocialSignInButtons({
  mode,
  redirect,
}: SocialSignInButtonsProps) {
  const { start, busy, appleAvailable } = useSocialSignIn(
    ({ user, isNewUser }) => {
      // Signed in another way - drop anything half-typed into the sign-up form.
      clearSignUpDraft();
      Toast.show({
        type: "success",
        text1: isNewUser ? "Welcome to Ogasela!" : "Welcome back",
        text2: isNewUser
          ? "Your account is ready. You can add your phone number and shop name in your profile."
          : (user.name ?? undefined),
      });
      router.dismissTo((redirect as never) ?? "/(app)/home");
    },
  );

  const verb = mode === "signup" ? "Sign up" : "Continue";

  return (
    <View className="gap-3">
      <SocialButton
        provider="google"
        label={`${verb} with Google`}
        loading={busy === "Google"}
        disabled={!!busy}
        onPress={() => start("Google")}
      />
      {appleAvailable ? (
        // Apple's own button, as its guidelines require.
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={
            mode === "signup"
              ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP
              : AppleAuthentication.AppleAuthenticationButtonType.CONTINUE
          }
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={16}
          style={{
            height: 50,
            width: "100%",
            opacity: busy && busy !== "Apple" ? 0.6 : 1,
          }}
          onPress={() => start("Apple")}
        />
      ) : null}
      <SocialButton
        provider="facebook"
        label={`${verb} with Facebook`}
        loading={busy === "Facebook"}
        disabled={!!busy}
        onPress={() => start("Facebook")}
      />
    </View>
  );
}
