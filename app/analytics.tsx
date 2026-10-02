import { useRouter } from "expo-router";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronLeft,
  ImageOff,
  Minus,
} from "lucide-react-native";
import moment from "moment";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useProtectedRoute } from "@/hooks/useProtectedRoute";
import { ApiError } from "@/lib/apiClient";
import {
  getListingAnalytics,
  getSellerAnalytics,
  type AnalyticsDays,
  type ExternalPlatformEngagement,
  type ListingAnalytics,
  type MetricComparison,
  type SellerAnalytics,
} from "@/services/analytics";
import * as listingsService from "@/services/listings";
import { colors } from "@/theme/colors";
import type { Listing } from "@/types/api";
import { formatNaira } from "@/utils/currency";

const PERIODS: { days: AnalyticsDays; label: string }[] = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
];

/** 1,284 / 12.9K / 1.2M - stat-tile values stay short. */
function compact(value: number): string {
  if (value >= 1_000_000)
    return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  if (value >= 10_000)
    return `${(value / 1_000).toFixed(value >= 100_000 ? 0 : 1)}K`;
  return value.toLocaleString("en-NG");
}

function percent(numerator: number, denominator: number): string {
  if (denominator <= 0) return "—";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

/** Change vs the previous period, with an arrow and sign so it never relies on colour alone. */
function Delta({ metric, days }: { metric: MetricComparison; days: number }) {
  const { current, previous } = metric;
  if (current === 0 && previous === 0) {
    return (
      <Text className="mt-1 font-poppins text-[11px] text-ink-500">
        No activity yet
      </Text>
    );
  }
  if (previous === 0) {
    return (
      <Text className="mt-1 font-poppins text-[11px] text-ink-500">
        New this period
      </Text>
    );
  }
  const change = ((current - previous) / previous) * 100;
  const rounded = Math.round(change);
  const direction = rounded > 0 ? "up" : rounded < 0 ? "down" : "flat";
  const color =
    direction === "up"
      ? colors.brand600
      : direction === "down"
        ? colors.danger
        : colors.ink500;
  const Icon =
    direction === "up"
      ? ArrowUpRight
      : direction === "down"
        ? ArrowDownRight
        : Minus;

  return (
    <View className="mt-1 flex-row items-center gap-0.5">
      <Icon size={12} color={color} />
      <Text className="font-poppins-medium text-[11px]" style={{ color }}>
        {rounded > 0 ? "+" : ""}
        {rounded}%
      </Text>
      <Text className="font-poppins text-[11px] text-ink-500">
        {" "}
        vs previous {days} days
      </Text>
    </View>
  );
}

function StatTile({
  label,
  metric,
  days,
  large,
}: {
  label: string;
  metric: MetricComparison;
  days: number;
  large?: boolean;
}) {
  return (
    <View className="flex-1 rounded-2xl border border-brand-50 bg-white p-4">
      <Text className="font-poppins text-xs text-ink-500">{label}</Text>
      <Text
        className={`mt-1 font-poppins-semibold text-ink-900 ${large ? "text-3xl" : "text-xl"}`}
      >
        {compact(metric.current)}
      </Text>
      <Delta metric={metric} days={days} />
    </View>
  );
}

const PLATFORM_LABEL: Record<string, string> = {
  Facebook: "Facebook",
  TikTok: "TikTok",
};

function PerformanceTable({ data }: { data: ListingAnalytics }) {
  const og = data.ogasela;
  const facebook = data.platforms.find((p) => p.platform === "Facebook");
  const tiktok = data.platforms.find((p) => p.platform === "TikTok");

  const external = (
    p: ExternalPlatformEngagement | undefined,
    pick: (p: ExternalPlatformEngagement) => string,
  ) => (p && p.promoted ? pick(p) : "—");

  const rows: { label: string; values: [string, string, string] }[] = [
    {
      label: "Impressions",
      values: [
        compact(og.impressions.current),
        external(facebook, (p) => compact(p.impressions)),
        external(tiktok, (p) => compact(p.impressions)),
      ],
    },
    {
      label: "Clicks",
      values: [
        compact(og.views.current),
        external(facebook, (p) => compact(p.clicks)),
        external(tiktok, (p) => compact(p.clicks)),
      ],
    },
    {
      label: "Click-through rate",
      values: [
        percent(og.views.current, og.impressions.current),
        external(facebook, (p) => percent(p.clicks, p.impressions)),
        external(tiktok, (p) => percent(p.clicks, p.impressions)),
      ],
    },
    { label: "Calls", values: [compact(og.callClicks.current), "—", "—"] },
    {
      label: "Chats started",
      values: [compact(og.messageStarts.current), "—", "—"],
    },
    { label: "Saves", values: [compact(og.saves.current), "—", "—"] },
    {
      label: "Ad spend",
      values: [
        "—",
        external(facebook, (p) => formatNaira(p.spendKobo / 100)),
        external(tiktok, (p) => formatNaira(p.spendKobo / 100)),
      ],
    },
  ];

  const columnHeader = (title: string, p?: ExternalPlatformEngagement) => (
    <View className="flex-1 items-end">
      <Text className="font-poppins-semibold text-xs text-ink-900">
        {title}
      </Text>
      <Text className="font-poppins text-[10px] text-ink-500">
        {p === undefined
          ? `Last ${data.days} days`
          : p.promoted
            ? (p.campaignStatus ?? "Promoted")
            : "Not promoted"}
      </Text>
    </View>
  );

  return (
    <View className="overflow-hidden rounded-2xl border border-brand-50 bg-white">
      <View className="flex-row items-end border-b border-brand-50 bg-surface px-4 py-3">
        <Text className="flex-[1.3] font-poppins-medium text-xs text-ink-500">
          Metric
        </Text>
        {columnHeader("Ogasela")}
        {columnHeader(PLATFORM_LABEL.Facebook, facebook)}
        {columnHeader(PLATFORM_LABEL.TikTok, tiktok)}
      </View>
      {rows.map((row, index) => (
        <View
          key={row.label}
          className={`flex-row items-center px-4 py-3 ${index !== rows.length - 1 ? "border-b border-brand-50" : ""}`}
        >
          <Text className="flex-[1.3] font-poppins text-xs text-ink-700">
            {row.label}
          </Text>
          {row.values.map((value, i) => (
            <Text
              key={i}
              className={`flex-1 text-right font-poppins-medium text-sm ${value === "—" ? "text-ink-300" : "text-ink-900"}`}
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {value}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

export default function AnalyticsScreen() {
  useProtectedRoute("/analytics");
  const router = useRouter();
  const { user } = useAuth();
  const sellerProfileId = user?.sellerProfile?.id;

  const [days, setDays] = useState<AnalyticsDays>(30);
  const [summary, setSummary] = useState<SellerAnalytics | null>(null);
  const [ads, setAds] = useState<Listing[]>([]);
  const [selectedAdId, setSelectedAdId] = useState<string | null>(null);
  const [adAnalytics, setAdAnalytics] = useState<ListingAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [adLoading, setAdLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = useCallback(
    async (isRefresh = false) => {
      if (!sellerProfileId) {
        setLoading(false);
        return;
      }
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const [overview, page] = await Promise.all([
          getSellerAnalytics(days),
          listingsService.getSellerListings(sellerProfileId, 1, 100),
        ]);
        setSummary(overview);
        // Drafts and ads awaiting approval have never been shown to buyers, so there's nothing to analyse.
        const analysable = page.items.filter(
          (l) => l.status !== "Draft" && l.status !== "PendingReview",
        );
        setAds(analysable);
        setSelectedAdId((current) =>
          current && analysable.some((l) => l.id === current)
            ? current
            : (analysable[0]?.id ?? null),
        );
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : "Couldn't load your analytics.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [days, sellerProfileId],
  );

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (!selectedAdId) {
      setAdAnalytics(null);
      return;
    }
    let active = true;
    setAdLoading(true);
    getListingAnalytics(selectedAdId, days)
      .then((result) => {
        if (active) setAdAnalytics(result);
      })
      .catch(() => {
        if (active) setAdAnalytics(null);
      })
      .finally(() => {
        if (active) setAdLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedAdId, days, summary]);

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
        <Text className="font-poppins-bold text-2xl text-ink-900">
          Analytics
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadOverview(true)}
            tintColor={colors.brand600}
          />
        }
      >
        <View className="mt-3 flex-row rounded-2xl border border-brand-50 bg-white p-1">
          {PERIODS.map((period) => {
            const selected = period.days === days;
            return (
              <Pressable
                key={period.days}
                onPress={() => setDays(period.days)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                className={`flex-1 items-center rounded-xl py-2.5 ${selected ? "bg-brand-600" : ""}`}
              >
                <Text
                  className={`font-poppins-medium text-xs ${selected ? "text-white" : "text-ink-700"}`}
                >
                  {period.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {!sellerProfileId ? (
          <Text className="mt-10 text-center font-poppins text-sm text-ink-500">
            Analytics are available for seller accounts.
          </Text>
        ) : loading ? (
          <ActivityIndicator
            color={colors.brand600}
            style={{ marginTop: 40 }}
          />
        ) : error || !summary ? (
          <View className="mt-10 items-center">
            <Text className="text-center font-poppins text-sm text-ink-500">
              {error}
            </Text>
            <Pressable
              onPress={() => loadOverview()}
              className="mt-3 rounded-full bg-brand-50 px-4 py-2"
            >
              <Text className="font-poppins-medium text-xs text-brand-700">
                Try again
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text className="mb-3 mt-6 font-poppins-semibold text-base text-ink-900">
              Overview
            </Text>
            <View className="flex-row gap-3">
              <StatTile
                label="Profile visits"
                metric={summary.profileVisits}
                days={summary.days}
                large
              />
              <StatTile
                label="Total impressions"
                metric={summary.impressions}
                days={summary.days}
                large
              />
            </View>
            <View className="mt-3 flex-row gap-3">
              <StatTile
                label="Ad views"
                metric={summary.views}
                days={summary.days}
              />
              <StatTile
                label="Calls & chats"
                metric={{
                  current:
                    summary.callClicks.current + summary.messageStarts.current,
                  previous:
                    summary.callClicks.previous +
                    summary.messageStarts.previous,
                }}
                days={summary.days}
              />
            </View>
            <Text className="mt-2 font-poppins text-[11px] text-ink-500">
              {moment(summary.from).format("D MMM")} –{" "}
              {moment(summary.to).format("D MMM YYYY")} · Impressions count each
              time one of your ads is shown in search or on the home screen.
            </Text>

            <Text className="mb-3 mt-8 font-poppins-semibold text-base text-ink-900">
              Ad performance
            </Text>
            {ads.length === 0 ? (
              <View className="items-center rounded-2xl border border-brand-50 bg-white px-4 py-6">
                <Text className="text-center font-poppins text-sm text-ink-500">
                  Once one of your ads is live, its performance shows here.
                </Text>
              </View>
            ) : (
              <>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 10, paddingBottom: 4 }}
                >
                  {ads.map((ad) => {
                    const selected = ad.id === selectedAdId;
                    return (
                      <Pressable
                        key={ad.id}
                        onPress={() => setSelectedAdId(ad.id)}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        className={`w-36 overflow-hidden rounded-2xl border bg-white ${
                          selected ? "border-brand-600" : "border-brand-50"
                        }`}
                        style={{ borderWidth: selected ? 2 : 1 }}
                      >
                        {ad.mediaUrls[0] ? (
                          <Image
                            source={{ uri: ad.mediaUrls[0] }}
                            className="h-20 w-full bg-brand-50"
                            resizeMode="cover"
                          />
                        ) : (
                          <View className="h-20 w-full items-center justify-center bg-brand-50">
                            <ImageOff size={18} color={colors.ink300} />
                          </View>
                        )}
                        <Text
                          className="px-2.5 py-2 font-poppins-medium text-xs text-ink-900"
                          numberOfLines={2}
                        >
                          {ad.title}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <View className="mt-4">
                  {adLoading && !adAnalytics ? (
                    <ActivityIndicator
                      color={colors.brand600}
                      style={{ marginTop: 16 }}
                    />
                  ) : adAnalytics ? (
                    <>
                      <PerformanceTable data={adAnalytics} />
                      <Text className="mt-2 font-poppins text-[11px] leading-4 text-ink-500">
                        Ogasela figures cover the last {adAnalytics.days} days;
                        clicks there are ad opens. Facebook and TikTok show
                        totals since the campaign started, updated about every
                        20 minutes.
                      </Text>
                    </>
                  ) : (
                    <Text className="text-center font-poppins text-sm text-ink-500">
                      Couldn't load this ad's performance.
                    </Text>
                  )}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
