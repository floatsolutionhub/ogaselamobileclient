import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { X } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import {
  getActiveAnnouncements,
  getDismissedAnnouncementIds,
  markAnnouncementRead,
  type Announcement,
} from "@/services/announcements";
import { colors } from "@/theme/colors";

/**
 * Pops up the newest active announcement this device hasn't closed yet. Closing it (the X, or
 * Android's back button) or pressing its button marks it read, so it never shows again here.
 * `enabled` lets the home screen hold it back until other first-run prompts are done.
 */
export function AnnouncementModal({ enabled }: { enabled: boolean }) {
  const { width } = useWindowDimensions();
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    (async () => {
      try {
        const [items, dismissed] = await Promise.all([
          getActiveAnnouncements(),
          getDismissedAnnouncementIds(),
        ]);
        const next = items.find((item) => !dismissed.includes(item.id));
        if (active && next) setAnnouncement(next);
      } catch {
        // No announcement is better than an error popping up on the home screen.
      }
    })();
    return () => {
      active = false;
    };
  }, [enabled]);

  if (!announcement) return null;

  const cardWidth = Math.min(width - 48, 420);

  const close = () => {
    markAnnouncementRead(announcement.id);
    setAnnouncement(null);
  };

  const openCta = () => {
    const url = announcement.cta?.url;
    close();
    if (!url) return;
    if (url.startsWith("http")) {
      WebBrowser.openBrowserAsync(url).catch(() => {});
    } else {
      Linking.openURL(url).catch(() => {});
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View
        className="flex-1 items-center justify-center px-6"
        style={{ backgroundColor: "rgba(16,24,40,0.6)" }}
      >
        <View
          className="overflow-hidden rounded-3xl bg-white"
          style={{ width: cardWidth }}
        >
          <View>
            <Image
              source={{ uri: announcement.image }}
              style={{ width: cardWidth, height: cardWidth * 0.75 }}
              className="bg-brand-50"
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
            <Pressable
              onPress={close}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close"
              className="absolute right-3 top-3 h-9 w-9 items-center justify-center rounded-full bg-white/90"
            >
              <X size={18} color={colors.ink900} />
            </Pressable>
          </View>

          <View className="p-5">
            <Text className="font-poppins-bold text-lg text-ink-900">
              {announcement.title}
            </Text>
            <Text className="mt-1.5 font-poppins text-sm leading-5 text-ink-700">
              {announcement.caption}
            </Text>

            {announcement.cta ? (
              <Pressable
                onPress={openCta}
                accessibilityRole="button"
                className="mt-5 items-center rounded-2xl bg-brand-600 py-3.5 active:opacity-90"
              >
                <Text className="font-poppins-semibold text-sm text-white">
                  {announcement.cta.label}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}
