import { useFocusEffect, useRouter } from "expo-router";
import { Bell } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { getUnreadCount } from "@/services/inbox";
import { colors } from "@/theme/colors";
import { ICON } from "@/theme/typography";

const POLL_INTERVAL_MS = 60_000;

/**
 * Bell with an unread badge, for signed-in users. Refreshes whenever its screen comes into focus
 * (e.g. back from the notifications list) and every minute while it stays on screen.
 */
export function NotificationBell() {
  const router = useRouter();
  const [unread, setUnread] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const refresh = () =>
        getUnreadCount()
          .then((count) => {
            if (active) setUnread(count);
          })
          .catch(() => {});
      refresh();
      const timer = setInterval(refresh, POLL_INTERVAL_MS);
      return () => {
        active = false;
        clearInterval(timer);
      };
    }, []),
  );

  const label = unread > 99 ? "99+" : String(unread);

  return (
    <Pressable
      onPress={() => router.push("/notifications")}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={
        unread > 0 ? `Notifications, ${unread} unread` : "Notifications"
      }
      className="h-10 w-10 items-center justify-center rounded-full border border-brand-100 bg-white"
    >
      <Bell size={ICON.md} color={colors.ink700} />
      {unread > 0 ? (
        <View className="absolute -right-1.5 -top-1.5 h-[22px] min-w-[22px] items-center justify-center rounded-full border-2 border-white bg-danger px-1">
          <Text className="font-poppins-semibold text-micro text-white">
            {label}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
