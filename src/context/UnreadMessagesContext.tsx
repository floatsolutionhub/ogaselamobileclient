import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AppState } from "react-native";

import { useAuth } from "@/context/AuthContext";
import { useMessagingHub } from "@/lib/messagingHub";
import * as messagingService from "@/services/messaging";

type UnreadMessagesContextValue = {
  /** Unread messages sent to the signed-in user, across all conversations. */
  unreadCount: number;
  /** Re-fetch the count - call after something may have read messages (opening a thread). */
  refresh: () => Promise<void>;
};

const UnreadMessagesContext = createContext<UnreadMessagesContextValue>({
  unreadCount: 0,
  refresh: async () => {},
});

/**
 * Keeps the Messages tab badge current: fetched on sign-in and whenever the app comes back to
 * the foreground, and re-fetched as soon as a new message arrives over the live hub.
 */
export function UnreadMessagesProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setUnreadCount(await messagingService.getUnreadMessageCount());
    } catch {
      // Keep the last known count.
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  useMessagingHub(() => {
    refresh();
  }, isAuthenticated);

  // Signed out: nothing to show, whatever was last fetched.
  const value = useMemo(
    () => ({ unreadCount: isAuthenticated ? unreadCount : 0, refresh }),
    [isAuthenticated, unreadCount, refresh],
  );
  return (
    <UnreadMessagesContext.Provider value={value}>
      {children}
    </UnreadMessagesContext.Provider>
  );
}

export function useUnreadMessages() {
  return useContext(UnreadMessagesContext);
}
