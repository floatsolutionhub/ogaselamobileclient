import { BadgeCheck, Megaphone, type LucideIcon } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { ScreenHeader } from "@/components/ScreenHeader";
import { useProtectedRoute } from "@/hooks/useProtectedRoute";
import { ApiError } from "@/lib/apiClient";
import * as notificationsService from "@/services/notifications";
import { colors } from "@/theme/colors";
import type { NotificationChannel, NotificationPreferenceInput } from "@/types/api";
import { ICON } from "@/theme/typography";

const CATEGORIES: { key: string; icon: LucideIcon; title: string; description: string }[] = [
  {
    key: "ListingLifecycle",
    icon: Megaphone,
    title: "Ad updates",
    description: "Approvals, rejections and ads about to expire",
  },
  {
    key: "Verification",
    icon: BadgeCheck,
    title: "Verification",
    description: "The outcome of your identity verification",
  },
];

const CHANNEL_LABELS: Partial<Record<NotificationChannel, string>> = {
  Push: "Push notifications",
  Email: "Email",
};

/** Takes effect immediately - each switch saves on its own, no approval needed. */
export default function NotificationSettingsScreen() {
  useProtectedRoute("/notification-settings");
  const [preferences, setPreferences] = useState<NotificationPreferenceInput[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    notificationsService
      .getPreferences()
      .then(setPreferences)
      .catch((err) =>
        Toast.show({
          type: "error",
          text1: "Couldn't load your settings",
          text2: err instanceof ApiError ? err.message : "Please try again.",
        }),
      )
      .finally(() => setLoading(false));
  }, []);

  const toggle = async (pref: NotificationPreferenceInput, enabled: boolean) => {
    const matches = (p: NotificationPreferenceInput) =>
      p.channel === pref.channel && p.category === pref.category;
    // Flip it straight away; put it back if the save fails.
    setPreferences((prev) => prev.map((p) => (matches(p) ? { ...p, enabled } : p)));
    try {
      await notificationsService.updatePreferences([{ ...pref, enabled }]);
    } catch (err) {
      setPreferences((prev) => prev.map((p) => (matches(p) ? { ...p, enabled: !enabled } : p)));
      Toast.show({
        type: "error",
        text1: "Couldn't save that change",
        text2: err instanceof ApiError ? err.message : "Please try again.",
      });
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScreenHeader title="Notifications" />

      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 12, gap: 20 }}>
        <Text className="px-1 font-poppins text-caption text-ink-500">
          Choose how we reach you. Messages, security codes and account notices
          are always sent.
        </Text>

        {loading ? (
          <ActivityIndicator color={colors.brand600} style={{ marginTop: 24 }} />
        ) : (
          CATEGORIES.map((category) => {
            const rows = preferences.filter((p) => p.category === category.key);
            if (rows.length === 0) return null;
            return (
              <View
                key={category.key}
                className="overflow-hidden rounded-3xl border border-brand-50 bg-white"
              >
                <View className="flex-row items-center gap-3 border-b border-brand-50 px-5 py-4">
                  <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-50">
                    <category.icon size={ICON.md} color={colors.brand600} />
                  </View>
                  <View className="flex-1">
                    <Text className="font-poppins-semibold text-body text-ink-900">
                      {category.title}
                    </Text>
                    <Text className="font-poppins text-caption text-ink-500">
                      {category.description}
                    </Text>
                  </View>
                </View>
                {rows.map((pref, index) => (
                  <View
                    key={pref.channel}
                    className={`flex-row items-center justify-between px-5 py-3.5 ${
                      index !== rows.length - 1 ? "border-b border-brand-50" : ""
                    }`}
                  >
                    <Text className="font-poppins-medium text-body text-ink-700">
                      {CHANNEL_LABELS[pref.channel] ?? pref.channel}
                    </Text>
                    <Switch
                      value={pref.enabled}
                      onValueChange={(enabled) => toggle(pref, enabled)}
                      trackColor={{ true: colors.brand600, false: colors.ink300 }}
                      thumbColor={colors.white}
                      accessibilityLabel={`${category.title} by ${CHANNEL_LABELS[pref.channel] ?? pref.channel}`}
                    />
                  </View>
                ))}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
