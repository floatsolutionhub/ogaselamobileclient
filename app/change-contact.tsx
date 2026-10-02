import { useLocalSearchParams, useRouter } from "expo-router";
import { Mail, Phone } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { ChangeRequestBanner } from "@/components/ChangeRequestBanner";
import { FormField } from "@/components/FormField";
import { OtpInput } from "@/components/OtpInput";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useAuth } from "@/context/AuthContext";
import { useProtectedRoute } from "@/hooks/useProtectedRoute";
import { ApiError } from "@/lib/apiClient";
import * as meService from "@/services/me";
import type { ProfileChange } from "@/services/me";

const PHONE_PATTERN = /^0[789][01][0-9]{8}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Change phone (?type=phone) or email (?type=email): the new value is confirmed with a code sent
 * to it, then filed for staff approval. The current one stays in use until it's approved.
 */
export default function ChangeContactScreen() {
  const params = useLocalSearchParams<{ type?: string }>();
  const kind: "Phone" | "Email" = params.type === "email" ? "Email" : "Phone";
  const isPhone = kind === "Phone";
  useProtectedRoute(`/change-contact?type=${isPhone ? "phone" : "email"}`);
  const router = useRouter();
  const { user } = useAuth();
  const current = isPhone ? user?.phone : user?.email;

  const [step, setStep] = useState<"enter" | "code">("enter");
  const [value, setValue] = useState("");
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [change, setChange] = useState<ProfileChange | undefined>();
  const [cancelling, setCancelling] = useState(false);

  const loadChange = useCallback(async () => {
    const changes = await meService.getMyChangeRequests().catch(() => []);
    setChange(changes.find((c) => c.type === kind));
  }, [kind]);

  useEffect(() => {
    loadChange();
  }, [loadChange]);

  const trimmed = isPhone ? value.trim() : value.trim().toLowerCase();
  const valid = isPhone
    ? PHONE_PATTERN.test(trimmed)
    : EMAIL_PATTERN.test(trimmed);
  const sameAsCurrent =
    !!current && trimmed === (isPhone ? current : current.toLowerCase());

  const showError = (title: string, err: unknown) =>
    Toast.show({
      type: "error",
      text1: title,
      text2: err instanceof ApiError ? err.message : "Please try again.",
    });

  const sendCode = async () => {
    setBusy(true);
    try {
      await meService.requestContactChangeCode(kind, trimmed);
      setCode("");
      setCodeError(false);
      setStep("code");
      Toast.show({
        type: "success",
        text1: "Code sent",
        text2: `Check ${trimmed} for a 6-digit code.`,
      });
    } catch (err) {
      showError("Couldn't send the code", err);
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    setBusy(true);
    try {
      const created = await meService.submitContactChange(kind, trimmed, code);
      setChange(created);
      setStep("enter");
      setValue("");
      setCode("");
      Toast.show({
        type: "success",
        text1: "Sent for approval",
        text2: "We'll notify you once it's reviewed.",
      });
    } catch (err) {
      setCodeError(true);
      showError("Couldn't confirm the code", err);
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async () => {
    if (!change) return;
    setCancelling(true);
    try {
      await meService.cancelChangeRequest(change.id);
      setChange({ ...change, status: "Cancelled" });
      Toast.show({ type: "success", text1: "Request withdrawn" });
    } catch (err) {
      showError("Couldn't withdraw the request", err);
    } finally {
      setCancelling(false);
    }
  };

  const label = isPhone ? "phone number" : "email";

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScreenHeader title={isPhone ? "Change Phone Number" : "Change Email"} />

      <ScrollView
        contentContainerStyle={{ padding: 24, paddingTop: 12, gap: 20 }}
        keyboardShouldPersistTaps="handled"
      >
        <ChangeRequestBanner
          change={change}
          pendingText={`New ${label}: ${change?.newValue ?? ""}`}
          onCancel={withdraw}
          cancelling={cancelling}
        />

        <View className="rounded-3xl border border-brand-50 bg-white p-5">
          <Text className="font-poppins-medium text-xs text-ink-500">
            Current {label}
          </Text>
          <Text className="mb-4 mt-0.5 font-poppins-semibold text-base text-ink-900">
            {current || "Not set"}
          </Text>

          {step === "enter" ? (
            <>
              <FormField
                label={`New ${label}`}
                icon={isPhone ? Phone : Mail}
                value={value}
                onChangeText={setValue}
                placeholder={isPhone ? "08012345678" : "you@example.com"}
                keyboardType={isPhone ? "number-pad" : "email-address"}
                autoCapitalize="none"
                autoCorrect={false}
                digitsOnly={isPhone}
                maxLength={isPhone ? 11 : 256}
                error={
                  sameAsCurrent
                    ? `That's already your ${label}`
                    : isPhone
                      ? "Enter an 11-digit phone number, e.g. 08012345678"
                      : "Enter a valid email address"
                }
                touched={value.length > 0 && (sameAsCurrent || !valid)}
              />
              <Text className="mb-4 font-poppins text-[11px] text-ink-500">
                We'll send a code to the new {label} to confirm it's yours.
                After that, our team reviews the change before it takes
                effect.
              </Text>
              <PrimaryButton
                label="Send code"
                onPress={sendCode}
                loading={busy}
                disabled={!valid || sameAsCurrent}
              />
            </>
          ) : (
            <>
              <Text className="mb-3 font-poppins text-sm text-ink-700">
                Enter the 6-digit code sent to{" "}
                <Text className="font-poppins-semibold">{trimmed}</Text>.
              </Text>
              <OtpInput
                value={code}
                onChange={(next) => {
                  setCode(next);
                  setCodeError(false);
                }}
                error={codeError}
              />
              <View className="mt-5">
                <PrimaryButton
                  label="Submit for approval"
                  onPress={submit}
                  loading={busy}
                  disabled={code.length !== 6}
                />
              </View>
              <View className="mt-4 flex-row justify-between">
                <Pressable onPress={() => setStep("enter")} hitSlop={8}>
                  <Text className="font-poppins-medium text-xs text-ink-500">
                    Change {label}
                  </Text>
                </Pressable>
                <Pressable onPress={sendCode} disabled={busy} hitSlop={8}>
                  <Text className="font-poppins-semibold text-xs text-brand-700">
                    Resend code
                  </Text>
                </Pressable>
              </View>
            </>
          )}
        </View>

        <Pressable onPress={() => router.back()} className="items-center">
          <Text className="font-poppins-medium text-sm text-ink-500">Done</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
