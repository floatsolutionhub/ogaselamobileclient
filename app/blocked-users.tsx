import { useFocusEffect, useRouter } from "expo-router";
import { Ban, ChevronLeft } from "lucide-react-native";
import moment from "moment";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { useProtectedRoute } from "@/hooks/useProtectedRoute";
import { ApiError } from "@/lib/apiClient";
import * as messagingService from "@/services/messaging";
import { colors } from "@/theme/colors";
import { ICON } from "@/theme/typography";
import type { BlockedUser } from "@/types/api";

function nameOf(user: BlockedUser): string {
  return user.displayName?.trim() || "Ogasela user";
}

export default function BlockedUsersScreen() {
  useProtectedRoute("/blocked-users");
  const router = useRouter();

  const [users, setUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      (async () => {
        setLoading(true);
        try {
          const list = await messagingService.getBlockedUsers();
          if (!cancelled) setUsers(list);
        } catch (error) {
          if (!cancelled) {
            Toast.show({
              type: "error",
              text1: "Couldn't load blocked users",
              text2:
                error instanceof ApiError
                  ? error.message
                  : "Something went wrong. Please try again.",
            });
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();

      return () => {
        cancelled = true;
      };
    }, []),
  );

  const unblock = async (user: BlockedUser) => {
    setUnblockingId(user.userId);
    try {
      await messagingService.unblockUser(user.userId);
      setUsers((prev) => prev.filter((u) => u.userId !== user.userId));
      Toast.show({ type: "success", text1: `${nameOf(user)} unblocked` });
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Couldn't unblock",
        text2: error instanceof ApiError ? error.message : "Please try again.",
      });
    } finally {
      setUnblockingId(null);
    }
  };

  const confirmUnblock = (user: BlockedUser) =>
    Alert.alert(
      `Unblock ${nameOf(user)}?`,
      "They'll be able to message you again.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Unblock", onPress: () => unblock(user) },
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
          Blocked Users
        </Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.brand500} />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.userId}
          contentContainerStyle={{ padding: 24, flexGrow: 1 }}
          renderItem={({ item }) => (
            <View className="mb-3 flex-row items-center gap-3 rounded-2xl border border-brand-50 bg-white p-4">
              <View className="flex-1">
                <Text
                  className="font-poppins-semibold text-body text-ink-900"
                  numberOfLines={1}
                >
                  {nameOf(item)}
                </Text>
                <Text className="font-poppins text-caption text-ink-500">
                  Blocked {moment(item.blockedAt).fromNow()}
                </Text>
              </View>
              <Pressable
                onPress={() => confirmUnblock(item)}
                disabled={unblockingId === item.userId}
                accessibilityRole="button"
                accessibilityLabel={`Unblock ${nameOf(item)}`}
                className="rounded-full bg-surface px-4 py-2"
              >
                {unblockingId === item.userId ? (
                  <ActivityIndicator size="small" color={colors.ink700} />
                ) : (
                  <Text className="font-poppins-medium text-caption text-ink-700">
                    Unblock
                  </Text>
                )}
              </Pressable>
            </View>
          )}
          ListEmptyComponent={
            <View className="mt-16 items-center px-10">
              <Ban size={40} color={colors.brand200} />
              <Text className="mt-4 text-center font-poppins-medium text-body text-ink-500">
                You haven't blocked anyone.
              </Text>
              <Text className="mt-1 text-center font-poppins text-caption text-ink-500">
                Block someone from a chat to stop them messaging you.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
