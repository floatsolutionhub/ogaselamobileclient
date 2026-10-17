import { Modal as NativeModal, View, type ModalProps } from "react-native";

import { markActivity } from "@/lib/activityClock";

/**
 * Drop-in for React Native's Modal. A Modal renders in its own native window, so touches inside
 * it never reach the root view's auto-logout tracker - this wrapper reports them itself, so
 * someone filling in a sheet isn't treated as idle and signed out mid-task.
 */
export function Modal({ children, ...props }: ModalProps) {
  return (
    <NativeModal {...props}>
      <View style={{ flex: 1 }} onTouchStart={markActivity}>
        {children}
      </View>
    </NativeModal>
  );
}
