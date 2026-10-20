import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  AlertCircle,
  ArrowUpCircle,
  ChevronLeft,
  Clock,
  ImageOff,
  Megaphone,
  Pencil,
  RefreshCw,
  Rocket,
  Send,
  Trash2,
  type LucideIcon,
} from "lucide-react-native";
import moment from "moment";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { useAuth } from "@/context/AuthContext";
import { useProtectedRoute } from "@/hooks/useProtectedRoute";
import { ApiError } from "@/lib/apiClient";
import * as listingsService from "@/services/listings";
import { getPromotionPlans } from "@/services/promotionPlans";
import { colors } from "@/theme/colors";
import type { Listing, PromotionPlan } from "@/types/api";
import { formatNaira } from "@/utils/currency";
import { canDelete, canUpgrade, hasRunningPlan, isLive } from "@/utils/listingLifecycle";
import { ICON } from "@/theme/typography";

type TabKey = "active" | "draft" | "pending" | "rejected" | "expired";

/** A draft our team sent back - a first submission, or an edit of a live ad. */
const isRejected = (l: Listing) => l.status === "Draft" && !!l.reviewNote;

const TABS: {
  key: TabKey;
  label: string;
  matches: (l: Listing) => boolean;
  empty: string;
}[] = [
  {
    key: "active",
    label: "Active",
    matches: isLive,
    empty: "You have no live ads. Approved ads show up here.",
  },
  {
    key: "draft",
    label: "Draft",
    matches: (l) => l.status === "Draft" && !l.reviewNote,
    empty: "No drafts. Ads you started but haven't paid for show up here.",
  },
  {
    key: "pending",
    label: "Pending",
    matches: (l) => l.status === "PendingReview",
    empty:
      "Nothing waiting for approval. Published ads and edits wait here until our team approves them.",
  },
  {
    key: "rejected",
    label: "Rejected",
    matches: isRejected,
    empty: "Nothing was turned down. Ads our team doesn't approve show up here for you to fix.",
  },
  {
    key: "expired",
    label: "Expired",
    matches: (l) => l.status === "Expired",
    empty: "No expired ads.",
  },
];

// A seller rarely has more than a few dozen ads; one page covers them and keeps tab counts exact.
const PAGE_SIZE = 100;

