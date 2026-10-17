import {
  BarChart3,
  Bell,
  ChevronRight,
  Megaphone,
  PackageCheck,
  HelpCircle,
  LogOut,
  Mail,
  Phone,
  Shield,
  Trash2,
  Settings2Icon,
  Scale,
  UserRound,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import {
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import Toast from "react-native-toast-message";

import { GradientScreen } from "@/components/GradientScreen";
import { useAuth } from "@/context/AuthContext";
import { VerificationStatusPill } from "@/components/VerificationStatusPill";
import { useProtectedRoute } from "@/hooks/useProtectedRoute";
import { useVerificationOverview } from "@/hooks/useVerificationOverview";
import { colors } from "@/theme/colors";
import { env } from "@/config/env";
import { LINKS } from "@/config/links";
import { ICON } from "@/theme/typography";

const QUICK_LINKS = [
  { icon: Megaphone, label: "My ads" },
  { icon: BarChart3, label: "Analytics" },
  { icon: Bell, label: "Notifications" },
];

const MENU_ITEMS = [
  { icon: Shield, label: "Privacy policy" },
  { icon: Shield, label: "Terms & Conditions" },
  { icon: PackageCheck, label: "Office pickups" },
  { icon: Scale, label: "Disputes" },
  { icon: HelpCircle, label: "Help & support" },
  { icon: Settings2Icon, label: "Settings" },
];

export default function ProfileScreen() {
  useProtectedRoute("/(app)/profile");
  const { user, logout } = useAuth();
  const { overview: verification } = useVerificationOverview();
  const router = useRouter();

  const handleMenuPress = (label: string) => {
    if (label === "Settings") {
      router.push("/settings");
      return;
    }
    if (label === "My ads") {
      router.push("/my-ads");
      return;
    }
    if (label === "Analytics") {
      router.push("/analytics");
      return;
    }
    if (label === "Office pickups") {
      router.push("/office-pickups");
      return;
    }
    if (label === "Disputes") {
      router.push("/disputes");
      return;
    }
    if (label === "Notifications") {
      router.push("/notifications");
      return;
    }
    // Same website pages the sign-in and sign-up screens link to.
    if (label === "Privacy policy") {
      WebBrowser.openBrowserAsync(LINKS.privacy);
      return;
    }
    if (label === "Terms & Conditions") {
      WebBrowser.openBrowserAsync(LINKS.terms);
      return;
    }
    if (label === "Help & support") {
      WebBrowser.openBrowserAsync(LINKS.contact);
      return;
    }
    Toast.show({ type: "info", text1: label, text2: "Coming soon" });
  };

  return (
    <GradientScreen>
      <ScrollView
        className="px-6 pt-6"
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <Text className="font-poppins-bold text-display text-ink-900">Profile</Text>

        <View className="mt-5 items-center rounded-3xl border border-brand-50 bg-white p-6">
          {user?.profilePhotoUrl ? (
            <Image
              source={{ uri: user.profilePhotoUrl }}
              className="h-16 w-16 rounded-full bg-brand-50"
              accessibilityLabel="Profile photo"
            />
          ) : (
            <View className="h-16 w-16 items-center justify-center rounded-full bg-brand-50">
              <UserRound size={32} color={colors.brand600} strokeWidth={1.5} />
            </View>
          )}
          <Text className="mt-3 font-poppins-semibold text-title text-ink-900">
            {user?.name ?? "Ogasela user"}
          </Text>

          <View className="mt-4 w-full items-center gap-2">
            <View className="flex-row items-center gap-2">
              <Mail size={ICON.sm} color={colors.ink500} />
              <Text className="font-poppins text-caption text-ink-500">
                {user?.email}
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Phone size={ICON.sm} color={colors.ink500} />
              <Text className="font-poppins text-caption text-ink-500">
                {user?.phone}
              </Text>
            </View>
          </View>

          {verification ? (
            <View className="mt-3 flex-row flex-wrap justify-center gap-2">
              <VerificationStatusPill
                label="Account"
                status={verification.personal.status}
                onPress={() => router.push("/personal-info")}
              />
              <VerificationStatusPill
                label="Business"
                status={verification.business?.status ?? null}
                onPress={
                  verification.business
                    ? () => router.push("/business-info")
                    : undefined
                }
              />
            </View>
          ) : null}
        </View>

        <View className="mt-6 flex-row rounded-3xl border border-brand-50 bg-white p-2">
          {QUICK_LINKS.map((item) => (
            <Pressable
              key={item.label}
              onPress={() => handleMenuPress(item.label)}
              className="flex-1 items-center gap-2 rounded-2xl py-4 active:bg-brand-50"
            >
              <View className="h-11 w-11 items-center justify-center rounded-full bg-brand-50">
                <item.icon size={ICON.lg} color={colors.brand600} />
              </View>
              <Text className="font-poppins-medium text-caption text-ink-900">
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>


        <View className="mt-6 overflow-hidden rounded-3xl border border-brand-50 bg-white">
          {MENU_ITEMS.map((item, index) => (
            <Pressable
              key={item.label}
              onPress={() => handleMenuPress(item.label)}
              className={`flex-row items-center justify-between px-5 py-4 active:bg-brand-50 ${
                index !== MENU_ITEMS.length - 1
                  ? "border-b border-brand-50"
                  : ""
              }`}
            >
              <View className="flex-row items-center gap-3">
                <item.icon size={ICON.md} color={colors.brand600} />
                <Text className="font-poppins-medium text-body text-ink-900">
                  {item.label}
                </Text>
              </View>
              <ChevronRight size={ICON.sm} color={colors.ink300} />
            </Pressable>
          ))}
        </View>

        <Text className="mt-4 text-center font-poppins text-caption text-ink-300">
          You’ll be automatically signed out after {env.autoLogoutMinutes}{" "}
          minutes of inactivity.
        </Text>

        <Pressable
          onPress={() => WebBrowser.openBrowserAsync(LINKS.accountDeletion)}
          accessibilityRole="link"
          className="mt-6 flex-row items-center justify-center gap-2 rounded-2xl border border-ink-300/40 bg-white py-4"
        >
          <Trash2 size={ICON.md} color={colors.ink700} />
          <Text className="font-poppins-semibold text-body text-ink-700">
            Delete My Data
          </Text>
        </Pressable>

        <Pressable
          onPress={() => logout()}
          className="mt-3 flex-row items-center justify-center gap-2 rounded-2xl border border-danger/20 bg-danger/5 py-4"
        >
          <LogOut size={ICON.md} color={colors.danger} />
          <Text className="font-poppins-semibold text-body text-danger">
            Log out
          </Text>
        </Pressable>
      </ScrollView>
    </GradientScreen>
  );
}
