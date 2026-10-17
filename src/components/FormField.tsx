import { Eye, EyeOff, type LucideIcon } from "lucide-react-native";
import { useState } from "react";
import { Pressable, Text, TextInput, TextInputProps, View } from "react-native";

import { colors } from "@/theme/colors";
import { ICON } from "@/theme/typography";

type FormFieldProps = TextInputProps & {
  label: string;
  icon?: LucideIcon;
  error?: string;
  touched?: boolean;
  secure?: boolean;
  /** Strips anything that isn't 0-9 as the user types or pastes (e.g. phone numbers). */
  digitsOnly?: boolean;
  /** Overrides the label's text style, e.g. a bigger, bolder label on the Post an ad form. */
  labelClassName?: string;
};

export function FormField({
  label,
  icon: Icon,
  error,
  touched,
  secure,
  digitsOnly,
  labelClassName = "mb-1.5 font-poppins-medium text-body text-ink-700",
  ...inputProps
}: FormFieldProps) {
  const [hidden, setHidden] = useState(!!secure);
  const showError = !!error && !!touched;

  return (
    <View className="mb-4">
      <Text className={labelClassName}>{label}</Text>
      <View
        className={`flex-row items-center rounded-2xl border bg-surface px-4 ${
          showError ? "border-danger" : "border-brand-100"
        }`}
      >
        {Icon ? (
          <Icon size={ICON.md} color={colors.ink500} style={{ marginRight: 10 }} />
        ) : null}
        <TextInput
          className="flex-1 py-3.5 font-poppins text-subtitle text-ink-900"
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
              <EyeOff size={ICON.md} color={colors.ink500} />
            ) : (
              <Eye size={ICON.md} color={colors.ink500} />
            )}
          </Pressable>
        ) : null}
      </View>
      {showError ? (
        <Text className="mt-1 font-poppins text-caption text-danger">{error}</Text>
      ) : null}
    </View>
  );
}
