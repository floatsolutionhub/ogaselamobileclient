import { router } from "expo-router";
import { MapPin } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Linking, Platform, Pressable, Text, View } from "react-native";
import Toast from "react-native-toast-message";

import { PrimaryButton } from "@/components/PrimaryButton";
import { useLocation } from "@/context/LocationContext";
import { requestAndResolveLocation, type LocationFailure } from "@/services/locationService";
import { colors } from "@/theme/colors";

const FAILURE_MESSAGE: Record<LocationFailure, { title: string; body: string }> = {
  denied: {
    title: "Location access not granted",
    body: "Tap Allow when asked, or choose your area manually.",
  },
  blocked: {
    title: "Location access is turned off for Ogasela",
    body: "Open Settings, allow Location for Ogasela, then come back and try again.",
  },
  servicesOff: {
    title: "Your phone's location is switched off",
    body:
      Platform.OS === "ios"
        ? "Turn on Settings > Privacy & Security > Location Services, then try again."
        : "Turn on Location from your quick settings (swipe down from the top), then try again.",
  },
  unavailable: {
    title: "Couldn't find your location",
    body: "We couldn't get a signal. Move near a window or try again, or choose your area manually.",
  },
};

export default function LocationPermissionSheet() {
  const { setLocation, markOnboardingComplete } = useLocation();
  const [requesting, setRequesting] = useState(false);
  /** The last failure: shown under the button, which becomes "Try again" (or "Open Settings" when blocked). */
  const [failure, setFailure] = useState<LocationFailure | null>(null);

  useEffect(() => {
    markOnboardingComplete();
  }, [markOnboardingComplete]);

  const handleAllow = async () => {
    if (failure === "blocked") {
      // Only the app's Settings page can lift a permanent denial - asking again would fail silently.
      setFailure(null);
      await Linking.openSettings();
      return;
    }
    setRequesting(true);
    try {
      const result = await requestAndResolveLocation();
      if (!result.ok) {
        setFailure(result.reason);
        const message = FAILURE_MESSAGE[result.reason];
        Toast.show({ type: "info", text1: message.title, text2: message.body });
        return;
      }
      const resolved = result.location;
      setFailure(null);
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
        <Text className="mt-5 text-center font-poppins-bold text-heading text-ink-900">
          Find things near you
        </Text>
        <Text className="mt-2 text-center font-poppins text-body leading-5 text-ink-500">
          Ogasela uses your location to show listings and sellers close to
          you, and to help buyers find what you post. You can change this
          anytime from the location picker.
        </Text>
      </View>

      <View className="mt-8">
        {failure ? (
          <Text className="mb-3 text-center font-poppins text-caption leading-5 text-ink-500">
            {FAILURE_MESSAGE[failure].body}
          </Text>
        ) : null}
        <PrimaryButton
          label={
            failure === "blocked"
              ? "Open Settings"
              : failure
                ? "Try again"
                : "Allow location access"
          }
          loading={requesting}
          onPress={handleAllow}
        />
      </View>

      <Pressable
        onPress={() => router.replace("/(modals)/location-picker")}
        className="mb-4 mt-4 items-center py-2"
      >
        <Text className="font-poppins-semibold text-body text-brand-600">
          Choose my area manually
        </Text>
      </Pressable>
    </View>
  );
}
