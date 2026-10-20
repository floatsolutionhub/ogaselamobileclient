import type { Listing } from "@/types/api";

// Where an ad is in its life, the way Ogasela.API's Listing decides it (Listing.cs). Same rules as
// OgaselaWebClient/src/lib/listings.ts.

/** It has been live and the plan it was approved on hasn't run out yet. */
export function hasRunningPlan(listing: Pick<Listing, "publishedAt" | "expiresAt">, now = Date.now()): boolean {
  return listing.publishedAt !== null && listing.expiresAt !== null && new Date(listing.expiresAt).getTime() > now;
}

export const isLive = (listing: Pick<Listing, "status">) => listing.status === "Active" || listing.status === "ExpiringSoon";

/**
 * How the ad is edited and paid for:
 * - new: a draft that has never had a plan running - edit, then choose a plan and pay.
 * - renew: expired - freshen it up, then pay for a new plan period.
 * - live: on sale - changes go back to review; the plan can only be upgraded (paid).
 * - fix: an edit of a live ad that wasn't approved - fix it and resubmit for free; the plan keeps running.
 */
export type EditMode = "new" | "renew" | "live" | "fix";

export function editMode(listing: Listing): EditMode | null {
  if (isLive(listing)) return "live";
  if (listing.status === "Expired") return "renew";
  if (listing.status === "Draft") return hasRunningPlan(listing) ? "fix" : "new";
  return null;
}

/** Ads with a running plan can move to a bigger one: live ones, and edits in review or sent back. */
export const canUpgrade = (listing: Listing) =>
  isLive(listing) || ((listing.status === "PendingReview" || listing.status === "Draft") && hasRunningPlan(listing));

export const canDelete = (listing: Pick<Listing, "status">) =>
  listing.status === "Draft" || listing.status === "PendingReview" || listing.status === "Expired";
