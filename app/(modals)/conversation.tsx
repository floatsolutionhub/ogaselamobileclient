import { router, useLocalSearchParams } from "expo-router";
import { Ban, ChevronLeft, Scale, Send, UserX } from "lucide-react-native";
import moment from "moment";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

import { ChatOfficePickupPrompt } from "@/components/ChatOfficePickupPrompt";
import { ChatSafetyNotice } from "@/components/ChatSafetyNotice";
import { useAuth } from "@/context/AuthContext";
import { useProtectedRoute } from "@/hooks/useProtectedRoute";
import { ApiError } from "@/lib/apiClient";
import { useUnreadMessages } from "@/context/UnreadMessagesContext";
import { useMessagingHub } from "@/lib/messagingHub";
import * as messagingService from "@/services/messaging";
import { colors } from "@/theme/colors";
import type { Conversation, Message } from "@/types/api";
import { ICON } from "@/theme/typography";

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
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [updatingBlock, setUpdatingBlock] = useState(false);
  const isBlocked = conversation?.isBlockedByMe ?? false;
  const isOtherDeleted = conversation?.isOtherParticipantDeleted ?? false;
  const listRef = useRef<FlatList<Message>>(null);

  const { refresh: refreshUnread } = useUnreadMessages();

  const appendMessage = useCallback((message: Message) => {
    setMessages((prev) => {
      if (prev.some((existing) => existing.id === message.id)) return prev;
      return [...prev, message];
    });
  }, []);

  useEffect(() => {
    if (!conversationId) return;
    let cancelled = false;

    // Who the other person is and whether they're blocked - separate so a failure here
    // doesn't hide the messages, it just leaves the Block button out.
    messagingService
      .getConversation(conversationId)
      .then((c) => {
        if (!cancelled) setConversation(c);
      })
      .catch(() => {});

    (async () => {
      setLoading(true);
      try {
        const page = await messagingService.getMessages(conversationId);
        if (!cancelled) setMessages(page.items);
        // Loading the thread marked its messages read - bring the tab badge down.
        refreshUnread();
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
  }, [conversationId, refreshUnread]);

  // Live updates while this thread is open - REST above is still the source of truth on mount.
  useMessagingHub((message) => {
    if (message.conversationId === conversationId) {
      appendMessage(message);
      // Seen as it arrived: mark it read so it doesn't count towards the tab badge.
      messagingService
        .getMessages(conversationId, 1, 1)
        .then(() => refreshUnread())
        .catch(() => {});
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

  const setBlocked = async (block: boolean) => {
    if (!conversation || updatingBlock) return;
    setUpdatingBlock(true);
    try {
      if (block) {
        await messagingService.blockUser(conversation.otherParticipantId);
      } else {
        await messagingService.unblockUser(conversation.otherParticipantId);
      }
      setConversation({ ...conversation, isBlockedByMe: block });
      Toast.show({
        type: "success",
        text1: block ? "User blocked" : "User unblocked",
        text2: block
          ? "They can no longer message you. Unblock them anytime in Settings."
          : "You can message each other again.",
      });
    } catch (error) {
      Toast.show({
        type: "error",
        text1: block
          ? "Couldn't block this user"
          : "Couldn't unblock this user",
        text2: error instanceof ApiError ? error.message : "Please try again.",
      });
    } finally {
      setUpdatingBlock(false);
    }
  };

  const confirmBlock = () =>
    Alert.alert(
      "Block this user?",
      "They won't be able to message you or start new chats with you. You can unblock them anytime in Settings > Blocked Users.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: () => setBlocked(true),
        },
      ],
    );

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
            <ChevronLeft size={ICON.lg} color={colors.ink700} />
          </Pressable>
          <Text
            className="flex-1 font-poppins-semibold text-subtitle text-ink-900"
            numberOfLines={1}
          >
            {title ?? "Conversation"}
          </Text>
          <View className="items-end gap-2">
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
                <Scale size={ICON.sm} color={colors.ink700} />
                <Text className="font-poppins-medium text-caption text-ink-700">
                  Dispute
                </Text>
              </Pressable>
            ) : null}
            {conversation && !isOtherDeleted ? (
              <Pressable
                onPress={isBlocked ? () => setBlocked(false) : confirmBlock}
                disabled={updatingBlock}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={
                  isBlocked ? "Unblock this user" : "Block this user"
                }
                className="flex-row items-center gap-1 rounded-full bg-danger/5 px-3 py-2"
              >
                {updatingBlock ? (
                  <ActivityIndicator size="small" color={colors.danger} />
                ) : (
                  <Ban size={ICON.sm} color={colors.danger} />
                )}
                <Text className="font-poppins-medium text-caption text-danger">
                  {isBlocked ? "Unblock" : "Block"}
                </Text>
              </Pressable>
            ) : null}
          </View>
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
                      className={`font-poppins text-body ${isOwn ? "text-white" : "text-ink-900"}`}
                    >
                      {item.content}
                    </Text>
                  </View>
                  <Text
                    className={`mt-1 font-poppins text-micro text-ink-300 ${
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
                <Text className="text-center font-poppins text-body text-ink-500">
                  No messages yet. Say hello!
                </Text>
              </View>
            }
          />
        )}

        <View className="border-t border-brand-50 px-4 pt-3">
          <ChatSafetyNotice />
          {listingId && !isOtherDeleted ? (
            <ChatOfficePickupPrompt
              listingId={listingId}
              listingTitle={title ?? "this item"}
            />
          ) : null}
        </View>
        {isOtherDeleted ? (
          <View className="mx-4 my-3 flex-row items-center gap-3 rounded-2xl bg-surface px-4 py-3">
            <UserX size={ICON.md} color={colors.ink500} />
            <Text className="flex-1 font-poppins text-caption text-ink-500">
              This account was deleted. The chat is kept here for your
              reference, but no new messages can be sent.
            </Text>
          </View>
        ) : isBlocked ? (
          <View className="mx-4 my-3 flex-row items-center gap-3 rounded-2xl bg-surface px-4 py-3">
            <Ban size={ICON.md} color={colors.ink500} />
            <Text className="flex-1 font-poppins text-caption text-ink-500">
              You blocked this user. Neither of you can send messages in this
              chat.
            </Text>
            <Pressable
              onPress={() => setBlocked(false)}
              disabled={updatingBlock}
              accessibilityRole="button"
              hitSlop={8}
            >
              <Text className="font-poppins-semibold text-caption text-brand-600">
                Unblock
              </Text>
            </Pressable>
          </View>
        ) : (
          <View className="flex-row items-end gap-2 px-4 py-3">
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Type a message"
              placeholderTextColor={colors.ink300}
              className="max-h-28 flex-1 rounded-2xl border border-brand-100 bg-surface px-4 py-2.5 font-poppins text-body text-ink-900"
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
                <Send size={ICON.md} color="#FFFFFF" />
              )}
            </Pressable>
          </View>
        )}      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
