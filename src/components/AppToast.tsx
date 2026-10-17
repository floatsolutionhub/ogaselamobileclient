import { CheckCircle2, Info, XCircle, type LucideIcon } from "lucide-react-native";
import { Platform, View } from "react-native";
import { FullWindowOverlay } from "react-native-screens";
import Toast, { BaseToast, type ToastConfig, type ToastConfigParams } from "react-native-toast-message";

import { colors } from "@/theme/colors";
import { FONT, ICON, TYPE } from "@/theme/typography";

/** Toasts on the app's type scale, with an icon and a coloured edge per kind. */
function renderToast(accent: string, Icon: LucideIcon) {
  function AppToastBody(props: ToastConfigParams<unknown>) {
    return (
      <BaseToast
        {...props}
        style={{ borderLeftColor: accent, borderLeftWidth: 5, borderRadius: 16, height: undefined, minHeight: 64, paddingVertical: 10 }}
        contentContainerStyle={{ paddingHorizontal: 12 }}
        text1Style={{ fontFamily: FONT.semibold, ...TYPE.body, color: colors.ink900 }}
        text2Style={{ fontFamily: FONT.regular, ...TYPE.caption, color: colors.ink700 }}
        text1NumberOfLines={2}
        text2NumberOfLines={3}
        renderLeadingIcon={() => (
          <View style={{ justifyContent: "center", paddingLeft: 14 }}>
            <Icon size={ICON.md} color={accent} />
          </View>
        )}
      />
    );
  }
  return AppToastBody;
}

const toastConfig: ToastConfig = {
  success: renderToast(colors.brand600, CheckCircle2),
  error: renderToast(colors.danger, XCircle),
  info: renderToast(colors.gold600, Info),
};

/**
 * The app's single toast host. On iOS, native sheets/modals (formSheet, modal) are presented
 * above the root view, so a toast mounted there renders underneath them - an error from a sign-up
 * sheet was invisible. FullWindowOverlay draws in its own window above every screen and modal,
 * and only the toast itself takes touches. Android sheets live in the same view tree, so the toast
 * mounted last already sits on top.
 */
export function AppToast() {
  if (Platform.OS === "ios") {
    return (
      <FullWindowOverlay>
        <Toast config={toastConfig} />
      </FullWindowOverlay>
    );
  }

  return <Toast config={toastConfig} />;
}
