import { router } from "expo-router";
import { MapPin } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Toast from "react-native-toast-message";

import { PrimaryButton } from "@/components/PrimaryButton";
import { useLocation } from "@/context/LocationContext";
import { requestAndResolveLocation } from "@/services/locationService";
import { colors } from "@/theme/colors";

export default function LocationPermissionSheet() {
  const { setLocation, markOnboardingComplete } = useLocation();
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    markOnboardingComplete();
  }, [markOnboardingComplete]);

  const handleAllow = async () => {
    setRequesting(true);
    try {
      const resolved = await requestAndResolveLocation();
      if (!resolved) {
        Toast.show({
          type: "info",
          text1: "Location access not granted",
          text2: "You can set your area manually instead.",
        });
        return;
      }
      setLocation(resolved.city, resolved.state, resolved.coords);
      Toast.show({
        type: "success",
        text1: "Location set",
        text2: `Showing listings near ${resolved.city}, ${resolved.state}.`,
      });
      router.back();
    } catch {
      Toast.show({
        type: "error",
        text1: "Couldn't get your location",
        text2: "Please try again or set your area manually.",
      });
    } finally {
      setRequesting(false);
    }
  };

  return (
    <View className="flex-1 bg-white px-6 pt-6">
      <View className="items-center">
        <View className="h-16 w-16 items-center justify-center rounded-full bg-brand-50">
          <MapPin size={28} color={colors.brand600} />
        </View>
        <Text className="mt-5 text-center font-poppins-bold text-xl text-ink-900">
          Find things near you
        </Text>
        <Text className="mt-2 text-center font-poppins text-sm leading-5 text-ink-500">
          Ogasela uses your location to show listings and sellers close to
          you, and to help buyers find what you post. You can change this
          anytime from the location picker.
        </Text>
      </View>

      <View className="mt-8">
        <PrimaryButton
          label="Allow location access"
          loading={requesting}
          onPress={handleAllow}
        />
      </View>

      <Pressable
        onPress={() => router.replace("/(modals)/location-picker")}
        className="mb-4 mt-4 items-center py-2"
      >
        <Text className="font-poppins-semibold text-sm text-brand-600">
          Choose my area manually
        </Text>
      </Pressable>
    </View>
  );
}
