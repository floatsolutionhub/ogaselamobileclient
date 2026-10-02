import { useLocalSearchParams, useRouter } from "expo-router";
import {
  BadgeCheck,
  ChevronLeft,
  MapPin,
  Star,
  Store,
} from "lucide-react-native";
import moment from "moment";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ListingCard } from "@/components/ListingCard";
import { ApiError } from "@/lib/apiClient";
import * as listingsService from "@/services/listings";
import { getSellerProfile, type SellerProfile } from "@/services/sellers";
import { colors } from "@/theme/colors";
import type { SearchResultItem } from "@/types/api";
import { toCardItem } from "@/utils/listingCard";

/** A seller's public storefront: who they are and their live ads. Opening it counts as a profile visit. */
export default function SellerProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [ads, setAds] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      getSellerProfile(id),
      listingsService.getSellerListings(id, 1, 50),
    ])
      .then(([sellerProfile, page]) => {
        if (!active) return;
        setProfile(sellerProfile);
        setAds(
          page.items
            .filter((l) => l.status === "Active" || l.status === "ExpiringSoon")
            .map(toCardItem),
        );
      })
      .catch((err) => {
        if (active)
          setError(
            err instanceof ApiError
              ? err.message
              : "Couldn't load this seller.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const header = profile ? (
    <View className="mb-4 rounded-3xl border border-brand-50 bg-white p-5">
      <View className="flex-row items-center gap-3">
        <View className="h-14 w-14 items-center justify-center rounded-full bg-brand-50">
          <Store size={24} color={colors.brand600} />
        </View>
        <View className="flex-1">
          <View className="flex-row items-center gap-1">
            <Text
              className="font-poppins-semibold text-lg text-ink-900"
              numberOfLines={1}
            >
              {profile.businessName}
            </Text>
            {profile.verificationStatus === "Verified" ? (
              <BadgeCheck size={17} color={colors.brand600} />
            ) : null}
          </View>
          <Text className="font-poppins text-xs text-ink-500">
            On Ogasela since {moment(profile.memberSince).format("MMM YYYY")}
          </Text>
        </View>
      </View>

      <View className="mt-4 flex-row gap-3">
        <View className="flex-1 rounded-2xl bg-surface px-3 py-2.5">
          <Text className="font-poppins text-[11px] text-ink-500">Rating</Text>
          <View className="mt-0.5 flex-row items-center gap-1">
            <Star size={14} color={colors.gold500} fill={colors.gold500} />
            <Text className="font-poppins-semibold text-sm text-ink-900">
              {profile.reviewCount > 0
                ? profile.averageRating.toFixed(1)
                : "New"}
            </Text>
            {profile.reviewCount > 0 ? (
              <Text className="font-poppins text-xs text-ink-500">
                ({profile.reviewCount})
              </Text>
            ) : null}
          </View>
        </View>
        <View className="flex-1 rounded-2xl bg-surface px-3 py-2.5">
          <Text className="font-poppins text-[11px] text-ink-500">
            Live ads
          </Text>
          <Text className="mt-0.5 font-poppins-semibold text-sm text-ink-900">
            {profile.activeAdCount}
          </Text>
        </View>
      </View>

      {profile.storeAddress ? (
        <View className="mt-3 flex-row items-start gap-2">
          <MapPin size={15} color={colors.ink500} style={{ marginTop: 2 }} />
          <Text className="flex-1 font-poppins text-sm text-ink-700">
            {profile.storeAddress}
          </Text>
        </View>
      ) : null}

      <Text className="mt-5 font-poppins-semibold text-base text-ink-900">
        Ads from this seller
      </Text>
    </View>
  ) : null;

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
        <Text className="font-poppins-bold text-xl text-ink-900">Seller</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.brand600} style={{ marginTop: 40 }} />
      ) : error || !profile ? (
        <Text className="mt-10 px-8 text-center font-poppins text-sm text-ink-500">
          {error ?? "This seller couldn't be found."}
        </Text>
      ) : (
        <FlatList
          data={ads}
          keyExtractor={(item) => item.id}
          numColumns={2}
          ListHeaderComponent={header}
          columnWrapperStyle={{ gap: 12 }}
          contentContainerStyle={{ padding: 24, paddingTop: 12, gap: 12 }}
          renderItem={({ item }) => (
            <ListingCard listing={item} variant="grid" />
          )}
          ListEmptyComponent={
            <Text className="text-center font-poppins text-sm text-ink-500">
              No live ads right now.
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
}
