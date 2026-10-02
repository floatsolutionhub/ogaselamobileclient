import { listings } from "@/data/listings";
import { Listing } from "@/types/listing";
import { Coordinates, distanceKm } from "@/utils/geo";

function sortByDistance(items: Listing[], from: Coordinates | null): Listing[] {
  if (!from) return items;
  return [...items].sort(
    (a, b) => distanceKm(from, a) - distanceKm(from, b)
  );
}

export function getRecommended(near: Coordinates | null = null): Listing[] {
  return sortByDistance(
    listings.filter((listing) => listing.isRecommended),
    near
  );
}

export function getByCategory(
  categoryId: string,
  near: Coordinates | null = null
): Listing[] {
  return sortByDistance(
    listings.filter((listing) => listing.categoryId === categoryId),
    near
  );
}

export function getByIds(ids: string[]): Listing[] {
  const idSet = new Set(ids);
  return listings.filter((listing) => idSet.has(listing.id));
}

export function getById(id: string): Listing | undefined {
  return listings.find((listing) => listing.id === id);
}

type SearchFilters = {
  category?: string;
  subcategory?: string;
  location?: string;
};

export function search(
  query: string,
  filters: SearchFilters = {},
  near: Coordinates | null = null
): Listing[] {
  const normalizedQuery = query.trim().toLowerCase();

  const results = listings.filter((listing) => {
    const matchesQuery =
      normalizedQuery.length === 0 ||
      listing.title.toLowerCase().includes(normalizedQuery);
    const matchesCategory =
      !filters.category || listing.categoryId === filters.category;
    const matchesSubcategory =
      !filters.subcategory || listing.subcategoryId === filters.subcategory;
    const matchesLocation =
      !filters.location || listing.location === filters.location;

    return matchesQuery && matchesCategory && matchesSubcategory && matchesLocation;
  });

  return sortByDistance(results, near);
}

export function distanceLabel(listing: Listing, from: Coordinates | null): string | null {
  if (!from) return null;
  const km = distanceKm(from, listing);
  return km < 1 ? "Less than 1km away" : `${km.toFixed(0)}km away`;
}
