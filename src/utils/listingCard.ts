import type { Listing, SearchResultItem } from "@/types/api";

/** Seller listings come back as Listing; ListingCard renders SearchResultItem. */
export function toCardItem(listing: Listing): SearchResultItem {
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
