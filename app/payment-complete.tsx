import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";

import { colors } from "@/theme/colors";

/**
 * Lands here only if ogasela://payment-complete opens the app outside the checkout session (e.g. the
 * payer tapped "Return to the app" after the session ended). The checkout screen that started the
 * payment does the confirming, so just step back to it.
 */
export default function PaymentCompleteScreen() {
  const router = useRouter();
  useEffect(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }, [router]);

  return (
    <View className="flex-1 items-center justify-center bg-white">
      <ActivityIndicator color={colors.brand600} />
    </View>
  );
}
