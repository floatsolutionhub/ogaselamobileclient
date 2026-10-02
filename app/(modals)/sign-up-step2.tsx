import { router, useLocalSearchParams } from "expo-router";
import { Formik } from "formik";
import { ChevronLeft, Store } from "lucide-react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Toast from "react-native-toast-message";

import { FormField } from "@/components/FormField";
import { OtpInput } from "@/components/OtpInput";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SheetScreen } from "@/components/SheetScreen";
import { TermsCheckbox } from "@/components/TermsCheckbox";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/apiClient";
import {
  clearSignUpDraft,
  getSignUpDraft,
  updateSignUpDraft,
} from "@/lib/signUpDraft";
import { colors } from "@/theme/colors";
import { registerStepTwoSchema } from "@/utils/validation";

type Step =
  | { name: "details" }
  | { name: "otp"; maskedEmail: string; maskedPhone: string };

export default function SignUpStepTwoSheet() {
  const { registerThenRequestLoginOtp, verifyLoginOtp } = useAuth();
  const [step, setStep] = useState<Step>({ name: "details" });
  const [submitting, setSubmitting] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState(false);
  const params = useLocalSearchParams<{
    fullName?: string;
    email?: string;
    phone?: string;
    redirect?: string;
  }>();
  const draft = getSignUpDraft();
  // Step 1's answers come from the route params; the draft covers anything that lost them.
  const fullName = params.fullName || draft.fullName;
  const email = params.email || draft.email;
  const phone = params.phone || draft.phone;
  const redirect = params.redirect;

  const goToPreviousStep = (values: {
    businessName: string;
    password: string;
    confirmPassword: string;
    acceptedTerms: boolean;
  }) => {
    // Keep what was typed here too, so returning to this step shows it again.
    updateSignUpDraft(values);
    router.replace({
      pathname: "/(modals)/sign-up-step1",
      params: { redirect },
    });
  };

  async function handleVerify() {
    if (otp.length !== 6) {
      setOtpError(true);
      return;
    }

    setSubmitting(true);
    setOtpError(false);
    try {
      const user = await verifyLoginOtp({ phone, code: otp });
      clearSignUpDraft();
      Toast.show({
        type: "success",
        text1: "Account created",
        text2: `Welcome to Ogasela, ${user.name?.split(" ")[0] ?? "there"}!`,
      });
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
          <Text className="font-poppins-bold text-xl text-ink-900">
            Enter your code
          </Text>
          <Text className="mt-1 text-center font-poppins text-sm text-ink-500">
            We sent a 6-digit code to {step.maskedEmail} and {step.maskedPhone}
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
            <Text className="mt-3 text-center font-poppins text-xs text-danger">
              That code doesn't look right.
            </Text>
          ) : null}

          <View className="mt-6">
            <PrimaryButton
              label="Verify and continue"
              loading={submitting}
              onPress={handleVerify}
            />
          </View>
        </View>
      </SheetScreen>
    );
  }

  return (
    <SheetScreen>
      <View className="items-center">
        <Text className="font-poppins-bold text-xl text-ink-900">
          Secure your account
        </Text>
        <Text className="mt-1 text-center font-poppins text-sm text-ink-500">
          Step 2 of 2 · Almost there, {fullName?.split(" ")[0] || "there"}
        </Text>
      </View>

      <View className="mt-5 flex-row gap-2">
        <View className="h-1.5 flex-1 rounded-full bg-brand-500" />
        <View className="h-1.5 flex-1 rounded-full bg-brand-500" />
      </View>

      <Formik
        initialValues={{
          businessName: draft.businessName,
          password: draft.password,
          confirmPassword: draft.confirmPassword,
          acceptedTerms: draft.acceptedTerms,
        }}
        validationSchema={registerStepTwoSchema}
        onSubmit={async (values) => {
          setSubmitting(true);
          try {
            const { maskedEmail, maskedPhone } =
              await registerThenRequestLoginOtp({
                fullName,
                email,
                phone,
                password: values.password,
                accountType: "Seller",
                businessName: values.businessName,
              });
            setStep({ name: "otp", maskedEmail, maskedPhone });
          } catch (error) {
            const message =
              error instanceof ApiError
                ? error.message
                : "Something went wrong. Please try again.";
            Toast.show({
              type: "error",
              text1: "Could not create account",
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
          setFieldValue,
          values,
          errors,
          touched,
        }) => (
          <View className="mt-6">
            <FormField
              label="Shop/Business name"
              icon={Store}
              placeholder="e.g. Jane's Electronics"
              autoCapitalize="words"
              value={values.businessName}
              onChangeText={handleChange("businessName")}
              onBlur={handleBlur("businessName")}
              error={errors.businessName}
              touched={touched.businessName}
            />
            <FormField
              label="Create a password"
              secure
              placeholder="At least 8 characters"
              value={values.password}
              onChangeText={handleChange("password")}
              onBlur={handleBlur("password")}
              error={errors.password}
              touched={touched.password}
            />
            <FormField
              label="Confirm password"
              secure
              placeholder="Re-enter your password"
              value={values.confirmPassword}
              onChangeText={handleChange("confirmPassword")}
              onBlur={handleBlur("confirmPassword")}
              error={errors.confirmPassword}
              touched={touched.confirmPassword}
            />

            <View className="mt-5">
              <TermsCheckbox
                checked={values.acceptedTerms}
                onChange={(value) => setFieldValue("acceptedTerms", value)}
                error={touched.acceptedTerms ? errors.acceptedTerms : undefined}
              />
            </View>

            <PrimaryButton
              label="Create account"
              loading={submitting}
              onPress={handleSubmit as () => void}
            />

            <Pressable
              onPress={() => goToPreviousStep(values)}
              disabled={submitting}
              hitSlop={8}
              className="mt-4 flex-row items-center justify-center gap-1 rounded-2xl border border-brand-100 bg-white py-3.5"
            >
              <ChevronLeft size={18} color={colors.ink700} />
              <Text className="font-poppins-medium text-sm text-ink-700">
                Previous step
              </Text>
            </Pressable>
          </View>
        )}
      </Formik>
    </SheetScreen>
  );
}
