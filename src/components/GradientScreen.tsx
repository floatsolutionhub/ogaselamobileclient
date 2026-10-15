import { LinearGradient } from "expo-linear-gradient";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

import { gradients } from "@/theme/colors";

type GradientScreenProps = {
  children: React.ReactNode;
  scroll?: boolean;
  /** Screens sitting above the tab bar drop "bottom" - the tab bar already pads for the home indicator. */
  edges?: Edge[];
};

export function GradientScreen({ children, scroll = true, edges }: GradientScreenProps) {
  // Deliberately not "const Content = scroll ? ScrollView : (props) => <>{props.children}</>" -
  // that inline arrow function is a brand-new component identity on every render, which makes
  // React unmount and remount the whole subtree (wiping any Formik/form state inside it) on
  // every single re-render of whatever screen this wraps. ScrollView and View are both stable,
  // module-level component references, so branching between them as actual JSX (rather than via
  // an intermediate variable) keeps the subtree's identity - and its state - intact across renders.
  return (
    <LinearGradient colors={gradients.screen} className="flex-1">
      <SafeAreaView className="flex-1" edges={edges}>
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 24 : 0}
        >
          {scroll ? (
            <ScrollView
              contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </ScrollView>
          ) : (
            <View className="flex-1">{children}</View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}
