// Ogasela.Api/Controllers/Notifications/InboxController.cs - the bell's in-app inbox.
import { api } from "@/lib/apiClient";

export type InboxNotificationType =
  | "AdApproved"
  | "AdRejected"
  | "AdExpiringSoon"
  | "AdExpired"
  | "NewMessage"
  | "NewReview"
  | "Verification"
  | "DocumentApproved"
  | "DocumentRejected"
  | "AdTakenDown"
  | "AdReinstated"
  | "DisputeOpened"
  | "DisputeUpdate"
  | "DisputeResolved"
  | "OfficePickupUpdate";

export interface InboxNotification {
  id: string;
  type: InboxNotificationType | string;
  title: string;
  body: string;
  listingId: string | null;
  conversationId: string | null;
  disputeId?: string | null;
  /** Set for office pickup updates - tapping opens that request. */
  officePickupId?: string | null;
  /** More than 1 only for grouped chat messages. */
  count: number;
  isRead: boolean;
  updatedAt: string;
}

export interface InboxPage {
  items: InboxNotification[];
  page: number;
  pageSize: number;
  totalCount: number;
  unreadCount: number;
}

export function getInbox(page = 1, pageSize = 20): Promise<InboxPage> {
  return api.get<InboxPage>(`/me/inbox?page=${page}&pageSize=${pageSize}`);
}

export function getUnreadCount(): Promise<number> {
  return api.get<number>("/me/inbox/unread-count");
}

export function markRead(id: string): Promise<void> {
  return api.post<void>(`/me/inbox/${id}/read`);
}

export function markAllRead(): Promise<void> {
  return api.post<void>("/me/inbox/read-all");
}
