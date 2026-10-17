import { Phone } from "lucide-react-native";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { colors } from "@/theme/colors";
import { ICON } from "@/theme/typography";

type SocialButtonProps = {
  provider: "google" | "facebook" | "phone";
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
};

function ProviderBadge({
  provider,
}: {
  provider: SocialButtonProps["provider"];
}) {
  if (provider === "phone") {
    return <Phone size={ICON.md} color={colors.brand600} />;
  }

  const isGoogle = provider === "google";
  return (
    <View
      className="h-5 w-5 items-center justify-center rounded-full"
      style={{ backgroundColor: isGoogle ? "#EA4335" : "#1877F2" }}
    >
      <Text className="font-poppins-bold text-micro text-white">
        {isGoogle ? "G" : "f"}
      </Text>
    </View>
  );
}

export function SocialButton({
  provider,
  label,
  onPress,
  loading,
  disabled,
}: SocialButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      className="flex-row items-center justify-center gap-2 rounded-2xl border border-brand-100 bg-white py-3.5 active:bg-brand-50"
      style={{ opacity: disabled && !loading ? 0.6 : 1 }}
    >
      {loading ? (
        <ActivityIndicator color={colors.brand600} />
      ) : (
        <ProviderBadge provider={provider} />
      )}
      <Text className="font-poppins-medium text-body text-ink-700">{label}</Text>
    </Pressable>
  );
}
