// Ogasela.Api/Controllers/Search/SearchController.cs
import { api } from "@/lib/apiClient";
import type { ListingCondition, PagedResult, SearchResultItem, SearchSort } from "@/types/api";

export interface SearchFilters {
  query?: string;
  categoryId?: string;
  location?: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  minPrice?: number;
  maxPrice?: number;
  condition?: ListingCondition;
  verifiedSellerOnly?: boolean;
  sort?: SearchSort;
  page?: number;
  pageSize?: number;
}

export function search(filters: SearchFilters): Promise<PagedResult<SearchResultItem>> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }
  return api.get<PagedResult<SearchResultItem>>(`/search?${params.toString()}`);
}