export default function MyAdsScreen() {
  useProtectedRoute("/my-ads");
  const router = useRouter();
  const { user } = useAuth();
  const sellerProfileId = user?.sellerProfile?.id;

  const { tab: initialTab } = useLocalSearchParams<{ tab?: TabKey }>();
  const [activeTab, setActiveTab] = useState<TabKey>(
    TABS.some((t) => t.key === initialTab) ? (initialTab as TabKey) : "active",
  );
  const [listings, setListings] = useState<Listing[]>([]);
  const [plans, setPlans] = useState<PromotionPlan[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!sellerProfileId) {
        setLoading(false);
        return;
      }
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const [page, allPlans] = await Promise.all([
          listingsService.getSellerListings(sellerProfileId, 1, PAGE_SIZE),
          // Only used to name a paid plan in the delete warning - never blocks the list.
          getPromotionPlans().catch(() => [] as PromotionPlan[]),
        ]);
        setListings(page.items);
        setPlans(allPlans);
      } catch (err) {
        setError(
          err instanceof ApiError ? err.message : "Couldn't load your ads.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [sellerProfileId],
  );

  // Reload whenever the screen comes back into view (e.g. after posting or editing an ad).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const counts = useMemo(() => {
    const result = {} as Record<TabKey, number>;
    for (const tab of TABS) {
      result[tab.key] = listings.filter(tab.matches).length;
    }
    return result;
  }, [listings]);

  const tab = TABS.find((t) => t.key === activeTab)!;
  const visible = listings.filter(tab.matches);

  const deleteAd = async (listing: Listing) => {
    setDeletingId(listing.id);
    try {
      await listingsService.deleteListing(listing.id);
      setListings((prev) => prev.filter((l) => l.id !== listing.id));
      Toast.show({ type: "success", text1: "Ad deleted" });
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Couldn't delete your ad",
        text2: err instanceof ApiError ? err.message : "Please try again.",
      });
    } finally {
      setDeletingId(null);
    }
  };

  /** Paid for and not used up (waiting for review, or a plan still running) - deleting doesn't refund it. */
  const confirmDelete = (listing: Listing) => {
    const plan = plans.find((p) => p.id === listing.promotionPlanId);
    const paid =
      plan && plan.price > 0 && (listing.status === "PendingReview" || hasRunningPlan(listing));
    Alert.alert(
      "Delete this ad?",
      `"${listing.title}" will be removed from My Ads for good. This can't be undone.${
        paid ? `\n\nNo refund: you paid for the ${plan.name} plan on this ad, and deleting it doesn't refund it.` : ""
      }`,
      [
        { text: "Keep it", style: "cancel" },
        { text: "Delete ad", style: "destructive", onPress: () => deleteAd(listing) },
      ],
    );
  };

  const openEditor = (id: string) =>
    router.push({ pathname: "/(app)/post", params: { listingId: id } });
  const openPlans = (id: string) =>
    router.push({ pathname: "/choose-plan", params: { listingId: id } });

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
        <Text className="font-poppins-bold text-display text-ink-900">My ads</Text>
      </View>

      <View className="mx-6 mt-3 rounded-2xl border border-brand-50 bg-white p-1">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
        {TABS.map((t) => {
          const selected = t.key === activeTab;
          return (
            <Pressable
              key={t.key}
              onPress={() => setActiveTab(t.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              className={`flex-grow flex-row items-center justify-center gap-1 rounded-xl px-3 py-2.5 ${
                selected ? "bg-brand-600" : ""
              }`}
            >
              <Text
                className={`font-poppins-medium text-caption ${selected ? "text-white" : "text-ink-700"}`}
              >
                {t.label}
              </Text>
              {counts[t.key] > 0 ? (
                <View
                  className={`min-w-[18px] items-center rounded-full px-1 ${
                    selected ? "bg-white/25" : "bg-brand-50"
                  }`}
                >
                  <Text
                    className={`font-poppins-semibold text-micro ${
                      selected ? "text-white" : "text-brand-700"
                    }`}
                  >
                    {counts[t.key]}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
        </ScrollView>
      </View>

      {!sellerProfileId ? (
        <EmptyState text="Only seller accounts can post ads." />
      ) : loading ? (
        <ActivityIndicator color={colors.brand600} style={{ marginTop: 40 }} />
      ) : error ? (
        <View className="mt-10 items-center px-8">
          <Text className="text-center font-poppins text-body text-ink-500">
            {error}
          </Text>
          <Pressable
            onPress={() => load()}
            className="mt-3 rounded-full bg-brand-50 px-4 py-2"
          >
            <Text className="font-poppins-medium text-caption text-brand-700">
              Try again
            </Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 24, paddingTop: 16, gap: 12 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={colors.brand600}
            />
          }
          renderItem={({ item }) => (
            <MyAdCard
              listing={item}
              onPress={() =>
                item.status === "Draft"
                  ? openEditor(item.id)
                  : router.push({ pathname: "/listing/[id]", params: { id: item.id } })
              }
              onEdit={() => openEditor(item.id)}
              onPlans={() => openPlans(item.id)}
              onDelete={() => confirmDelete(item)}
              deleting={deletingId === item.id}
            />
          )}
          ListEmptyComponent={<EmptyState text={tab.empty} />}
        />
      )}
    </SafeAreaView>
  );
}

function statusLine(listing: Listing): string {
  switch (listing.status) {
    case "Active":
    case "ExpiringSoon":
      return listing.expiresAt
        ? `Expires ${moment(listing.expiresAt).fromNow()}`
        : "Live";
    case "PendingReview":
      return hasRunningPlan(listing)
        ? `Changes submitted ${moment(listing.updatedAt).fromNow()} · waiting for approval`
        : `Submitted ${moment(listing.updatedAt).fromNow()} · waiting for approval`;
    case "Expired":
      return listing.expiresAt
        ? `Expired ${moment(listing.expiresAt).format("D MMM YYYY")}`
        : "Expired";
    default:
      return `Last edited ${moment(listing.updatedAt).fromNow()}`;
  }
}

function MyAdCard({
  listing,
  onPress,
  onEdit,
  onPlans,
  onDelete,
  deleting,
}: {
  listing: Listing;
  onPress: () => void;
  /** Opens the post form on this ad (draft, rejected, expired or live). */
  onEdit: () => void;
  /** Opens checkout: pay for a draft, renew an expired ad, or upgrade a running plan. */
  onPlans: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const thumbnail = listing.mediaUrls[0];
  const expiringSoon = listing.status === "ExpiringSoon";
  const isDraft = listing.status === "Draft";
  const rejected = isRejected(listing);
  // A rejected edit of a live ad: its plan is still running, so fixing it costs nothing.
  const rejectedEdit = rejected && hasRunningPlan(listing);
  const expired = listing.status === "Expired";
  const live = isLive(listing);

  const actions: { key: string; label: string; icon: LucideIcon; onPress: () => void; tone: "outline" | "primary" | "danger" }[] = [];
  if (isDraft || expired || live) {
    actions.push({
      key: "edit",
      label: isDraft && !rejected ? "Continue editing" : rejectedEdit ? "Fix & resubmit" : "Edit",
      icon: Pencil,
      onPress: onEdit,
      tone: "outline",
    });
  }
  if (isDraft && !rejectedEdit) {
    actions.push({ key: "pay", label: rejected ? "Pay & resubmit" : "Pay & submit", icon: Rocket, onPress: onPlans, tone: "primary" });
  }
  if (rejectedEdit) actions.push({ key: "resubmit", label: "Resubmit", icon: Send, onPress: onEdit, tone: "primary" });
  if (expired) actions.push({ key: "renew", label: "Renew", icon: RefreshCw, onPress: onPlans, tone: "primary" });
  if (canUpgrade(listing)) {
    actions.push({ key: "upgrade", label: "Upgrade plan", icon: ArrowUpCircle, onPress: onPlans, tone: live ? "primary" : "outline" });
  }
  if (canDelete(listing)) actions.push({ key: "delete", label: "Delete", icon: Trash2, onPress: onDelete, tone: "danger" });

  return (
    <Pressable
      onPress={onPress}
      className="rounded-2xl border border-brand-50 bg-white p-3 active:bg-brand-50"
    >
      <View className="flex-row gap-3">
        {thumbnail ? (
          <Image
            source={{ uri: thumbnail }}
            className="h-20 w-20 rounded-xl bg-brand-50"
            resizeMode="cover"
          />
        ) : (
          <View className="h-20 w-20 items-center justify-center rounded-xl bg-brand-50">
            <ImageOff size={ICON.lg} color={colors.ink300} />
          </View>
        )}
        <View className="flex-1 justify-center">
          <Text
            className="font-poppins-semibold text-body text-ink-900"
            numberOfLines={2}
          >
            {listing.title}
          </Text>
          <Text className="mt-0.5 font-poppins-semibold text-body text-brand-700">
            {listing.price !== null
              ? formatNaira(listing.price)
              : "Price on request"}
          </Text>
          <View className="mt-1 flex-row items-center gap-1">
            {listing.status === "PendingReview" || expiringSoon ? (
              <Clock
                size={ICON.xs}
                color={expiringSoon ? colors.gold700 : colors.ink500}
              />
            ) : null}
            <Text
              className={`flex-1 font-poppins text-micro ${expiringSoon ? "text-gold-700" : "text-ink-500"}`}
              numberOfLines={1}
            >
              {statusLine(listing)}
            </Text>
          </View>
        </View>
      </View>

      {rejected ? (
        <View className="mt-3 flex-row gap-2 rounded-xl bg-danger/5 p-3">
          <AlertCircle
            size={ICON.sm}
            color={colors.danger}
            style={{ marginTop: 2 }}
          />
          <Text className="flex-1 font-poppins text-caption text-ink-700">
            <Text className="font-poppins-semibold text-danger">
              {rejectedEdit ? "Changes not approved: " : "Not approved: "}
            </Text>
            {listing.reviewNote}
            {rejectedEdit ? " Fix it and resubmit for free. Your plan keeps running." : ""}
          </Text>
        </View>
      ) : null}

      {actions.length > 0 ? (
        <View className="mt-3 flex-row flex-wrap gap-2">
          {actions.map(({ key, label, icon: Icon, onPress: press, tone }) => (
            <Pressable
              key={key}
              onPress={press}
              disabled={deleting}
              accessibilityRole="button"
              accessibilityLabel={key === "delete" ? `Delete ${listing.title}` : label}
              style={{ flexBasis: "47%", opacity: deleting ? 0.6 : 1 }}
              className={`flex-grow flex-row items-center justify-center gap-1.5 rounded-xl py-2.5 ${
                tone === "primary"
                  ? "bg-brand-600"
                  : tone === "danger"
                    ? "border border-danger/30"
                    : "border border-brand-100"
              }`}
            >
              {key === "delete" && deleting ? (
                <ActivityIndicator size="small" color={colors.danger} />
              ) : (
                <Icon
                  size={ICON.sm}
                  color={tone === "primary" ? colors.white : tone === "danger" ? colors.danger : colors.ink700}
                />
              )}
              <Text
                className={`font-poppins-semibold text-body ${
                  tone === "primary" ? "text-white" : tone === "danger" ? "text-danger" : "text-ink-700"
                }`}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <View className="mt-10 items-center px-8">
      <View className="h-14 w-14 items-center justify-center rounded-full bg-brand-50">
        <Megaphone size={ICON.lg} color={colors.brand600} />
      </View>
      <Text className="mt-3 text-center font-poppins text-body text-ink-500">
        {text}
      </Text>
    </View>
  );
}
