// Ogasela.Api/Controllers/Reviews/ReviewsController.cs - one function per route.
import { api } from "@/lib/apiClient";
import type { PagedReviews, Review } from "@/types/api";

/** One review per (buyer, listing) - a seller can't review their own listing. rating is 1-5. */
export function createReview(listingId: string, rating: number, comment: string): Promise<Review> {
  return api.post<Review>("/reviews", { listingId, rating, comment });
}

/** id is the SellerProfile id being reviewed. */
export function getSellerReviews(sellerId: string, page = 1, pageSize = 20): Promise<PagedReviews> {
  return api.get<PagedReviews>(`/sellers/${sellerId}/reviews?page=${page}&pageSize=${pageSize}`);
}
