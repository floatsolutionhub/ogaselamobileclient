import { router, useLocalSearchParams } from "expo-router";
import { ChevronLeft, Scale, Send } from "lucide-react-native";
import moment from "moment";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { useAuth } from "@/context/AuthContext";
import { useProtectedRoute } from "@/hooks/useProtectedRoute";
import { ApiError } from "@/lib/apiClient";
import { useMessagingHub } from "@/lib/messagingHub";
import * as messagingService from "@/services/messaging";
import { colors } from "@/theme/colors";
import type { Message } from "@/types/api";

export default function ConversationScreen() {
  useProtectedRoute("/(app)/messages");
  const { user } = useAuth();
  const { conversationId, title, listingId } = useLocalSearchParams<{
    conversationId: string;
    title?: string;
    listingId?: string;
  }>();

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);

  const appendMessage = useCallback((message: Message) => {
    setMessages((prev) => {
      if (prev.some((existing) => existing.id === message.id)) return prev;
      return [...prev, message];
    });
  }, []);

  useEffect(() => {
    if (!conversationId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const page = await messagingService.getMessages(conversationId);
        if (!cancelled) setMessages(page.items);
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof ApiError
              ? error.message
              : "Something went wrong. Please try again.";
          Toast.show({
            type: "error",
            text1: "Couldn't load conversation",
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
  }, [conversationId]);

  // Live updates while this thread is open - REST above is still the source of truth on mount.
  useMessagingHub((message) => {
    if (message.conversationId === conversationId) {
      appendMessage(message);
    }
  });

  useEffect(() => {
    if (messages.length > 0) {
      requestAnimationFrame(() =>
        listRef.current?.scrollToEnd({ animated: true }),
      );
    }
  }, [messages.length]);

  const handleSend = async () => {
    const content = draft.trim();
    if (!content || !conversationId || sending) return;

    setSending(true);
    setDraft("");
    try {
      const sent = await messagingService.sendMessage(
        conversationId,
        content,
        null,
      );
      appendMessage(sent);
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : "Something went wrong. Please try again.";
      Toast.show({ type: "error", text1: "Message not sent", text2: message });
      setDraft(content);
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <View className="flex-row items-center gap-3 border-b border-brand-50 px-4 py-3">
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            className="h-9 w-9 items-center justify-center rounded-full bg-surface"
          >
            <ChevronLeft size={20} color={colors.ink700} />
          </Pressable>
          <Text
            className="flex-1 font-poppins-semibold text-base text-ink-900"
            numberOfLines={1}
          >
            {title ?? "Conversation"}
          </Text>
          {listingId ? (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/disputes/new",
                  params: { listingId, conversationId },
                })
              }
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Open a dispute about this deal"
              className="flex-row items-center gap-1 rounded-full bg-surface px-3 py-2"
            >
              <Scale size={14} color={colors.ink700} />
              <Text className="font-poppins-medium text-xs text-ink-700">
                Dispute
              </Text>
            </Pressable>
          ) : null}
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={colors.brand500} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16, gap: 10, flexGrow: 1 }}
            onContentSizeChange={() =>
              listRef.current?.scrollToEnd({ animated: false })
            }
            renderItem={({ item }) => {
              const isOwn = item.senderId === user?.id;
              return (
                <View
                  className={`max-w-[80%] ${isOwn ? "self-end" : "self-start"}`}
                >
                  <View
                    className={`rounded-2xl px-4 py-2.5 ${
                      isOwn
                        ? "bg-brand-600"
                        : "border border-brand-50 bg-surface"
                    }`}
                  >
                    <Text
                      className={`font-poppins text-sm ${isOwn ? "text-white" : "text-ink-900"}`}
                    >
                      {item.content}
                    </Text>
                  </View>
                  <Text
                    className={`mt-1 font-poppins text-[10px] text-ink-300 ${
                      isOwn ? "text-right" : "text-left"
                    }`}
                  >
                    {moment(item.sentAt).format("h:mm A")}
                  </Text>
                </View>
              );
            }}
            ListEmptyComponent={
              <View className="flex-1 items-center justify-center px-10">
                <Text className="text-center font-poppins text-sm text-ink-500">
                  No messages yet. Say hello!
                </Text>
              </View>
            }
          />
        )}

        <View className="flex-row items-end gap-2 border-t border-brand-50 px-4 py-3">
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Type a message"
            placeholderTextColor={colors.ink300}
            className="max-h-28 flex-1 rounded-2xl border border-brand-100 bg-surface px-4 py-2.5 font-poppins text-sm text-ink-900"
            multiline
          />
          <Pressable
            onPress={handleSend}
            disabled={!draft.trim() || sending}
            className="h-11 w-11 items-center justify-center rounded-full bg-brand-600"
            style={{ opacity: !draft.trim() || sending ? 0.5 : 1 }}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Send size={18} color="#FFFFFF" />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
