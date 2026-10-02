import { useRouter } from "expo-router";
import {
  AlertCircle,
  BadgeCheck,
  Bell,
  CheckCircle2,
  ChevronLeft,
  Clock,
  EyeOff,
  FileCheck,
  FileX,
  MessageCircle,
  Scale,
  ShieldCheck,
  Star,
  UserCheck,
  UserX,
  type LucideIcon,
} from "lucide-react-native";
import moment from "moment";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useProtectedRoute } from "@/hooks/useProtectedRoute";
import * as inboxService from "@/services/inbox";
import type { InboxNotification } from "@/services/inbox";
import { colors } from "@/theme/colors";

const PAGE_SIZE = 20;

const TYPE_STYLE: Record<
  string,
  { icon: LucideIcon; color: string; background: string }
> = {
  AdApproved: {
    icon: CheckCircle2,
    color: colors.brand600,
    background: colors.brand50,
  },
  AdRejected: {
    icon: AlertCircle,
    color: colors.danger,
    background: "#FDECEA",
  },
  AdExpiringSoon: {
    icon: Clock,
    color: colors.gold700,
    background: colors.gold50,
  },
  AdExpired: { icon: Clock, color: colors.ink500, background: "#F2F4F7" },
  NewMessage: {
    icon: MessageCircle,
    color: colors.brand600,
    background: colors.brand50,
  },
  DisputeOpened: { icon: Scale, color: colors.danger, background: "#FDECEA" },
  DisputeUpdate: {
    icon: Scale,
    color: colors.gold700,
    background: colors.gold50,
  },
  DisputeResolved: {
    icon: Scale,
    color: colors.brand600,
    background: colors.brand50,
  },
  NewReview: { icon: Star, color: colors.gold600, background: colors.gold50 },
  Verification: {
    icon: ShieldCheck,
    color: colors.brand600,
    background: colors.brand50,
  },
  DocumentApproved: {
    icon: FileCheck,
    color: colors.brand600,
    background: colors.brand50,
  },
  DocumentRejected: {
    icon: FileX,
    color: colors.danger,
    background: "#FDECEA",
  },
  ProfileChangeApproved: {
    icon: UserCheck,
    color: colors.brand600,
    background: colors.brand50,
  },
  ProfileChangeRejected: {
    icon: UserX,
    color: colors.danger,
    background: "#FDECEA",
  },
  AdTakenDown: { icon: EyeOff, color: colors.danger, background: "#FDECEA" },
  AdReinstated: {
    icon: CheckCircle2,
    color: colors.brand600,
    background: colors.brand50,
  },
};

export default function NotificationsScreen() {
  useProtectedRoute("/notifications");
  const router = useRouter();
  const [items, setItems] = useState<InboxNotification[]>([]);
  const [total, setTotal] = useState(0);
  const [unread, setUnread] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (pageToLoad: number, isRefresh = false) => {
    if (pageToLoad === 1 && !isRefresh) setLoading(true);
    if (pageToLoad > 1) setLoadingMore(true);
    try {
      const result = await inboxService.getInbox(pageToLoad, PAGE_SIZE);
      setItems((prev) =>
        pageToLoad === 1 ? result.items : [...prev, ...result.items],
      );
      setTotal(result.totalCount);
      setUnread(result.unreadCount);
      setPage(pageToLoad);
    } catch {
      // Keep whatever is already on screen.
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(1);
  }, [load]);

  const open = (item: InboxNotification) => {
    if (!item.isRead) {
      inboxService.markRead(item.id).catch(() => {});
      setItems((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)),
      );
      setUnread((count) => Math.max(0, count - 1));
    }

    switch (item.type) {
      case "NewMessage":
        if (item.conversationId) {
          router.push({
            pathname: "/(modals)/conversation",
            params: { conversationId: item.conversationId },
          });
        }
        return;
      case "DisputeOpened":
      case "DisputeUpdate":
      case "DisputeResolved":
        router.push(
          item.disputeId
            ? { pathname: "/disputes/[id]", params: { id: item.disputeId } }
            : "/disputes",
        );
        return;
      case "AdRejected":
        // My ads shows the rejected ad in Draft with the moderator's reason.
        router.push("/my-ads");
        return;
      case "Verification":
        router.push("/(app)/profile");
        return;
      case "DocumentApproved":
      case "DocumentRejected":
        router.push("/personal-info");
        return;
      case "ProfileChangeApproved":
      case "ProfileChangeRejected":
        router.push("/settings");
        return;
      default:
        if (item.listingId) {
          router.push({
            pathname: "/listing/[id]",
            params: { id: item.listingId },
          });
        }
    }
  };

  const markAll = () => {
    inboxService.markAllRead().catch(() => {});
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnread(0);
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
          <ChevronLeft size={20} color={colors.ink700} />
        </Pressable>
        <Text className="flex-1 font-poppins-bold text-2xl text-ink-900">
          Notifications
        </Text>
        {unread > 0 ? (
          <Pressable
            onPress={markAll}
            hitSlop={8}
            className="flex-row items-center gap-1"
          >
            <BadgeCheck size={14} color={colors.brand600} />
            <Text className="font-poppins-medium text-xs text-brand-600">
              Mark all read
            </Text>
          </Pressable>
        ) : null}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.brand600} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 24, paddingTop: 12, gap: 10 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load(1, true);
              }}
              tintColor={colors.brand600}
            />
          }
          onEndReached={() => {
            if (!loadingMore && items.length < total) load(page + 1);
          }}
          onEndReachedThreshold={0.4}
          renderItem={({ item }) => {
            const style = TYPE_STYLE[item.type] ?? {
              icon: Bell,
              color: colors.ink700,
              background: "#F2F4F7",
            };
            const Icon = style.icon;
            return (
              <Pressable
                onPress={() => open(item)}
                className={`flex-row gap-3 rounded-2xl border p-4 active:opacity-80 ${
                  item.isRead
                    ? "border-brand-50 bg-white"
                    : "border-brand-100 bg-brand-50/60"
                }`}
              >
                <View
                  className="h-10 w-10 items-center justify-center rounded-full"
                  style={{ backgroundColor: style.background }}
                >
                  <Icon size={18} color={style.color} />
                </View>
                <View className="flex-1">
                  <View className="flex-row items-start justify-between gap-2">
                    <Text
                      className={`flex-1 text-sm text-ink-900 ${item.isRead ? "font-poppins-medium" : "font-poppins-semibold"}`}
                    >
                      {item.title}
                    </Text>
                    <Text className="font-poppins text-[11px] text-ink-300">
                      {moment(item.updatedAt).fromNow()}
                    </Text>
                  </View>
                  <Text
                    className="mt-0.5 font-poppins text-xs leading-5 text-ink-700"
                    numberOfLines={3}
                  >
                    {item.body}
                  </Text>
                </View>
                {!item.isRead ? (
                  <View className="mt-1.5 h-2 w-2 rounded-full bg-brand-600" />
                ) : null}
              </Pressable>
            );
          }}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator
                color={colors.brand600}
                style={{ marginVertical: 12 }}
              />
            ) : null
          }
          ListEmptyComponent={
            <View className="mt-10 items-center px-8">
              <View className="h-14 w-14 items-center justify-center rounded-full bg-brand-50">
                <Bell size={22} color={colors.brand600} />
              </View>
              <Text className="mt-3 text-center font-poppins text-sm text-ink-500">
                You're all caught up. Ad approvals, messages and reviews will
                show up here.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
