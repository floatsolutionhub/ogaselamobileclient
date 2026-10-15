import { Building2 } from "lucide-react-native";
import { Text, View } from "react-native";

import { colors } from "@/theme/colors";

/** Shown next to a seller whose business staff have verified (registration + proof of office address). */
export function VerifiedBusinessPill() {
  return (
    <View className="my-0.5 flex-row items-center gap-1 self-start rounded-full bg-brand-50 px-2 py-0.5">
      <Building2 size={11} color={colors.brand700} />
      <Text className="font-poppins-medium text-[10px] text-brand-700">
        Verified business
      </Text>
    </View>
  );
}
