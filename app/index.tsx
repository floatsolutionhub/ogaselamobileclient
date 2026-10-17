import { LinearGradient } from "expo-linear-gradient";
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { Logo } from "@/components/Logo";
import { useAuth } from "@/context/AuthContext";
import { gradients } from "@/theme/colors";

const MIN_DISPLAY_MS = 1400;

export default function SplashRoute() {
  const { isLoading } = useAuth();
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const scale = useSharedValue(0.7);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withTiming(1, {
      duration: 700,
      easing: Easing.out(Easing.exp),
    });
    opacity.value = withTiming(1, { duration: 700 });

    const timer = setTimeout(() => setMinTimeElapsed(true), MIN_DISPLAY_MS);
    return () => clearTimeout(timer);
  }, [opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  if (!isLoading && minTimeElapsed) {
    return <Redirect href="/(app)/home" />;
  }

  return (
    <LinearGradient
      colors={gradients.hero}
      className="flex-1 items-center justify-center"
    >
      <Animated.View style={animatedStyle} className="items-center">
        <View className="rounded-3xl bg-white p-6">
          <Logo size={72} />
        </View>
        <Text className="mt-5 font-poppins-bold text-display text-white">
          Ogasela
        </Text>
        <Text className="mt-1 font-poppins text-body text-white/80">
          Quality products, genuine sellers
        </Text>
      </Animated.View>
    </LinearGradient>
  );
}
