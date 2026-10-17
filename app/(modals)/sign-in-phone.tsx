import { router, useLocalSearchParams } from "expo-router";
import { Formik } from "formik";
import { Phone } from "lucide-react-native";
import { useState } from "react";
import { Text, View } from "react-native";
import Toast from "react-native-toast-message";

import { FormField } from "@/components/FormField";
import { OtpInput } from "@/components/OtpInput";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SheetScreen } from "@/components/SheetScreen";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/apiClient";
import { colors } from "@/theme/colors";
import { phonePasswordLoginSchema } from "@/utils/validation";
import { ICON } from "@/theme/typography";
import { loginOtpCopy } from "@/utils/loginOtp";
import type { LoginOtpSentResponse } from "@/services/auth";

type Step =
  | { name: "credentials" }
  | { name: "otp"; phone: string; sent: LoginOtpSentResponse };

export default function SignInPhoneSheet() {
  const { requestLoginOtp, verifyLoginOtp } = useAuth();
  const [step, setStep] = useState<Step>({ name: "credentials" });
  const [submitting, setSubmitting] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState(false);
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();

  async function handleCredentialsSubmit(values: {
    phone: string;
    password: string;
  }) {
    setSubmitting(true);
    try {
      const sent = await requestLoginOtp({
        phone: values.phone,
        password: values.password,
      });
      setStep({ name: "otp", phone: values.phone, sent });
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
      await verifyLoginOtp({ phone: step.phone, code: otp });
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
          <View className="h-12 w-12 items-center justify-center rounded-2xl bg-brand-50">
            <Phone size={ICON.lg} color={colors.brand600} />
          </View>
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
          Back
        </Text>
      </SheetScreen>
    );
  }

  return (
    <SheetScreen>
      <View className="items-center">
        <View className="h-12 w-12 items-center justify-center rounded-2xl bg-brand-50">
          <Phone size={ICON.lg} color={colors.brand600} />
        </View>
        <Text className="mt-3 font-poppins-bold text-heading text-ink-900">
          Log in with phone
        </Text>
        <Text className="mt-1 text-center font-poppins text-body text-ink-500">
          Sign in with your phone number and password.
        </Text>
      </View>

      <Formik
        initialValues={{ phone: "", password: "" }}
        validationSchema={phonePasswordLoginSchema}
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
              label="Phone number"
              icon={Phone}
              placeholder="08012345678"
              keyboardType="number-pad"
              digitsOnly
              maxLength={11}
              value={values.phone}
              onChangeText={handleChange("phone")}
              onBlur={handleBlur("phone")}
              error={errors.phone}
              touched={touched.phone}
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
            <PrimaryButton
              label="Continue"
              loading={submitting}
              onPress={handleSubmit as () => void}
            />
          </View>
        )}
      </Formik>

      <Text
        className="mb-4 mt-5 text-center font-poppins-semibold text-body text-brand-600"
        onPress={() =>
          router.replace({
            pathname: "/(modals)/sign-in",
            params: { redirect },
          })
        }
      >
        Use email and password instead
      </Text>
    </SheetScreen>
  );
}
