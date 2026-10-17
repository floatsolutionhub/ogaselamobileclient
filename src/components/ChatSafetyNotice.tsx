import { ShieldAlert } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";

import * as messagingService from "@/services/messaging";
import { colors } from "@/theme/colors";
import { ICON } from "@/theme/typography";

/** Shown until the admin-set text loads (or if it can't be fetched). Matches the API's default. */
const DEFAULT_NOTICE = "Do not send money for an item you have not seen and verified";

// The last text fetched this session, so reopening a chat shows it straight away.
let cachedNotice: string | null = null;

/** Safety caption above the message box. The text is set by SuperAdmins in the Control Portal. */
export function ChatSafetyNotice() {
  const [text, setText] = useState(cachedNotice ?? DEFAULT_NOTICE);

  useEffect(() => {
    let active = true;
    messagingService
      .getSafetyNotice()
      .then(({ text: latest }) => {
        cachedNotice = latest;
        if (active) setText(latest);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  return (
    <View
      accessibilityRole="alert"
      className="flex-row items-start gap-2 rounded-xl border border-gold-200 bg-gold-50 px-3 py-2"
    >
      <ShieldAlert size={ICON.sm} color={colors.gold700} style={{ marginTop: 1 }} />
      <Text className="flex-1 font-poppins-medium text-caption text-ink-900">
        {text}
      </Text>
    </View>
  );
}
