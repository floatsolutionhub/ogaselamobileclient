import {
  BarChart3,
  Bell,
  ChevronRight,
  Megaphone,
  HelpCircle,
  LogOut,
  Mail,
  Phone,
  Shield,
  Trash2,
  Wallet as WalletIcon,
  Settings2Icon,
  Scale,
  UserRound,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import Toast from "react-native-toast-message";

import { GradientScreen } from "@/components/GradientScreen";
import { useAuth } from "@/context/AuthContext";
import { useProtectedRoute } from "@/hooks/useProtectedRoute";
import { ApiError } from "@/lib/apiClient";
import * as walletService from "@/services/wallet";
import { colors } from "@/theme/colors";
import { env } from "@/config/env";
import { LINKS } from "@/config/links";
import { formatNaira } from "@/utils/currency";
import type { Wallet } from "@/types/api";

const QUICK_LINKS = [
  { icon: Megaphone, label: "My ads" },
  { icon: BarChart3, label: "Analytics" },
  { icon: Bell, label: "Notifications" },
];

const MENU_ITEMS = [
  { icon: Shield, label: "Privacy policy" },
  { icon: Shield, label: "Terms & Conditions" },
  { icon: Scale, label: "Disputes" },
  { icon: HelpCircle, label: "Help & support" },
  { icon: Settings2Icon, label: "Settings" },
];

export default function ProfileScreen() {
  useProtectedRoute("/(app)/profile");
  const { user, logout } = useAuth();
  const router = useRouter();

  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [walletLoading, setWalletLoading] = useState(true);
  const [fundAmount, setFundAmount] = useState("");
  const [funding, setFunding] = useState(false);

  // Signed-out visitors are redirected to sign-in by useProtectedRoute; don't hit the wallet API
  // for them (that only produced an "unauthorized" toast). Reloads when the account changes.
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    (async () => {
      setWalletLoading(true);
      try {
        const result = await walletService.getWallet();
        if (!cancelled) setWallet(result);
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof ApiError
              ? error.message
              : "Something went wrong. Please try again.";
          Toast.show({
            type: "error",
            text1: "Couldn't load wallet",
            text2: message,
          });
        }
      } finally {
        if (!cancelled) setWalletLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const handleFundWallet = async () => {
    const naira = Number(fundAmount);
    if (!naira || naira <= 0) {
      Toast.show({ type: "error", text1: "Enter a valid amount to fund" });
      return;
    }

    setFunding(true);
    try {
      // Wallet balances are stored/displayed in kobo throughout this app (1/100 naira) -
      // convert the naira amount the user typed before sending it to the API.
      const amountKobo = Math.round(naira * 100);
      const response = await walletService.fundWallet(amountKobo);
      setFundAmount("");
      await WebBrowser.openBrowserAsync(response.redirectUrl);

      // Funding confirms asynchronously via a server-side webhook, so the balance may not have
      // updated yet if the browser was dismissed right after paying - refetch to reflect
      // reality as of now rather than faking an optimistic bump.
      const refreshed = await walletService.getWallet();
      setWallet(refreshed);
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : "Something went wrong. Please try again.";
      Toast.show({
        type: "error",
        text1: "Couldn't fund wallet",
        text2: message,
      });
    } finally {
      setFunding(false);
    }
  };

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
    Toast.show({ type: "info", text1: label, text2: "Coming soon" });
  };

  return (
    <GradientScreen>
      <ScrollView
        className="px-6 pt-6"
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <Text className="font-poppins-bold text-2xl text-ink-900">Profile</Text>

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
          <Text className="mt-3 font-poppins-semibold text-lg text-ink-900">
            {user?.name ?? "Ogasela user"}
          </Text>

          <View className="mt-4 w-full items-center gap-2">
            <View className="flex-row items-center gap-2">
              <Mail size={14} color={colors.ink500} />
              <Text className="font-poppins text-xs text-ink-500">
                {user?.email}
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Phone size={14} color={colors.ink500} />
              <Text className="font-poppins text-xs text-ink-500">
                {user?.phone}
              </Text>
            </View>
          </View>
        </View>

        <View className="mt-6 flex-row rounded-3xl border border-brand-50 bg-white p-2">
          {QUICK_LINKS.map((item) => (
            <Pressable
              key={item.label}
              onPress={() => handleMenuPress(item.label)}
              className="flex-1 items-center gap-2 rounded-2xl py-4 active:bg-brand-50"
            >
              <View className="h-11 w-11 items-center justify-center rounded-full bg-brand-50">
                <item.icon size={20} color={colors.brand600} />
              </View>
              <Text className="font-poppins-medium text-xs text-ink-900">
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View className="mt-6 rounded-3xl border border-brand-50 bg-white p-6">
          <View className="flex-row items-center gap-2">
            <WalletIcon size={16} color={colors.brand600} />
            <Text className="font-poppins-semibold text-sm text-ink-500">
              Wallet balance
            </Text>
          </View>

          {walletLoading ? (
            <ActivityIndicator
              className="mt-3 self-start"
              color={colors.brand500}
            />
          ) : (
            <Text className="mt-1 font-poppins-bold text-2xl text-ink-900">
              {formatNaira((wallet?.balanceKobo ?? 0) / 100)}
            </Text>
          )}

          <View className="mt-4 flex-row items-center gap-2">
            <View className="flex-1 flex-row items-center rounded-2xl border border-brand-100 bg-surface px-4">
              <Text className="font-poppins text-sm text-ink-500">₦</Text>
              <TextInput
                value={fundAmount}
                onChangeText={setFundAmount}
                placeholder="Amount to fund"
                placeholderTextColor={colors.ink300}
                keyboardType="numeric"
                className="flex-1 py-3 pl-1 font-poppins text-sm text-ink-900"
              />
            </View>
            <Pressable
              onPress={handleFundWallet}
              disabled={funding || !fundAmount.trim()}
              className="rounded-2xl bg-brand-600 px-4 py-3.5"
              style={{ opacity: funding || !fundAmount.trim() ? 0.6 : 1 }}
            >
              {funding ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text className="font-poppins-semibold text-sm text-white">
                  Fund wallet
                </Text>
              )}
            </Pressable>
          </View>
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
                <item.icon size={18} color={colors.brand600} />
                <Text className="font-poppins-medium text-sm text-ink-900">
                  {item.label}
                </Text>
              </View>
              <ChevronRight size={16} color={colors.ink300} />
            </Pressable>
          ))}
        </View>

        <Text className="mt-4 text-center font-poppins text-xs text-ink-300">
          You'll be automatically signed out after {env.autoLogoutMinutes}{" "}
          minutes of inactivity.
        </Text>

        <Pressable
          onPress={() => WebBrowser.openBrowserAsync(LINKS.accountDeletion)}
          accessibilityRole="link"
          className="mt-6 flex-row items-center justify-center gap-2 rounded-2xl border border-ink-300/40 bg-white py-4"
        >
          <Trash2 size={18} color={colors.ink700} />
          <Text className="font-poppins-semibold text-sm text-ink-700">
            Delete My Data
          </Text>
        </Pressable>

        <Pressable
          onPress={() => logout()}
          className="mt-3 flex-row items-center justify-center gap-2 rounded-2xl border border-danger/20 bg-danger/5 py-4"
        >
          <LogOut size={18} color={colors.danger} />
          <Text className="font-poppins-semibold text-sm text-danger">
            Log out
          </Text>
        </Pressable>
      </ScrollView>
    </GradientScreen>
  );
}
