// AdIntegrationsController.cs + ListingAdsController.cs - Facebook/TikTok ad boosting for
// sellers. NOT wired into any screen yet: the OAuth callback route returns a bare 200 with no
// deep-link back to the app, so connect()'s hosted-browser flow can't auto-detect completion from
// a native client the way a normal web OAuth redirect would. These functions are here (every
// route gets a service per the project convention) but a real "Connect Facebook" button needs
// that backend gap closed first - see the plan notes.
import { api } from "@/lib/apiClient";
import type { AdCampaign, AdPerformance, AdPlatform, ConnectAdPlatformResponse } from "@/types/api";

export function connect(platform: AdPlatform): Promise<ConnectAdPlatformResponse> {
  return api.post<ConnectAdPlatformResponse>(`/integrations/${platform}/connect`);
}

export function disconnect(platform: AdPlatform): Promise<void> {
  return api.del<void>(`/integrations/${platform}`);
}

export interface PromoteListingInput {
  budgetKobo: number;
  durationDays: number;
  audience: string | null;
  adCopyTitle: string | null;
  adCopyDescription: string | null;
}

export function promoteListing(listingId: string, platform: AdPlatform, input: PromoteListingInput): Promise<AdCampaign> {
  return api.post<AdCampaign>(`/listings/${listingId}/promote/${platform}`, input);
}

export function getAdPerformance(listingId: string): Promise<AdPerformance> {
  return api.get<AdPerformance>(`/listings/${listingId}/ad-performance`);
}

export function pauseCampaign(listingId: string, platform: AdPlatform): Promise<AdCampaign> {
  return api.post<AdCampaign>(`/listings/${listingId}/promote/${platform}/pause`);
}

export function resumeCampaign(listingId: string, platform: AdPlatform): Promise<AdCampaign> {
  return api.post<AdCampaign>(`/listings/${listingId}/promote/${platform}/resume`);
}

export function endCampaign(listingId: string, platform: AdPlatform): Promise<AdCampaign> {
  return api.post<AdCampaign>(`/listings/${listingId}/promote/${platform}/end`);
}
