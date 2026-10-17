import { useRouter } from "expo-router";
import {
  Bell,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  KeyRound,
  Mail,
  Phone,
  User,
  type LucideIcon,
} from "lucide-react-native";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useProtectedRoute } from "@/hooks/useProtectedRoute";
import { colors } from "@/theme/colors";
import { ICON } from "@/theme/typography";

/** Where each item opens. */
const ROUTES = {
  "personal-info": "/personal-info",
  "business-info": "/business-info",
  "change-phone": "/change-contact?type=phone",
  "change-email": "/change-contact?type=email",
  "update-password": "/update-password",
  "manage-notifications": "/notification-settings",
} as const;

type SettingsItem = {
  key: keyof typeof ROUTES;
  icon: LucideIcon;
  label: string;
  description: string;
  /** Business info only applies to seller accounts. */
  sellerOnly?: boolean;
};

const SECTIONS: { title: string; items: SettingsItem[] }[] = [
  {
    title: "Account",
    items: [
      {
        key: "personal-info",
        icon: User,
        label: "Personal Info",
        description: "Your name and profile details",
      },
      {
        key: "business-info",
        icon: Briefcase,
        label: "Business Info",
        description: "Business details and documents",
        sellerOnly: true,
      },
    ],
  },
  {
    title: "Contact",
    items: [
      {
        key: "change-phone",
        icon: Phone,
        label: "Change Phone Number",
        description: "Used for sign-in codes - needs approval",
      },
      {
        key: "change-email",
        icon: Mail,
        label: "Change Email",
        description: "Used for receipts and reset codes - needs approval",
      },
    ],
  },
  {
    title: "Security & alerts",
    items: [
      {
        key: "update-password",
        icon: KeyRound,
        label: "Update Password",
        description: "Change your sign-in password",
      },
      {
        key: "manage-notifications",
        icon: Bell,
        label: "Manage Notifications",
        description: "Choose what we notify you about",
      },
    ],
  },
];

export default function SettingsScreen() {
  useProtectedRoute("/settings");
  const router = useRouter();
  const { user } = useAuth();
  const isSeller = user?.role === "Seller";

  const handlePress = (item: SettingsItem) => {
    router.push(ROUTES[item.key]);
  };

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="flex-row items-center gap-3 px-6 pb-2 pt-4">
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
          className="h-10 w-10 items-center justify-center rounded-full bg-white"
        >
          <ChevronLeft size={ICON.lg} color={colors.ink700} />
        </Pressable>
        <Text className="font-poppins-bold text-display text-ink-900">
          Settings
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
      >
        {SECTIONS.map((section) => {
          const items = section.items.filter(
            (item) => !item.sellerOnly || isSeller,
          );
          if (items.length === 0) return null;

          return (
            <View key={section.title} className="mt-6">
              <Text className="mb-2 px-1 font-poppins-medium text-caption uppercase tracking-wide text-ink-500">
                {section.title}
              </Text>
              <View className="overflow-hidden rounded-3xl border border-brand-50 bg-white">
                {items.map((item, index) => (
                  <Pressable
                    key={item.key}
                    onPress={() => handlePress(item)}
                    className={`flex-row items-center gap-3 px-5 py-4 active:bg-brand-50 ${
                      index !== items.length - 1
                        ? "border-b border-brand-50"
                        : ""
                    }`}
                  >
                    <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-50">
                      <item.icon size={ICON.md} color={colors.brand600} />
                    </View>
                    <View className="flex-1">
                      <Text className="font-poppins-medium text-body text-ink-900">
                        {item.label}
                      </Text>
                      <Text className="font-poppins text-caption text-ink-500">
                        {item.description}
                      </Text>
                    </View>
                    <ChevronRight size={ICON.sm} color={colors.ink300} />
                  </Pressable>
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
