import "../global.css";
import "@/lib/nativewind-interop";

// Per-weight imports: the package root would bundle all 18 Poppins files (~3MB) into the app.
import { Poppins_400Regular } from "@expo-google-fonts/poppins/400Regular";
import { Poppins_500Medium } from "@expo-google-fonts/poppins/500Medium";
import { Poppins_600SemiBold } from "@expo-google-fonts/poppins/600SemiBold";
import { Poppins_700Bold } from "@expo-google-fonts/poppins/700Bold";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { AuthProvider, useAuth } from "@/context/AuthContext";
import { FavouritesProvider } from "@/context/FavouritesContext";
import { LocationProvider } from "@/context/LocationContext";
import { UnreadMessagesProvider } from "@/context/UnreadMessagesContext";
import { AppToast } from "@/components/AppToast";
import { colors } from "@/theme/colors";

SplashScreen.preventAutoHideAsync().catch(() => {});

const sheetScreenOptions = {
  headerShown: false,
  presentation: "formSheet" as const,
  sheetGrabberVisible: true,
  sheetCornerRadius: 24,
  sheetLargestUndimmedDetentIndex: -1 as const,
};

/**
 * Any touch anywhere - tabs, pushed screens, sheets - resets the auto-logout timer. It used to sit
 * on the tab layout only, so someone busy on a listing, a chat or a settings screen was treated as
 * idle and signed out mid-task.
 */
function ActivityTracker({ children }: { children: React.ReactNode }) {
  const { registerActivity } = useAuth();
  return (
    <GestureHandlerRootView style={{ flex: 1 }} onTouchStart={registerActivity}>
      {children}
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <AuthProvider>
      <ActivityTracker>
        <FavouritesProvider>
          <UnreadMessagesProvider>
            <LocationProvider>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="(app)" />
                <Stack.Screen
                  name="search"
                  options={{ presentation: "card" }}
                />
                <Stack.Screen
                  name="listing/[id]"
                  options={{ presentation: "card" }}
                />
                <Stack.Screen
                  name="settings"
                  options={{ presentation: "card" }}
                />
                <Stack.Screen
                  name="my-ads"
                  options={{ presentation: "card" }}
                />
                <Stack.Screen
                  name="seller/[id]"
                  options={{ presentation: "card" }}
                />
                <Stack.Screen
                  name="analytics"
                  options={{ presentation: "card" }}
                />
                <Stack.Screen
                  name="notifications"
                  options={{ presentation: "card" }}
                />
                <Stack.Screen
                  name="personal-info"
                  options={{ presentation: "card" }}
                />
                <Stack.Screen
                  name="business-info"
                  options={{ presentation: "card" }}
                />
                <Stack.Screen
                  name="change-contact"
                  options={{ presentation: "card" }}
                />
                <Stack.Screen
                  name="update-password"
                  options={{ presentation: "card" }}
                />
                <Stack.Screen
                  name="notification-settings"
                  options={{ presentation: "card" }}
                />
                <Stack.Screen
                  name="choose-plan"
                  options={{ presentation: "card" }}
                />
                <Stack.Screen
                  name="disputes/index"
                  options={{ presentation: "card" }}
                />
                <Stack.Screen
                  name="disputes/new"
                  options={{ presentation: "card" }}
                />
                <Stack.Screen
                  name="disputes/[id]"
                  options={{ presentation: "card" }}
                />
                <Stack.Screen
                  name="payment-complete"
                  options={{ presentation: "transparentModal", animation: "none" }}
                />
                <Stack.Screen
                  name="office-pickups/index"
                  options={{ presentation: "card" }}
                />
                <Stack.Screen
                  name="office-pickups/[id]"
                  options={{ presentation: "card" }}
                />
                <Stack.Screen
                  name="face-capture"
                  options={{ presentation: "fullScreenModal" }}
                />
                <Stack.Screen
                  name="(modals)/sign-in"
                  options={{
                    ...sheetScreenOptions,
                    sheetAllowedDetents: [0.6],
                  }}
                />
                <Stack.Screen
                  name="(modals)/sign-in-phone"
                  options={{
                    ...sheetScreenOptions,
                    sheetAllowedDetents: [0.55],
                  }}
                />
                <Stack.Screen
                  name="(modals)/sign-up-step1"
                  options={{
                    ...sheetScreenOptions,
                    sheetAllowedDetents: [0.75],
                  }}
                />
                <Stack.Screen
                  name="(modals)/sign-up-step2"
                  options={{
                    ...sheetScreenOptions,
                    sheetAllowedDetents: [0.9],
                  }}
                />
                <Stack.Screen
                  name="(modals)/verify-otp"
                  options={{
                    ...sheetScreenOptions,
                    sheetAllowedDetents: [0.55],
                  }}
                />
                <Stack.Screen
                  name="(modals)/forgot-password"
                  options={{
                    ...sheetScreenOptions,
                    sheetAllowedDetents: [0.6],
                  }}
                />
                <Stack.Screen
                  name="(modals)/location-picker"
                  options={{
                    ...sheetScreenOptions,
                    sheetAllowedDetents: [0.5, 0.92],
                    sheetInitialDetentIndex: 0,
                  }}
                />
                <Stack.Screen
                  name="(modals)/location-permission"
                  options={{
                    ...sheetScreenOptions,
                    sheetAllowedDetents: [0.55],
                  }}
                />
                <Stack.Screen
                  name="(modals)/conversation"
                  options={{
                    headerShown: false,
                    presentation: "card",
                  }}
                />
                <Stack.Screen
                  name="(modals)/terms"
                  options={{
                    presentation: "modal",
                    headerShown: true,
                    title: "Terms of Service",
                    headerTintColor: colors.ink900,
                  }}
                />
                <Stack.Screen
                  name="(modals)/privacy"
                  options={{
                    presentation: "modal",
                    headerShown: true,
                    title: "Privacy Notice",
                    headerTintColor: colors.ink900,
                  }}
                />
              </Stack>
              <AppToast />
            </LocationProvider>
          </UnreadMessagesProvider>
        </FavouritesProvider>
      </ActivityTracker>
    </AuthProvider>
  );
}
