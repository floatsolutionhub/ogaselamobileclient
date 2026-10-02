import * as WebBrowser from "expo-web-browser";
import { Check } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { LINKS } from "@/config/links";
import { colors } from "@/theme/colors";

type TermsCheckboxProps = {
  checked: boolean;
  onChange: (value: boolean) => void;
  error?: string;
};

export function TermsCheckbox({
  checked,
  onChange,
  error,
}: TermsCheckboxProps) {
  return (
    <View className="mb-2">
      <View className="flex-row items-start gap-3">
        <Pressable
          onPress={() => onChange(!checked)}
          hitSlop={8}
          accessibilityRole="checkbox"
          accessibilityState={{ checked }}
          accessibilityLabel="Accept the Terms and Privacy Policy"
          className="h-6 w-6 items-center justify-center rounded-md border"
          style={{
            borderColor: error ? colors.danger : colors.brand300,
            backgroundColor: checked ? colors.brand500 : "transparent",
          }}
        >
          {checked ? <Check size={14} color="#FFFFFF" strokeWidth={3} /> : null}
        </Pressable>
        <Text
          className="flex-1 font-poppins text-sm leading-5 text-ink-700"
          onPress={() => onChange(!checked)}
        >
          I agree to the{" "}
          <Text
            className="font-poppins-medium text-brand-600"
            onPress={() => WebBrowser.openBrowserAsync(LINKS.terms)}
          >
            Terms
          </Text>{" "}
          and{" "}
          <Text
            className="font-poppins-medium text-brand-600"
            onPress={() => WebBrowser.openBrowserAsync(LINKS.privacy)}
          >
            Privacy Policy
          </Text>
        </Text>
      </View>
      {error ? (
        <Text className="mt-1 font-poppins text-xs text-danger">{error}</Text>
      ) : null}
    </View>
  );
}
