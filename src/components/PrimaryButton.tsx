import { LinearGradient } from "expo-linear-gradient";
import { ActivityIndicator, Pressable, Text } from "react-native";

import { gradients } from "@/theme/colors";

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
};

export function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
}: PrimaryButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      className="overflow-hidden rounded-2xl"
      style={{ opacity: isDisabled ? 0.6 : 1 }}
    >
      <LinearGradient
        colors={gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="items-center justify-center py-4"
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text className="font-poppins-semibold text-subtitle text-white">
            {label}
          </Text>
        )}
      </LinearGradient>
    </Pressable>
  );
}
