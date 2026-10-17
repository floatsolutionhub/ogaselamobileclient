import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  AlertCircle,
  ChevronLeft,
  Clock,
  ImageOff,
  Megaphone,
  Pencil,
  Rocket,
} from "lucide-react-native";
import moment from "moment";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useProtectedRoute } from "@/hooks/useProtectedRoute";
import { ApiError } from "@/lib/apiClient";
import * as listingsService from "@/services/listings";
import { colors } from "@/theme/colors";
import type { Listing, ListingStatus } from "@/types/api";
import { formatNaira } from "@/utils/currency";
import { ICON } from "@/theme/typography";

type TabKey = "active" | "draft" | "pending" | "expired";

const TABS: {
  key: TabKey;
  label: string;
  statuses: ListingStatus[];
  empty: string;
}[] = [
  {
    key: "active",
    label: "Active",
    statuses: ["Active", "ExpiringSoon"],
    empty: "You have no live ads. Approved ads show up here.",
  },
  {
    key: "draft",
    label: "Draft",
    statuses: ["Draft"],
    empty: "No drafts. Ads you started but haven't paid for show up here.",
  },
  {
    key: "pending",
    label: "Pending",
    statuses: ["PendingReview"],
    empty:
      "Nothing waiting for approval. Published ads wait here until our team approves them.",
  },
  {
    key: "expired",
    label: "Expired",
    statuses: ["Expired"],
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
        const page = await listingsService.getSellerListings(
          sellerProfileId,
          1,
          PAGE_SIZE,
        );
        setListings(page.items);
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
      result[tab.key] = listings.filter((l) =>
        tab.statuses.includes(l.status),
      ).length;
    }
    return result;
  }, [listings]);

  const tab = TABS.find((t) => t.key === activeTab)!;
  const visible = listings.filter((l) => tab.statuses.includes(l.status));

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

      <View className="mx-6 mt-3 flex-row rounded-2xl border border-brand-50 bg-white p-1">
        {TABS.map((t) => {
          const selected = t.key === activeTab;
          return (
            <Pressable
              key={t.key}
              onPress={() => setActiveTab(t.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              className={`flex-1 flex-row items-center justify-center gap-1 rounded-xl py-2.5 ${
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
                  ? router.push({ pathname: "/(app)/post", params: { listingId: item.id } })
                  : router.push({ pathname: "/listing/[id]", params: { id: item.id } })
              }
              onEdit={
                item.status === "Draft"
                  ? () => router.push({ pathname: "/(app)/post", params: { listingId: item.id } })
                  : undefined
              }
              onPublish={
                item.status === "Draft"
                  ? () =>
                      router.push({
                        pathname: "/choose-plan",
                        params: { listingId: item.id },
                      })
                  : undefined
              }
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
      return `Submitted ${moment(listing.updatedAt).fromNow()} · waiting for approval`;
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
  onPublish,
}: {
  listing: Listing;
  onPress: () => void;
  /** Drafts only - reopens the post form to finish the ad. */
  onEdit?: () => void;
  /** Drafts only - opens checkout (choose a plan and pay). */
  onPublish?: () => void;
}) {
  const thumbnail = listing.mediaUrls[0];
  const expiringSoon = listing.status === "ExpiringSoon";
  const rejected = listing.status === "Draft" && !!listing.reviewNote;

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
              Not approved:{" "}
            </Text>
            {listing.reviewNote}
          </Text>
        </View>
      ) : null}

      {onPublish ? (
        <View className="mt-3 flex-row gap-2">
          {onEdit ? (
            <Pressable
              onPress={onEdit}
              accessibilityRole="button"
              className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-brand-100 py-2.5"
            >
              <Pencil size={ICON.sm} color={colors.ink700} />
              <Text className="font-poppins-semibold text-body text-ink-700">Continue editing</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={onPublish}
            accessibilityRole="button"
            className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-brand-600 py-2.5"
          >
            <Rocket size={ICON.sm} color={colors.white} />
            <Text className="font-poppins-semibold text-body text-white">
              {rejected ? "Resubmit" : "Pay & submit"}
            </Text>
          </Pressable>
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
