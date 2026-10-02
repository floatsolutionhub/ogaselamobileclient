import { Check, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "@/theme/colors";

type ReportSheetProps = {
  visible: boolean;
  title: string;
  subtitle: string;
  reasons: string[];
  onClose: () => void;
  /** Receives the chosen reason, plus any extra details on a new line. Throw to keep the sheet open. */
  onSubmit: (reason: string) => Promise<void>;
};

export function ReportSheet({
  visible,
  title,
  subtitle,
  reasons,
  onClose,
  onSubmit,
}: ReportSheetProps) {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<string | null>(null);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setSelected(null);
      setDetails("");
    }
  }, [visible]);

  const needsDetails = selected === "Other";
  const canSubmit =
    !!selected && (!needsDetails || details.trim().length > 0) && !submitting;

  const submit = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const extra = details.trim();
      await onSubmit(extra ? `${selected}\n${extra}` : selected);
    } catch {
      // The caller shows the error; keep the sheet open so the user can retry.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(16,24,40,0.45)",
        }}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View
          className="rounded-t-3xl bg-white px-6 pt-5"
          style={{
            paddingBottom: Math.max(insets.bottom, 16) + 8,
            maxHeight: "85%",
          }}
        >
          <View className="mb-1 flex-row items-center justify-between">
            <Text className="font-poppins-semibold text-lg text-ink-900">
              {title}
            </Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <X size={20} color={colors.ink500} />
            </Pressable>
          </View>
          <Text className="mb-4 font-poppins text-xs text-ink-500">
            {subtitle}
          </Text>

          <ScrollView keyboardShouldPersistTaps="handled">
            {reasons.map((reason) => {
              const active = selected === reason;
              return (
                <Pressable
                  key={reason}
                  onPress={() => setSelected(reason)}
                  className={`mb-2 flex-row items-center justify-between rounded-2xl border px-4 py-3.5 ${
                    active
                      ? "border-brand-600 bg-brand-50"
                      : "border-brand-50 bg-white"
                  }`}
                >
                  <Text className="font-poppins-medium text-sm text-ink-900">
                    {reason}
                  </Text>
                  {active ? <Check size={16} color={colors.brand600} /> : null}
                </Pressable>
              );
            })}

            <TextInput
              value={details}
              onChangeText={setDetails}
              placeholder={
                needsDetails
                  ? "Tell us what's wrong (required)"
                  : "Add more details (optional)"
              }
              placeholderTextColor={colors.ink300}
              multiline
              maxLength={1500}
              className="mt-2 min-h-[88px] rounded-2xl border border-brand-100 bg-surface px-4 py-3 font-poppins text-sm text-ink-900"
              style={{ textAlignVertical: "top" }}
            />
          </ScrollView>

          <Pressable
            onPress={submit}
            disabled={!canSubmit}
            className="mt-4 items-center justify-center rounded-2xl bg-danger py-4"
            style={{ opacity: canSubmit ? 1 : 0.5 }}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="font-poppins-semibold text-base text-white">
                Submit report
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
