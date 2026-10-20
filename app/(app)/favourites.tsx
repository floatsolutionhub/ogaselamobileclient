import { Heart } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Text, View } from "react-native";

import { GradientScreen } from "@/components/GradientScreen";
import { ListingCard } from "@/components/ListingCard";
import { useFavourites } from "@/context/FavouritesContext";
import { useProtectedRoute } from "@/hooks/useProtectedRoute";
import * as listingsService from "@/services/listings";
import { colors } from "@/theme/colors";
import { Listing, ListingDetail, SearchResultItem } from "@/types/api";

/** Maps a full Listing (from getById) into the SearchResultItem shape ListingCard expects,
 * since there's no batch "get listings by ids" endpoint to source real SearchResultItems from. */
function toSearchResultItem(listing: Listing): SearchResultItem {
  return {
    id: listing.id,
    sellerId: listing.sellerId,
    categoryId: listing.categoryId,
    title: listing.title,
    description: listing.description,
    thumbnailUrl: listing.mediaUrls[0] ?? null,
    price: listing.price,
    condition: listing.condition,
    location: listing.location,
    latitude: listing.latitude,
    longitude: listing.longitude,
    publishedAt: listing.publishedAt,
    createdAt: listing.createdAt,
    planTier: "Free",
    distanceKm: null,
    score: 0,
  };
}

export default function FavouritesScreen() {
  useProtectedRoute("/(app)/favourites");
  const { favouriteIds } = useFavourites();
  const [listings, setListings] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.allSettled(favouriteIds.map((id) => listingsService.getDetail(id)))
      .then((results) => {
        if (!active) return;
        const fulfilled = results
          .filter(
            (result): result is PromiseFulfilledResult<ListingDetail> => result.status === "fulfilled"
          )
          // Saved ads from a seller you've since blocked stay hidden.
          .filter((result) => !result.value.seller.isBlockedByMe)
          .map((result) => toSearchResultItem(result.value));
        setListings(fulfilled);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [favouriteIds]);

  return (
    <GradientScreen scroll={false}>
      <View className="px-6 pt-6">
        <Text className="font-poppins-bold text-display text-ink-900">Favourites</Text>
        <Text className="mt-1 font-poppins text-body text-ink-500">
          Listings you’ve saved for later
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.brand600} style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 12, paddingHorizontal: 24 }}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 32, gap: 12 }}
          renderItem={({ item }) => <ListingCard listing={item} variant="grid" />}
          ListEmptyComponent={
            <View className="mt-16 items-center px-10">
              <Heart size={40} color={colors.brand200} />
              <Text className="mt-4 text-center font-poppins-medium text-body text-ink-500">
                You haven’t saved any listings yet. Tap the heart on a listing to
                add it here.
              </Text>
            </View>
          }
        />
      )}
    </GradientScreen>
  );
}
