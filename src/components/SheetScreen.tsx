import { router } from "expo-router";
import { X } from "lucide-react-native";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "@/theme/colors";

type SheetScreenProps = {
  children: React.ReactNode;
  scroll?: boolean;
};

/** Leave the auth flow: back to the screen that opened it, or Home if it was opened on its own (deep link, cold start). */
function closeSheet() {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace("/(app)/home");
  }
}

/**
 * Body of every sheet-style modal. The top safe-area edge only pads where this view actually
 * overlaps the status bar/notch: none when shown as a sheet, but enough to keep the content clear
 * when the route opens full screen (e.g. from a deep link or a cold start onto the route).
 * The close button gets its own row above the content, outside the scroll area, so it's always
 * reachable and never overlaps a title - swiping the sheet down isn't obvious, and isn't possible
 * at all when the route opens full screen.
 */
export function SheetScreen({ children, scroll = true }: SheetScreenProps) {
  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white">
      <View className="flex-row justify-end px-4 pt-3">
        <Pressable
          onPress={closeSheet}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close"
          className="h-9 w-9 items-center justify-center rounded-full bg-surface"
        >
          <X size={18} color={colors.ink700} />
        </Pressable>
      </View>

      {scroll ? (
        <ScrollView
          className="flex-1 bg-white px-6"
          contentContainerStyle={{ paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View className="flex-1 bg-white px-6">{children}</View>
      )}
    </SafeAreaView>
  );
}
