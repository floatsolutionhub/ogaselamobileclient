// Ogasela.Api/Controllers/Listings/ListingsController.cs - one function per route, in the same order they're declared there.
import { File as ExpoFile } from "expo-file-system";

import { api } from "@/lib/apiClient";
import type {
  Listing,
  ListingCondition,
  ListingDetail,
  PagedResult,
  SearchResultItem,
  UploadListingImageResponse,
} from "@/types/api";

export interface ListingInput {
  title: string;
  description: string;
  categoryId: string;
  price: number | null;
  condition: ListingCondition;
  mediaUrls: string[];
  promotionPlanId: string | null;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  /** Used items only. */
  hasOriginalReceipt?: boolean | null;
  tikTokUrl?: string | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  youTubeUrl?: string | null;
}

export function createDraft(input: ListingInput): Promise<Listing> {
  return api.post<Listing>("/listings", input);
}

/**
 * Uploads one photo (multipart) and returns its permanent URL - call once per photo, collect the
 * URLs into ListingInput.mediaUrls before create/update.
 *
 * SDK 57 replaced React Native's own fetch/FormData with Expo's spec-compliant "winter" fetch, even
 * on native - it only accepts a real Blob (or a Blob-like object with a `.bytes()` method) as a
 * FormData file part, not the classic RN {uri, name, type} shape, which now throws "Unsupported
 * FormDataPart implementation". `webFile` is expo-image-picker's ImagePickerAsset.file (a real
 * browser File, present only on Expo web); on native there is no such object, so the local `uri` is
 * wrapped in expo-file-system's `File` class instead, which implements the Blob interface via
 * `.bytes()` and is exactly what winter's FormData conversion expects.
 */
export function uploadImage(file: {
  uri: string;
  name: string;
  type: string;
  webFile?: File;
}): Promise<UploadListingImageResponse> {
  const formData = new FormData();
  const filePart = file.webFile ?? new ExpoFile(file.uri);
  formData.append("image", filePart, file.name);
  return api.postForm<UploadListingImageResponse>("/listings/images", formData);
}

export function update(id: string, input: ListingInput): Promise<Listing> {
  return api.put<Listing>(`/listings/${id}`, input);
}

export function publish(id: string): Promise<Listing> {
  return api.post<Listing>(`/listings/${id}/publish`);
}

export type ListingPaymentMethod = "Card" | "Wallet";

/**
 * Submitted: paid (or free) and sent for review. PaymentRequired: open redirectUrl, then confirm.
 * PaymentPending: the gateway hasn't confirmed yet - confirm again shortly. PaymentFailed: not
 * paid; the ad is still a draft. PaymentCancelled: the seller left the payment page without paying.
 */
export type ListingCheckoutOutcome =
  | "Submitted"
  | "PaymentRequired"
  | "PaymentPending"
  | "PaymentFailed"
  | "PaymentCancelled";

export interface ListingCheckout {
  outcome: ListingCheckoutOutcome;
  listing: Listing;
  paymentReference: string | null;
  redirectUrl: string | null;
}

/** Pays for a draft's plan. Every publish rule except payment is checked before any money moves. */
export function checkout(id: string, promotionPlanId: string, paymentMethod: ListingPaymentMethod): Promise<ListingCheckout> {
  return api.post<ListingCheckout>(`/listings/${id}/checkout`, { promotionPlanId, paymentMethod });
}

/** After the card page closes: asks the gateway and, once paid, submits the ad. Safe to repeat. */
export function confirmCheckout(id: string, reference: string): Promise<ListingCheckout> {
  return api.post<ListingCheckout>(`/listings/${id}/checkout/${encodeURIComponent(reference)}/confirm`);
}

/**
 * After the seller closes the card page without paying: recorded as cancelled, unless the gateway
 * says it was paid (then it's submitted) or is still in progress (PaymentPending).
 */
export function cancelCheckout(id: string, reference: string): Promise<ListingCheckout> {
  return api.post<ListingCheckout>(`/listings/${id}/checkout/${encodeURIComponent(reference)}/cancel`);
}

/**
 * Moves an ad whose plan is running (live, or an edit in review / sent back) onto a bigger plan, for
 * the new plan's full price. Same outcomes as checkout; card payments confirm/cancel through the
 * checkout endpoints. Once paid, the new plan starts counting immediately and the old expiry date
 * no longer applies. Downgrades are refused.
 */
export function upgradePlan(id: string, promotionPlanId: string, paymentMethod: ListingPaymentMethod): Promise<ListingCheckout> {
  return api.post<ListingCheckout>(`/listings/${id}/upgrade`, { promotionPlanId, paymentMethod });
}

/** Sends a fixed, rejected edit of a live ad back for review - free, its plan keeps running. */
export function resubmit(id: string): Promise<Listing> {
  return api.post<Listing>(`/listings/${id}/resubmit`);
}

/** Deletes a Draft (including rejected), PendingReview or Expired ad for good. A paid plan isn't refunded. */
export function deleteListing(id: string): Promise<void> {
  return api.del<void>(`/listings/${id}`);
}

export function getDetail(id: string): Promise<ListingDetail> {
  return api.get<ListingDetail>(`/listings/${id}`);
}

export function getById(id: string): Promise<Listing> {
  return api.get<Listing>(`/listings/${id}`);
}

/** id is the SellerProfile id (CurrentUser.sellerProfile.id), not the User id. Doubles as "my listings" when called with your own seller profile id. */
export function getSellerListings(
  sellerId: string,
  page = 1,
  pageSize = 20,
): Promise<PagedResult<Listing>> {
  return api.get<PagedResult<Listing>>(
    `/sellers/${sellerId}/listings?page=${page}&pageSize=${pageSize}`,
  );
}

export function pause(id: string): Promise<Listing> {
  return api.post<Listing>(`/listings/${id}/pause`);
}

export function markSold(id: string): Promise<Listing> {
  return api.post<Listing>(`/listings/${id}/mark-sold`);
}

export function repost(id: string): Promise<Listing> {
  return api.post<Listing>(`/listings/${id}/repost`);
}

/** Flags an ad for moderator review. Signed-in only; you can't report your own ad. */
export function reportListing(id: string, reason: string): Promise<void> {
  return api.post<void>(`/listings/${id}/report`, { reason });
}

/**
 * Home-screen Hot Picks: up to 50 live ads buyers engage with most, mixed across categories.
 * Keep the same seed while paging through one visit; a new seed reshuffles the mix.
 */
export function getHotPicks(params: {
  categoryId?: string;
  /** Only ads from this place, e.g. the city the user picked ("Ikeja" matches "Ikeja, Lagos"). */
  location?: string;
  page: number;
  pageSize: number;
  seed: number;
}): Promise<PagedResult<SearchResultItem>> {
  const query = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
    seed: String(params.seed),
  });
  if (params.categoryId) query.set("categoryId", params.categoryId);
  if (params.location) query.set("location", params.location);
  return api.get<PagedResult<SearchResultItem>>(
    `/listings/hot?${query.toString()}`,
  );
}
