// Ogasela.Api/Controllers/Analytics/AnalyticsController.cs
import { api } from "@/lib/apiClient";
import type { AdPlatform } from "@/types/api";

export type AnalyticsDays = 7 | 30 | 90;

/** A metric for the chosen period and the same-length period before it. */
export interface MetricComparison {
  current: number;
  previous: number;
}

export interface SellerAnalytics {
  days: number;
  from: string;
  to: string;
  profileVisits: MetricComparison;
  impressions: MetricComparison;
  views: MetricComparison;
  callClicks: MetricComparison;
  messageStarts: MetricComparison;
  saves: MetricComparison;
}

export interface ExternalPlatformEngagement {
  platform: AdPlatform;
  /** False when this ad has never been promoted on the platform (numbers are then 0). */
  promoted: boolean;
  campaignStatus: string | null;
  /** Campaign totals since it started - not limited to the chosen period. */
  impressions: number;
  clicks: number;
  spendKobo: number;
  lastSyncedAt: string | null;
}

export interface ListingAnalytics {
  listingId: string;
  title: string;
  days: number;
  ogasela: {
    impressions: MetricComparison;
    views: MetricComparison;
    callClicks: MetricComparison;
    messageStarts: MetricComparison;
    saves: MetricComparison;
  };
  platforms: ExternalPlatformEngagement[];
}

export function getSellerAnalytics(
  days: AnalyticsDays,
): Promise<SellerAnalytics> {
  return api.get<SellerAnalytics>(`/me/analytics?days=${days}`);
}

export function getListingAnalytics(
  listingId: string,
  days: AnalyticsDays,
): Promise<ListingAnalytics> {
  return api.get<ListingAnalytics>(
    `/me/analytics/listings/${listingId}?days=${days}`,
  );
}

/**
 * Fire-and-forget: tells the API about engagement only the app sees (Call taps, saves).
 * Analytics must never get in the way of the action itself, so failures are ignored.
 */
export function recordEngagement(
  listingId: string,
  engagement: "CallClick" | "Save",
): void {
  api
    .post<void>(`/listings/${listingId}/engagements`, { engagement })
    .catch(() => {});
}
