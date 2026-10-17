import { useRouter } from "expo-router";
import { Formik } from "formik";
import { Lock } from "lucide-react-native";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { FormField } from "@/components/FormField";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useProtectedRoute } from "@/hooks/useProtectedRoute";
import { ApiError } from "@/lib/apiClient";
import { changePassword } from "@/services/auth";
import { updatePasswordSchema } from "@/utils/validation";

/** Takes effect immediately - unlike phone/email changes, no approval is needed. */
export default function UpdatePasswordScreen() {
  useProtectedRoute("/update-password");
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScreenHeader title="Update Password" />

      <ScrollView
        contentContainerStyle={{ padding: 24, paddingTop: 12 }}
        keyboardShouldPersistTaps="handled"
      >
        <Formik
          initialValues={{
            currentPassword: "",
            newPassword: "",
            confirmPassword: "",
          }}
          validationSchema={updatePasswordSchema}
          onSubmit={async (values, { setFieldError }) => {
            try {
              await changePassword(values.currentPassword, values.newPassword);
              Toast.show({ type: "success", text1: "Password updated" });
              router.back();
            } catch (err) {
              const message =
                err instanceof ApiError ? err.message : "Please try again.";
              if (err instanceof ApiError && err.status === 400) {
                setFieldError("currentPassword", message);
              }
              Toast.show({
                type: "error",
                text1: "Couldn't update your password",
                text2: message,
              });
            }
          }}
        >
          {({
            values,
            errors,
            touched,
            handleChange,
            handleBlur,
            handleSubmit,
            isSubmitting,
          }) => (
            <View className="rounded-3xl border border-brand-50 bg-white p-5">
              <Text className="mb-4 font-poppins text-caption text-ink-500">
                Use at least 8 characters. You’ll stay signed in on this
                device.
              </Text>
              <FormField
                label="Current password"
                icon={Lock}
                secure
                value={values.currentPassword}
                onChangeText={handleChange("currentPassword")}
                onBlur={handleBlur("currentPassword")}
                error={errors.currentPassword}
                touched={touched.currentPassword}
                autoCapitalize="none"
              />
              <FormField
                label="New password"
                icon={Lock}
                secure
                value={values.newPassword}
                onChangeText={handleChange("newPassword")}
                onBlur={handleBlur("newPassword")}
                error={errors.newPassword}
                touched={touched.newPassword}
                autoCapitalize="none"
              />
              <FormField
                label="Confirm new password"
                icon={Lock}
                secure
                value={values.confirmPassword}
                onChangeText={handleChange("confirmPassword")}
                onBlur={handleBlur("confirmPassword")}
                error={errors.confirmPassword}
                touched={touched.confirmPassword}
                autoCapitalize="none"
              />
              <PrimaryButton
                label="Update password"
                onPress={() => handleSubmit()}
                loading={isSubmitting}
              />
            </View>
          )}
        </Formik>
      </ScrollView>
    </SafeAreaView>
  );
}
