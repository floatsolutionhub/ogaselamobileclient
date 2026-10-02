import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Formik } from "formik";
import { Mail, Phone, User } from "lucide-react-native";
import { Text, View } from "react-native";

import { LINKS } from "@/config/links";
import { FormField } from "@/components/FormField";
import { Logo } from "@/components/Logo";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SheetScreen } from "@/components/SheetScreen";
import { SocialSignInButtons } from "@/components/SocialSignInButtons";
import { getSignUpDraft, updateSignUpDraft } from "@/lib/signUpDraft";
import { registerStepOneSchema } from "@/utils/validation";

export default function SignUpStepOneSheet() {
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();

  return (
    <SheetScreen>
      <View className="items-center">
        <Logo size={40} />
        <Text className="mt-3 font-poppins-bold text-xl text-ink-900">
          Create your account
        </Text>
        <Text className="mt-1 text-center font-poppins text-sm text-ink-500">
          Step 1 of 2 · Tell us about yourself
        </Text>
      </View>

      <View className="mt-5 flex-row gap-2">
        <View className="h-1.5 flex-1 rounded-full bg-brand-500" />
        <View className="h-1.5 flex-1 rounded-full bg-brand-100" />
      </View>

      <Formik
        // Pre-filled from the draft when coming back from step 2.
        initialValues={(() => {
          const { fullName, email, phone } = getSignUpDraft();
          return { fullName, email, phone };
        })()}
        validationSchema={registerStepOneSchema}
        onSubmit={(values) => {
          updateSignUpDraft(values);
          router.replace({
            pathname: "/(modals)/sign-up-step2",
            params: { ...values, redirect },
          });
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
          <View className="mt-6">
            <FormField
              label="Full name"
              icon={User}
              placeholder="Jane Doe"
              autoCapitalize="words"
              value={values.fullName}
              onChangeText={handleChange("fullName")}
              onBlur={handleBlur("fullName")}
              error={errors.fullName}
              touched={touched.fullName}
            />
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

            <PrimaryButton
              label="Continue"
              onPress={handleSubmit as () => void}
            />
          </View>
        )}
      </Formik>

      <View className="mb-4 mt-6 flex-row items-center gap-3">
        <View className="h-px flex-1 bg-brand-100" />
        <Text className="font-poppins text-xs text-ink-500">
          or sign up with
        </Text>
        <View className="h-px flex-1 bg-brand-100" />
      </View>

      <SocialSignInButtons mode="signup" redirect={redirect} />

      <View className="mb-4 mt-6 flex-row justify-center gap-1">
        <Text className="font-poppins text-sm text-ink-500">
          Already have an account?
        </Text>
        <Text
          className="font-poppins-semibold text-sm text-brand-600"
          onPress={() =>
            router.replace({
              pathname: "/(modals)/sign-in",
              params: { redirect },
            })
          }
        >
          Log in
        </Text>
      </View>

      <Text className="mb-4 text-center font-poppins text-xs leading-5 text-ink-500">
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
    </SheetScreen>
  );
}
