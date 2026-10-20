// Ogasela.Api/Controllers/Analytics/AnalyticsController.cs - GET /sellers/{id}
import { api } from "@/lib/apiClient";

export interface SellerProfile {
  sellerProfileId: string;
  businessName: string;
  name: string | null;
  storeAddress: string | null;
  verificationStatus: string;
  memberSince: string;
  activeAdCount: number;
  averageRating: number;
  reviewCount: number;
  isBusinessVerified?: boolean;
  userId: string;
  /** The signed-in viewer has blocked this seller - their storefront comes back with no ads. */
  isBlockedByMe?: boolean;
}

/** Public storefront header. Opening it counts as a profile visit for the seller (not when it's your own). */
export function getSellerProfile(
  sellerProfileId: string,
): Promise<SellerProfile> {
  return api.get<SellerProfile>(`/sellers/${sellerProfileId}`);
}
