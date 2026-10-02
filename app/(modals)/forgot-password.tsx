import { router, useLocalSearchParams } from "expo-router";
import { Formik } from "formik";
import {
  Check,
  Mail,
  MessageSquare,
  Phone,
  type LucideIcon,
} from "lucide-react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Toast from "react-native-toast-message";

import { FormField } from "@/components/FormField";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SheetScreen } from "@/components/SheetScreen";
import { ApiError } from "@/lib/apiClient";
import * as authService from "@/services/auth";
import { colors } from "@/theme/colors";
import { forgotPasswordSchema } from "@/utils/validation";

type Channel = authService.PasswordResetChannel;

export default function ForgotPasswordSheet() {
  const [submitting, setSubmitting] = useState(false);
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();

  return (
    <SheetScreen>
      <View className="items-center">
        <Text className="font-poppins-bold text-xl text-ink-900">
          Reset your password
        </Text>
        <Text className="mt-1 text-center font-poppins text-sm text-ink-500">
          Choose how you'd like to receive your 6-digit reset code.
        </Text>
      </View>

      <Formik
        initialValues={{ channel: "Email" as Channel, email: "", phone: "" }}
        validationSchema={forgotPasswordSchema}
        onSubmit={async (values) => {
          setSubmitting(true);
          const destination =
            values.channel === "Email"
              ? values.email.trim()
              : values.phone.trim();
          try {
            await authService.requestPasswordReset(
              values.channel === "Email"
                ? { channel: "Email", email: destination }
                : { channel: "Phone", phone: destination },
            );
            Toast.show({
              type: "success",
              text1:
                "Check your " +
                (values.channel === "Email" ? "inbox" : "messages"),
              // The API never reveals whether an account exists, so don't claim a code was sent.
              text2:
                values.channel === "Email"
                  ? "If this email belongs to an Ogasela account, a code is on its way. Check spam too."
                  : "If this number belongs to an Ogasela account, a code is on its way.",
            });
            router.replace({
              pathname: "/(modals)/verify-otp",
              params: { channel: values.channel, destination, redirect },
            });
          } catch (error) {
            const message =
              error instanceof ApiError
                ? error.message
                : "Something went wrong. Please try again.";
            Toast.show({
              type: "error",
              text1: "Could not send code",
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
          setTouched,
          values,
          errors,
          touched,
        }) => (
          <View className="mt-6">
            <Text className="mb-2 font-poppins-medium text-sm text-ink-700">
              Send my code by
            </Text>
            <View className="mb-5 flex-row gap-3">
              {(
                [
                  {
                    value: "Email",
                    label: "Email",
                    hint: "To your inbox",
                    icon: Mail,
                  },
                  {
                    value: "Phone",
                    label: "SMS",
                    hint: "To your phone",
                    icon: MessageSquare,
                  },
                ] as {
                  value: Channel;
                  label: string;
                  hint: string;
                  icon: LucideIcon;
                }[]
              ).map((option) => (
                <ChannelOption
                  key={option.value}
                  {...option}
                  active={values.channel === option.value}
                  onPress={() => {
                    setFieldValue("channel", option.value);
                    // Don't flag the other field as invalid just because the user switched to it.
                    setTouched({});
                  }}
                />
              ))}
            </View>

            {values.channel === "Email" ? (
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
            ) : (
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
            )}

            <PrimaryButton
              label="Send code"
              loading={submitting}
              onPress={handleSubmit as () => void}
            />
          </View>
        )}
      </Formik>

      <Text
        className="mb-4 mt-6 text-center font-poppins-semibold text-sm text-brand-600"
        onPress={() =>
          router.replace({
            pathname: "/(modals)/sign-in",
            params: { redirect },
          })
        }
      >
        Back to login
      </Text>
    </SheetScreen>
  );
}

function ChannelOption({
  label,
  hint,
  icon: Icon,
  active,
  onPress,
}: {
  label: string;
  hint: string;
  icon: LucideIcon;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      className={`flex-1 rounded-2xl border p-4 ${
        active ? "border-brand-600 bg-brand-50" : "border-brand-100 bg-white"
      }`}
    >
      <View className="flex-row items-center justify-between">
        <View
          className={`h-9 w-9 items-center justify-center rounded-full ${
            active ? "bg-brand-600" : "bg-surface"
          }`}
        >
          <Icon size={18} color={active ? colors.white : colors.ink700} />
        </View>
        {active ? <Check size={16} color={colors.brand600} /> : null}
      </View>
      <Text className="mt-3 font-poppins-semibold text-sm text-ink-900">
        {label}
      </Text>
      <Text className="font-poppins text-xs text-ink-500">{hint}</Text>
    </Pressable>
  );
}
