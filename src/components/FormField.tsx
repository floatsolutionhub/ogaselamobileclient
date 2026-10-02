import { LucideIcon } from "lucide-react-native";
import { useState } from "react";
import { Text, TextInput, TextInputProps, View, Pressable } from "react-native";
import { Eye, EyeOff } from "lucide-react-native";

import { colors } from "@/theme/colors";

type FormFieldProps = TextInputProps & {
  label: string;
  icon?: LucideIcon;
  error?: string;
  touched?: boolean;
  secure?: boolean;
  /** Strips anything that isn't 0-9 as the user types or pastes (e.g. phone numbers). */
  digitsOnly?: boolean;
};

export function FormField({
  label,
  icon: Icon,
  error,
  touched,
  secure,
  digitsOnly,
  ...inputProps
}: FormFieldProps) {
  const [hidden, setHidden] = useState(!!secure);
  const showError = !!error && !!touched;

  return (
    <View className="mb-4">
      <Text className="mb-1.5 font-poppins-medium text-sm text-ink-700">
        {label}
      </Text>
      <View
        className={`flex-row items-center rounded-2xl border bg-surface px-4 ${
          showError ? "border-danger" : "border-brand-100"
        }`}
      >
        {Icon ? (
          <Icon size={18} color={colors.ink500} style={{ marginRight: 10 }} />
        ) : null}
        <TextInput
          className="flex-1 py-3.5 font-poppins text-base text-ink-900"
          placeholderTextColor={colors.ink300}
          secureTextEntry={hidden}
          {...inputProps}
          onChangeText={(text) =>
            inputProps.onChangeText?.(
              digitsOnly ? text.replace(/\D/g, "") : text,
            )
          }
        />
        {secure ? (
          <Pressable onPress={() => setHidden((prev) => !prev)} hitSlop={8}>
            {hidden ? (
              <EyeOff size={18} color={colors.ink500} />
            ) : (
              <Eye size={18} color={colors.ink500} />
            )}
          </Pressable>
        ) : null}
      </View>
      {showError ? (
        <Text className="mt-1 font-poppins text-xs text-danger">{error}</Text>
      ) : null}
    </View>
  );
}
