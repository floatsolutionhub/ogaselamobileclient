import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";

import { useAuth } from "@/context/AuthContext";
import * as meService from "@/services/me";
import type {
  VerificationItemKey,
  VerificationOverview,
  VerificationTrack,
} from "@/services/me";
import type { CurrentUser } from "@/types/api";

export const VERIFICATION_ITEM_LABELS: Record<VerificationItemKey, string> = {
  Selfie: "selfie",
  IdCard: "ID card",
  UtilityBill: "utility bill",
  BusinessRegistration: "business registration",
  OfficeUtilityBill: "proof of office address",
};

/** What still has to be (re)submitted - a rejected item needs a fresh upload just like a missing one. */
export function outstandingItems(track: VerificationTrack): string[] {
  return track.items
    .filter((item) => item.state === "Missing" || item.state === "Rejected")
    .map((item) => VERIFICATION_ITEM_LABELS[item.key]);
}

/** "selfie, ID card and utility bill" */
export function joinLabels(labels: string[]): string {
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

/**
 * What the signed-in user record alone says, for when the overview can't be fetched (offline, or an
 * older API): the statuses are right, only the per-item checklist is unknown.
 */
function overviewFromUser(user: CurrentUser): VerificationOverview {
  const seller = user.sellerProfile;
  const personalStatus = seller?.verificationStatus;
  return {
    personal: {
      status:
        personalStatus === "Verified"
          ? "Verified"
          : personalStatus === "Pending" || personalStatus === "ManualReview"
            ? "PendingReview"
            : "InProgress",
      verifiedAt: seller?.verifiedAt ?? null,
      items: [],
    },
    business: seller
      ? {
          status: seller.businessVerifiedAt ? "Verified" : "InProgress",
          verifiedAt: seller.businessVerifiedAt ?? null,
          items: [],
        }
      : null,
  };
}

/**
 * The signed-in user's verification overview, refetched whenever the screen regains focus so it
 * reflects uploads made on Personal/Business Info. Falls back to what the user record says if it
 * can't be fetched, so the status is always shown; `overview` is null only while signed out.
 */
export function useVerificationOverview() {
  const { isAuthenticated, user, refreshUser } = useAuth();
  const [overview, setOverview] = useState<VerificationOverview | null>(null);
  const hasSellerProfile = !!user?.sellerProfile;

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setOverview(null);
      return;
    }
    try {
      const next = await meService.getVerificationOverview();
      setOverview(next);
      // A buyer verified by staff is now a seller - pick up the new role and shop.
      if (next.business && !hasSellerProfile) await refreshUser();
    } catch {
      // Keep the last known status.
    }
  }, [isAuthenticated, hasSellerProfile, refreshUser]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  /** Pull to refresh: the overview plus the signed-in user, so both verification statuses are current. */
  const refresh = useCallback(async () => {
    if (isAuthenticated) await refreshUser().catch(() => {});
    await load();
  }, [isAuthenticated, refreshUser, load]);

  const fallback = useMemo(
    () => (isAuthenticated && user ? overviewFromUser(user) : null),
    [isAuthenticated, user],
  );

  return { overview: isAuthenticated ? (overview ?? fallback) : null, refresh };
}
