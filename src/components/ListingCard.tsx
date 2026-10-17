import { useRouter } from "expo-router";
import { Heart, MapPin } from "lucide-react-native";
import moment from "moment";
import { Image, Pressable, Text, View } from "react-native";

import { useAuth } from "@/context/AuthContext";
import { useFavourites } from "@/context/FavouritesContext";
import { colors } from "@/theme/colors";
import { SearchResultItem } from "@/types/api";
import { formatNaira } from "@/utils/currency";
import { ICON } from "@/theme/typography";

type ListingCardProps = {
  listing: SearchResultItem;
  variant?: "rail" | "grid";
};

export function ListingCard({ listing, variant = "rail" }: ListingCardProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { isFavourite, toggleFavourite } = useFavourites();
  const favourited = isFavourite(listing.id);

  const distance =
    listing.distanceKm !== null
      ? listing.distanceKm < 1
        ? "Less than 1km away"
        : `${Math.round(listing.distanceKm)}km away`
      : null;

  const handleFavouritePress = () => {
    if (!isAuthenticated) {
      router.push({
        pathname: "/(modals)/sign-in",
        params: { redirect: "/(app)/favourites" },
      });
      return;
    }
    toggleFavourite(listing.id);
  };

  return (
    <Pressable
      onPress={() =>
        router.push({ pathname: "/listing/[id]", params: { id: listing.id } })
      }
      className={`overflow-hidden rounded-2xl border border-brand-50 bg-white ${
        variant === "rail" ? "w-44" : "flex-1"
      }`}
    >
      <View className="relative">
        {listing.thumbnailUrl ? (
          <Image
            source={{ uri: listing.thumbnailUrl }}
            className="h-32 w-full bg-brand-50"
            resizeMode="cover"
          />
        ) : (
          <View className="h-32 w-full bg-brand-50" />
        )}
        <Pressable
          onPress={handleFavouritePress}
          hitSlop={8}
          className="absolute right-2 top-2 h-8 w-8 items-center justify-center rounded-full bg-white/90"
        >
          <Heart
            size={ICON.sm}
            color={favourited ? colors.danger : colors.ink500}
            fill={favourited ? colors.danger : "transparent"}
          />
        </Pressable>
      </View>

      <View className="p-3">
        <Text
          className="font-poppins-semibold text-body text-ink-900"
          numberOfLines={1}
        >
          {listing.price !== null
            ? formatNaira(listing.price)
            : "Price on request"}
        </Text>
        <Text
          className="mt-1 font-poppins text-caption text-ink-700"
          numberOfLines={2}
        >
          {listing.title}
        </Text>
        <View className="mt-2 flex-row items-center gap-1">
          <MapPin size={ICON.xs} color={colors.ink300} />
          <Text
            className="font-poppins text-micro text-ink-300"
            numberOfLines={1}
          >
            {listing.location}
            {distance
              ? ` · ${distance}`
              : ` · ${moment(listing.publishedAt ?? listing.createdAt).fromNow()}`}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
