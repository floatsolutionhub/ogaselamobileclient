// Ogasela.Api/Controllers/Marketing/AnnouncementsController.cs - public route only.
import AsyncStorage from "@react-native-async-storage/async-storage";

import { api } from "@/lib/apiClient";

/** A home-screen pop-up from the app team: { title, caption, image } plus an optional button. */
export interface Announcement {
  id: string;
  title: string;
  caption: string;
  image: string;
  cta: { label: string; url: string } | null;
  createdAt: string;
}

const DISMISSED_KEY = "ogasela_dismissed_announcements_v1";

export function getActiveAnnouncements(): Promise<Announcement[]> {
  return api.get<Announcement[]>("/announcements/active");
}

/** Ids this device has already closed - each announcement pops up once per device. */
export async function getDismissedAnnouncementIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(DISMISSED_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export async function markAnnouncementRead(id: string): Promise<void> {
  const dismissed = await getDismissedAnnouncementIds();
  if (dismissed.includes(id)) return;
  // Keep the list from growing forever; old announcements are long gone by then.
  const next = [...dismissed, id].slice(-100);
  await AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify(next)).catch(
    () => {},
  );
}
