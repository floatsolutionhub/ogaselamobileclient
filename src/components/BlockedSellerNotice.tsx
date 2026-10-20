import { Ban } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import Toast from "react-native-toast-message";

import { ApiError } from "@/lib/apiClient";
import * as messagingService from "@/services/messaging";
import { colors } from "@/theme/colors";
import { ICON } from "@/theme/typography";

/** Shown in place of a blocked seller's content (their ad's contact buttons, their storefront ads). */
export function BlockedSellerNotice({
  userId,
  onUnblocked,
}: {
  userId: string;
  onUnblocked: () => void;
}) {
  const [unblocking, setUnblocking] = useState(false);

  const unblock = async () => {
    setUnblocking(true);
    try {
      await messagingService.unblockUser(userId);
      Toast.show({ type: "success", text1: "Seller unblocked" });
      onUnblocked();
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Couldn't unblock this seller",
        text2: error instanceof ApiError ? error.message : "Please try again.",
      });
    } finally {
      setUnblocking(false);
    }
  };

  return (
    <View className="flex-row items-center gap-3 rounded-2xl bg-surface px-4 py-3">
      <Ban size={ICON.md} color={colors.ink500} />
      <Text className="flex-1 font-poppins text-caption text-ink-500">
        You blocked this seller. Their ads are hidden and you can't contact each
        other.
      </Text>
      <Pressable
        onPress={unblock}
        disabled={unblocking}
        accessibilityRole="button"
        hitSlop={8}
      >
        {unblocking ? (
          <ActivityIndicator size="small" color={colors.brand600} />
        ) : (
          <Text className="font-poppins-semibold text-caption text-brand-600">
            Unblock
          </Text>
        )}
      </Pressable>
    </View>
  );
}
