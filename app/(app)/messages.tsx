import { useFocusEffect, useRouter } from "expo-router";
import { MessageCircle } from "lucide-react-native";
import moment from "moment";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import Toast from "react-native-toast-message";

import { GradientScreen } from "@/components/GradientScreen";
import { useAuth } from "@/context/AuthContext";
import { useProtectedRoute } from "@/hooks/useProtectedRoute";
import { ApiError } from "@/lib/apiClient";
import * as listingsService from "@/services/listings";
import * as messagingService from "@/services/messaging";
import { colors } from "@/theme/colors";
import type { Conversation } from "@/types/api";

type ConversationRow = Conversation & { listingTitle: string };

function fallbackTitle(listingId: string): string {
  return `Chat about listing #${listingId.slice(0, 8)}`;
}

export default function MessagesScreen() {
  useProtectedRoute("/(app)/messages");
  const router = useRouter();
  const { user } = useAuth();

  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      (async () => {
        setLoading(true);
        try {
          const page = await messagingService.getConversations();
          // Cache listing titles by id so conversations that share a listing (e.g. two buyers
          // asking about the same item, seen from the seller's side) don't refetch it twice.
          const titleCache = new Map<string, string>();

          const rows = await Promise.all(
            page.items.map(async (conversation): Promise<ConversationRow> => {
              if (!titleCache.has(conversation.listingId)) {
                try {
                  const listing = await listingsService.getById(
                    conversation.listingId,
                  );
                  titleCache.set(conversation.listingId, listing.title);
                } catch {
                  // Listing may be gone/inaccessible - fall back to a generic id-based label
                  // rather than failing the whole list over one conversation.
                  titleCache.set(
                    conversation.listingId,
                    fallbackTitle(conversation.listingId),
                  );
                }
              }
              return {
                ...conversation,
                listingTitle: titleCache.get(conversation.listingId)!,
              };
            }),
          );

          if (!cancelled) {
            rows.sort((a, b) => {
              const aTime = new Date(a.lastMessageAt ?? a.createdAt).getTime();
              const bTime = new Date(b.lastMessageAt ?? b.createdAt).getTime();
              return bTime - aTime;
            });
            setConversations(rows);
          }
        } catch (error) {
          if (!cancelled) {
            const message =
              error instanceof ApiError
                ? error.message
                : "Something went wrong. Please try again.";
            Toast.show({
              type: "error",
              text1: "Couldn't load messages",
              text2: message,
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

  return (
    <GradientScreen scroll={false}>
      <View className="px-6 pt-6">
        <Text className="font-poppins-bold text-2xl text-ink-900">
          Messages
        </Text>
        <Text className="mt-1 font-poppins text-sm text-ink-500">
          Chats with buyers and sellers
        </Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.brand500} />
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingHorizontal: 24,
            paddingTop: 20,
            paddingBottom: 24,
            flexGrow: 1,
          }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/(modals)/conversation",
                  params: {
                    conversationId: item.id,
                    title: item.listingTitle,
                    listingId: item.listingId,
                  },
                })
              }
              className="mb-3 flex-row rounded-2xl border border-brand-50 bg-white p-4"
            >
              <View className="flex-1">
                <View className="flex-row items-center justify-between">
                  <Text
                    className="mr-2 flex-1 font-poppins-semibold text-sm text-ink-900"
                    numberOfLines={1}
                  >
                    {item.listingTitle}
                  </Text>
                  <Text className="font-poppins text-xs text-ink-500">
                    {moment(item.lastMessageAt ?? item.createdAt).fromNow()}
                  </Text>
                </View>
                <Text className="mt-1 font-poppins text-xs leading-5 text-ink-500">
                  {user?.id === item.buyerId
                    ? "You're the buyer"
                    : "You're the seller"}{" "}
                  in this chat
                </Text>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <View className="mt-16 items-center px-10">
              <MessageCircle size={40} color={colors.brand200} />
              <Text className="mt-4 text-center font-poppins-medium text-sm text-ink-500">
                No conversations yet.
              </Text>
            </View>
          }
        />
      )}
    </GradientScreen>
  );
}
