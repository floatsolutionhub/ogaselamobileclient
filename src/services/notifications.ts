// Ogasela.Api/Controllers/Notifications/NotificationsController.cs - one function per route.
// No mark-as-read endpoint exists (NotificationStatus tracks delivery, not read state).
import { api } from "@/lib/apiClient";
import type { NotificationListItem, NotificationPreferenceInput, PagedResult } from "@/types/api";

export function getNotifications(page = 1, pageSize = 20): Promise<PagedResult<NotificationListItem>> {
  return api.get<PagedResult<NotificationListItem>>(`/notifications?page=${page}&pageSize=${pageSize}`);
}

/** Every (channel, category) pair the app offers, with its current state - untouched pairs are enabled. */
export function getPreferences(): Promise<NotificationPreferenceInput[]> {
  return api.get<NotificationPreferenceInput[]>("/notifications/preferences");
}

/** Only the listed (channel, category) pairs are updated - omitted pairs are left unchanged. */
export function updatePreferences(preferences: NotificationPreferenceInput[]): Promise<void> {
  return api.put<void>("/notifications/preferences", { preferences });
}
