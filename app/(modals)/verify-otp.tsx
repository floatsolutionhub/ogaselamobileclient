import { router, useLocalSearchParams } from "expo-router";
import { Formik } from "formik";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import Toast from "react-native-toast-message";

import { FormField } from "@/components/FormField";
import { OtpInput } from "@/components/OtpInput";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SheetScreen } from "@/components/SheetScreen";
import { ApiError } from "@/lib/apiClient";
import * as authService from "@/services/auth";
import { resetPasswordSchema } from "@/utils/validation";

const RESEND_SECONDS = 60;

function maskPhone(phone: string): string {
  if (phone.length <= 4) return phone;
  return `${phone.slice(0, -4).replace(/[0-9]/g, "•")}${phone.slice(-4)}`;
}

function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 1) return email;
  return `${email[0]}${"•".repeat(Math.min(at - 1, 6))}${email.slice(at)}`;
}

export default function VerifyOtpSheet() {
  const params = useLocalSearchParams<{
    channel?: authService.PasswordResetChannel;
    destination?: string;
    /** Older links passed only the phone. */
    phone?: string;
    redirect?: string;
  }>();
  const channel: authService.PasswordResetChannel = params.channel ?? "Phone";
  const destination = params.destination ?? params.phone ?? "";
  const isEmail = channel === "Email";
  const [otp, setOtp] = useState("");
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const handleResend = async () => {
    if (secondsLeft > 0 || resending) return;
    setResending(true);
    try {
      await authService.requestPasswordReset(
        isEmail
          ? { channel: "Email", email: destination }
          : { channel: "Phone", phone: destination },
      );
      setOtp("");
      setError(false);
      setSecondsLeft(RESEND_SECONDS);
      Toast.show({
        type: "success",
        text1: "New code sent",
        text2: isEmail
          ? "Check your inbox for the new code."
          : "Check your phone for the new code.",
      });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Something went wrong. Please try again.";
      Toast.show({
        type: "error",
        text1: "Could not resend code",
        text2: message,
      });
    } finally {
      setResending(false);
    }
  };

  return (
    <SheetScreen scroll>
      <View className="items-center">
        <Text className="font-poppins-bold text-xl text-ink-900">
          Reset your password
        </Text>
        <Text className="mt-1 text-center font-poppins text-sm text-ink-500">
          If {isEmail ? maskEmail(destination) : maskPhone(destination)} belongs
          to an Ogasela account, we've sent a 6-digit code{" "}
          {isEmail ? "by email" : "by SMS"}. It expires in 5 minutes.
        </Text>
      </View>

      <View className="mt-6">
        <OtpInput
          value={otp}
          onChange={(value) => {
            setOtp(value);
            setError(false);
          }}
          error={error}
        />
        {error ? (
          <Text className="mt-3 text-center font-poppins text-xs text-danger">
            Enter the 6-digit code we sent you.
          </Text>
        ) : null}
      </View>

      <Formik
        initialValues={{ newPassword: "", confirmNewPassword: "" }}
        validationSchema={resetPasswordSchema}
        onSubmit={async (values) => {
          if (otp.length !== 6) {
            setError(true);
            return;
          }

          setSubmitting(true);
          try {
            await authService.confirmPasswordReset(
              isEmail ? { email: destination } : { phone: destination },
              otp,
              values.newPassword,
            );
            Toast.show({
              type: "success",
              text1: "Password reset",
              text2: "You can now sign in with your new password.",
            });
            router.replace({
              pathname: "/(modals)/sign-in",
              params: { redirect: params.redirect },
            });
          } catch (err) {
            const message =
              err instanceof ApiError
                ? err.message
                : "Something went wrong. Please try again.";
            Toast.show({
              type: "error",
              text1: "Could not reset password",
              text2: message,
            });
          } finally {
            setSubmitting(false);
          }
        }}
      >
        {({
          handleChange,
          handleBlur,
          handleSubmit,
          values,
          errors,
          touched,
        }) => (
          <View className="mt-5">
            <FormField
              label="New password"
              secure
              placeholder="At least 8 characters"
              value={values.newPassword}
              onChangeText={handleChange("newPassword")}
              onBlur={handleBlur("newPassword")}
              error={errors.newPassword}
              touched={touched.newPassword}
            />
            <FormField
              label="Confirm new password"
              secure
              placeholder="Re-enter your new password"
              value={values.confirmNewPassword}
              onChangeText={handleChange("confirmNewPassword")}
              onBlur={handleBlur("confirmNewPassword")}
              error={errors.confirmNewPassword}
              touched={touched.confirmNewPassword}
            />

            <View className="mt-1">
              <PrimaryButton
                label="Reset password"
                loading={submitting}
                onPress={handleSubmit as () => void}
              />
            </View>
          </View>
        )}
      </Formik>

      <View className="mb-4 mt-6 flex-row justify-center gap-1">
        <Text className="font-poppins text-sm text-ink-500">
          Didn't get a code?
        </Text>
        <Text
          className={`font-poppins-semibold text-sm ${
            secondsLeft > 0 || resending ? "text-ink-300" : "text-brand-600"
          }`}
          onPress={handleResend}
        >
          {secondsLeft > 0 ? `Resend in ${secondsLeft}s` : "Resend code"}
        </Text>
      </View>
    </SheetScreen>
  );
}
