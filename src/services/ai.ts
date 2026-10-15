// Ogasela.Api/Controllers/Ai/AiController.cs - one function per route. Every tool is gated by the
// given plan's AiToolTier - a plan without that capability fails with Ai.NotIncludedInPlan (403).
import { api } from "@/lib/apiClient";
import { appendFile, type LocalFile } from "@/services/me";
import type { EnhanceImageResponse, ListingCondition, ListingCopySuggestion, PriceSuggestion } from "@/types/api";

/** Pass promotionPlanId null while posting an ad (no plan chosen yet) - the tool is free then. */
export function generateDescription(
  promotionPlanId: string | null,
  keywords: string | null,
  imageRef: string | null
): Promise<ListingCopySuggestion> {
  return api.post<ListingCopySuggestion>("/ai/generate-description", { promotionPlanId, keywords, imageRef });
}

/**
 * Pass promotionPlanId null while posting an ad - the tool is free then. Despite the *Kobo names,
 * the values come straight from comparable listings' prices, so they're in the same unit the app
 * saves listing prices in (naira). Fails with Ai.NotEnoughComparableData when there are too few.
 */
export function suggestPrice(
  promotionPlanId: string | null,
  categoryId: string,
  title: string,
  condition: ListingCondition
): Promise<PriceSuggestion> {
  return api.post<PriceSuggestion>("/ai/suggest-price", { promotionPlanId, categoryId, title, condition });
}

/** Multipart, up to 20MB. A real brightness/contrast/sharpen pass, not AI-generated - the returned URL/key can feed generateDescription's imageRef or a listing's mediaUrls. */
export function enhanceImage(
  promotionPlanId: string,
  image: LocalFile
): Promise<EnhanceImageResponse> {
  const formData = new FormData();
  formData.append("promotionPlanId", promotionPlanId);
  appendFile(formData, "image", image);
  return api.postForm<EnhanceImageResponse>("/ai/enhance-image", formData);
}
