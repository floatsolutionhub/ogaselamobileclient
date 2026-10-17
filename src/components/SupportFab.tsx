import { Headset, MessageCircle, Phone, X } from "lucide-react-native";
import { useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { Modal } from "@/components/ActivityModal";
import { env } from "@/config/env";
import { colors } from "@/theme/colors";
import { ICON } from "@/theme/typography";

const WHATSAPP_GREEN = "#25D366";

/**
 * Floating support button for signed-in users. Opens a sheet with the support channels from the
 * app's .env (EXPO_PUBLIC_SUPPORT_PHONE, EXPO_PUBLIC_SUPPORT_WHATSAPP_URL); an unset channel isn't shown.
 */
export function SupportFab() {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const phone = env.supportPhone.trim();
  const whatsappUrl = env.supportWhatsappUrl.trim();

  const openUrl = (url: string, failure: string) => {
    setOpen(false);
    Linking.openURL(url).catch(() =>
      Toast.show({ type: "error", text1: failure }),
    );
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Contact support"
        className="absolute bottom-5 right-5 h-14 w-14 items-center justify-center rounded-full bg-brand-600"
        style={{
          shadowColor: colors.ink900,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.25,
          shadowRadius: 10,
          elevation: 8,
        }}
      >
        <Headset size={ICON.xl} color={colors.white} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "rgba(16,24,40,0.45)",
          }}
        >
          <Pressable
            style={{ flex: 1 }}
            onPress={() => setOpen(false)}
            accessibilityLabel="Close"
          />
          <View
            className="rounded-t-3xl bg-white px-6 pt-5"
            style={{ paddingBottom: Math.max(insets.bottom, 16) + 8 }}
          >
            <View className="mb-1 flex-row items-center justify-between">
              <Text className="font-poppins-semibold text-title text-ink-900">
                Need help?
              </Text>
              <Pressable
                onPress={() => setOpen(false)}
                hitSlop={10}
                className="h-9 w-9 items-center justify-center rounded-full bg-surface"
              >
                <X size={ICON.md} color={colors.ink700} />
              </Pressable>
            </View>
            <Text className="mb-4 font-poppins text-body text-ink-500">
              Reach the Ogasela support team on any of these channels.
            </Text>

            {whatsappUrl ? (
              <ChannelRow
                icon={<MessageCircle size={ICON.lg} color={colors.white} />}
                iconBackground={WHATSAPP_GREEN}
                title="Chat on WhatsApp"
                subtitle="Usually the fastest way to reach us"
                onPress={() => openUrl(whatsappUrl, "Couldn't open WhatsApp")}
              />
            ) : null}
            {phone ? (
              <ChannelRow
                icon={<Phone size={ICON.lg} color={colors.white} />}
                iconBackground={colors.brand600}
                title="Call support"
                subtitle={phone}
                onPress={() =>
                  openUrl(
                    `tel:${phone.replace(/\s+/g, "")}`,
                    "Couldn't open the phone app",
                  )
                }
              />
            ) : null}
            {!whatsappUrl && !phone ? (
              <Text className="rounded-2xl bg-surface p-4 text-center font-poppins text-body text-ink-500">
                Support contacts aren’t set up yet.
              </Text>
            ) : null}
          </View>
        </View>
      </Modal>
    </>
  );
}

function ChannelRow({
  icon,
  iconBackground,
  title,
  subtitle,
  onPress,
}: {
  icon: React.ReactNode;
  iconBackground: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      className="mb-3 flex-row items-center gap-3 rounded-2xl border border-brand-50 bg-white p-4 active:bg-brand-50"
    >
      <View
        className="h-11 w-11 items-center justify-center rounded-full"
        style={{ backgroundColor: iconBackground }}
      >
        {icon}
      </View>
      <View className="flex-1">
        <Text className="font-poppins-semibold text-body text-ink-900">
          {title}
        </Text>
        <Text className="font-poppins text-caption text-ink-500">{subtitle}</Text>
      </View>
    </Pressable>
  );
}
