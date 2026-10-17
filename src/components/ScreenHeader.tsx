import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { colors } from "@/theme/colors";
import { ICON } from "@/theme/typography";

/** Back button + title row used at the top of the Settings sub-screens. */
export function ScreenHeader({ title }: { title: string }) {
  const router = useRouter();
  return (
    <View className="flex-row items-center gap-3 px-6 pb-2 pt-4">
      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Back"
        className="h-10 w-10 items-center justify-center rounded-full bg-white"
      >
        <ChevronLeft size={ICON.lg} color={colors.ink700} />
      </Pressable>
      <Text className="font-poppins-bold text-display text-ink-900">{title}</Text>
    </View>
  );
}
