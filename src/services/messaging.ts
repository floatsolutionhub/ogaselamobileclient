// ConversationsController.cs, UsersController.cs, ReportsController.cs (all under Messaging/Moderation) - one function per route.
import { api } from "@/lib/apiClient";
import type { Conversation, Message, PagedResult } from "@/types/api";

export function startConversation(listingId: string): Promise<Conversation> {
  return api.post<Conversation>("/conversations", { listingId });
}

export function getConversations(page = 1, pageSize = 20): Promise<PagedResult<Conversation>> {
  return api.get<PagedResult<Conversation>>(`/conversations?page=${page}&pageSize=${pageSize}`);
}

/** Also marks the other party's messages as read as a side effect. Oldest-first within the page. */
export function getMessages(conversationId: string, page = 1, pageSize = 30): Promise<PagedResult<Message>> {
  return api.get<PagedResult<Message>>(`/conversations/${conversationId}/messages?page=${page}&pageSize=${pageSize}`);
}

/** At least one of content/imageUrl is required. Rate-limited to 20/min per user. */
export function sendMessage(conversationId: string, content: string | null, imageUrl: string | null): Promise<Message> {
  return api.post<Message>(`/conversations/${conversationId}/messages`, { content, imageUrl });
}

export function blockUser(userId: string): Promise<void> {
  return api.post<void>(`/users/${userId}/block`);
}

export function reportUser(targetUserId: string, reason: string): Promise<void> {
  return api.post<void>("/reports", { targetUserId, reason });
}
