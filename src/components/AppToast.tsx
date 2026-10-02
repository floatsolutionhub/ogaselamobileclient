import { Platform } from "react-native";
import { FullWindowOverlay } from "react-native-screens";
import Toast from "react-native-toast-message";

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
        <Toast />
      </FullWindowOverlay>
    );
  }

  return <Toast />;
}
