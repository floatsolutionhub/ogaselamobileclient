import { router, useLocalSearchParams } from "expo-router";
import { Formik } from "formik";
import { Mail } from "lucide-react-native";
import { useState } from "react";
import { Text, View } from "react-native";
import Toast from "react-native-toast-message";
import * as WebBrowser from "expo-web-browser";

import { LINKS } from "@/config/links";
import { FormField } from "@/components/FormField";
import { Logo } from "@/components/Logo";
import { OtpInput } from "@/components/OtpInput";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SheetScreen } from "@/components/SheetScreen";
import { SocialButton } from "@/components/SocialButton";
import { SocialSignInButtons } from "@/components/SocialSignInButtons";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/apiClient";
import { loginSchema } from "@/utils/validation";
import { loginOtpCopy } from "@/utils/loginOtp";
import type { LoginOtpSentResponse } from "@/services/auth";

type Step =
  | { name: "credentials" }
  | { name: "otp"; email: string; sent: LoginOtpSentResponse };

export default function SignInSheet() {
  const { requestLoginOtp, verifyLoginOtp } = useAuth();
  const [step, setStep] = useState<Step>({ name: "credentials" });
  const [submitting, setSubmitting] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState(false);
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();

  async function handleCredentialsSubmit(values: {
    email: string;
    password: string;
  }) {
    setSubmitting(true);
    try {
      const sent = await requestLoginOtp({
        email: values.email,
        password: values.password,
      });
      setStep({ name: "otp", email: values.email, sent });
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : "Something went wrong. Please try again.";
      Toast.show({ type: "error", text1: "Sign in failed", text2: message });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerify(step: Extract<Step, { name: "otp" }>) {
    if (otp.length !== 6) {
      setOtpError(true);
      return;
    }

    setSubmitting(true);
    setOtpError(false);
    try {
      await verifyLoginOtp({ email: step.email, code: otp });
      router.dismissTo((redirect as never) ?? "/(app)/home");
    } catch (error) {
      setOtpError(true);
      const message =
        error instanceof ApiError
          ? error.message
          : "Something went wrong. Please try again.";
      Toast.show({
        type: "error",
        text1: "Could not verify code",
        text2: message,
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (step.name === "otp") {
    return (
      <SheetScreen>
        <View className="items-center">
          <Logo size={40} />
          <Text className="mt-3 font-poppins-bold text-heading text-ink-900">
            {loginOtpCopy(step.sent).title}
          </Text>
          <Text className="mt-1 text-center font-poppins text-body text-ink-500">
            {loginOtpCopy(step.sent).message}
          </Text>
        </View>

        <View className="mt-6">
          <OtpInput
            value={otp}
            onChange={(value) => {
              setOtp(value);
              setOtpError(false);
            }}
            error={otpError}
          />
          {otpError ? (
            <Text className="mt-3 text-center font-poppins text-caption text-danger">
              That code doesn’t look right.
            </Text>
          ) : null}

          <View className="mt-6">
            <PrimaryButton
              label="Verify and continue"
              loading={submitting}
              onPress={() => handleVerify(step)}
            />
          </View>
        </View>

        <Text
          className="mb-4 mt-6 text-center font-poppins-semibold text-body text-brand-600"
          onPress={() => {
            setStep({ name: "credentials" });
            setOtp("");
            setOtpError(false);
          }}
        >
          Back to sign in
        </Text>
      </SheetScreen>
    );
  }

  return (
    <SheetScreen>
      <View className="items-center">
        <Logo size={40} />
        <Text className="mt-3 font-poppins-bold text-heading text-ink-900">
          Welcome back
        </Text>
        <Text className="mt-1 font-poppins text-body text-ink-500">
          Sign in to continue to Ogasela
        </Text>
      </View>

      <Formik
        initialValues={{ email: "", password: "" }}
        validationSchema={loginSchema}
        onSubmit={handleCredentialsSubmit}
      >
        {({
          handleChange,
          handleBlur,
          handleSubmit,
          values,
          errors,
          touched,
        }) => (
          <View className="mt-6">
            <FormField
              label="Email address"
              icon={Mail}
              placeholder="you@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              value={values.email}
              onChangeText={handleChange("email")}
              onBlur={handleBlur("email")}
              error={errors.email}
              touched={touched.email}
            />
            <FormField
              label="Password"
              secure
              placeholder="••••••••"
              value={values.password}
              onChangeText={handleChange("password")}
              onBlur={handleBlur("password")}
              error={errors.password}
              touched={touched.password}
            />

            <Text
              className="mb-5 text-right font-poppins-medium text-body text-brand-600"
              onPress={() =>
                router.replace({
                  pathname: "/(modals)/forgot-password",
                  params: { redirect },
                })
              }
            >
              Forgot password?
            </Text>

            <PrimaryButton
              label="Continue"
              loading={submitting}
              onPress={handleSubmit as () => void}
            />
          </View>
        )}
      </Formik>

      <View className="mb-4 mt-6 flex-row justify-center gap-1">
        <Text className="font-poppins text-body text-ink-500">
          Don’t have an account?
        </Text>
        <Text
          className="font-poppins-semibold text-body text-brand-600"
          onPress={() =>
            router.replace({
              pathname: "/(modals)/sign-up-step1",
              params: { redirect },
            })
          }
        >
          Sign up
        </Text>
      </View>
      <Text className="mb-4 text-center font-poppins text-caption leading-5 text-ink-500">
        By continuing, you agree to our{" "}
        <Text
          className="font-poppins-medium text-brand-600"
          onPress={() => WebBrowser.openBrowserAsync(LINKS.terms)}
        >
          Terms
        </Text>{" "}
        &{" "}
        <Text
          className="font-poppins-medium text-brand-600"
          onPress={() => WebBrowser.openBrowserAsync(LINKS.privacy)}
        >
          Privacy Policy
        </Text>
        .
      </Text>
      {/* <View className="mt-5 flex-row items-center gap-3">
        <View className="h-px flex-1 bg-brand-100" />
        <Text className="font-poppins text-caption text-ink-500">
          or continue with
        </Text>
        <View className="h-px flex-1 bg-brand-100" />
      </View> */}

      {/* <View className="mt-4 gap-3">
        <SocialButton
          provider="phone"
          label="Log in with phone number"
          onPress={() =>
            router.replace({
              pathname: "/(modals)/sign-in-phone",
              params: { redirect },
            })
          }
        />
        <SocialSignInButtons mode="signin" redirect={redirect} />
      </View> */}
    </SheetScreen>
  );
}
