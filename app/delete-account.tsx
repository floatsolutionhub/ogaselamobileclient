import { useRouter } from "expo-router";
import { ChevronLeft, Trash2 } from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { useAuth } from "@/context/AuthContext";
import { useProtectedRoute } from "@/hooks/useProtectedRoute";
import { ApiError } from "@/lib/apiClient";
import * as meService from "@/services/me";
import { colors } from "@/theme/colors";
import { ICON } from "@/theme/typography";

const CONFIRM_WORD = "DELETE";

const WHAT_HAPPENS = [
  "Your ads are taken down straight away.",
  "Your name, phone number, email, photo and ID documents are erased.",
  "You're signed out on every device, and your Google, Apple or Facebook sign-in is unlinked.",
  "Payment records and reviews are kept without your details, as the law requires.",
];

/** In-app account deletion - immediate and permanent (DELETE /me). */
export default function DeleteAccountScreen() {
  useProtectedRoute("/delete-account");
  const router = useRouter();
  const { logout } = useAuth();
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const confirmed = confirmText.trim().toUpperCase() === CONFIRM_WORD;

  const deleteAccount = async () => {
    setDeleting(true);
    try {
      await meService.deleteMyAccount();
      await logout();
      router.replace("/(app)/home");
      Toast.show({
        type: "success",
        text1: "Account deleted",
        text2: "Your Ogasela account and personal data have been removed.",
      });
    } catch (error) {
      setDeleting(false);
      Toast.show({
        type: "error",
        text1: "Couldn't delete your account",
        text2: error instanceof ApiError ? error.message : "Please try again.",
      });
    }
  };

  const handleDelete = () =>
    Alert.alert(
      "Delete your account?",
      "This can't be undone. Your account and personal data will be removed permanently.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: deleteAccount },
      ],
    );

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="flex-row items-center gap-3 px-6 pb-2 pt-4">
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
          className="h-10 w-10 items-center justify-center rounded-full bg-white"
        >
          <ChevronLeft size={ICON.lg} color={colors.ink700} />
        </Pressable>
        <Text className="font-poppins-bold text-display text-ink-900">
          Delete Account
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="rounded-3xl border border-danger/20 bg-white p-5">
          <View className="h-12 w-12 items-center justify-center rounded-full bg-danger/5">
            <Trash2 size={ICON.lg} color={colors.danger} />
          </View>
          <Text className="mt-4 font-poppins-semibold text-title text-ink-900">
            This is permanent
          </Text>
          <Text className="mt-1 font-poppins text-body text-ink-500">
            Deleting your account happens immediately and can't be undone.
          </Text>

          <View className="mt-4 gap-2">
            {WHAT_HAPPENS.map((line) => (
              <View key={line} className="flex-row gap-2">
                <Text className="font-poppins text-body text-ink-500">•</Text>
                <Text className="flex-1 font-poppins text-body text-ink-700">
                  {line}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <Text className="mb-2 mt-6 px-1 font-poppins-medium text-body text-ink-700">
          Type {CONFIRM_WORD} to confirm
        </Text>
        <TextInput
          value={confirmText}
          onChangeText={setConfirmText}
          placeholder={CONFIRM_WORD}
          placeholderTextColor={colors.ink300}
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!deleting}
          className="rounded-2xl border border-brand-100 bg-white px-4 py-3.5 font-poppins text-body text-ink-900"
        />

        <Pressable
          onPress={handleDelete}
          disabled={!confirmed || deleting}
          accessibilityRole="button"
          className="mt-6 flex-row items-center justify-center gap-2 rounded-2xl bg-danger py-4"
          style={{ opacity: !confirmed || deleting ? 0.5 : 1 }}
        >
          {deleting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="font-poppins-semibold text-subtitle text-white">
              Delete My Account
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
