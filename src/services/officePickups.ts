// Ogasela.Api/Controllers/OfficePickups/OfficePickupsController.cs - office pickup.
// Every amount from these endpoints is in kobo.
import { api } from "@/lib/apiClient";

export type OfficePickupStatus =
  | "AwaitingPayment"
  | "PaymentFailed"
  | "PaymentCancelled"
  | "PaymentConfirmed"
  | "ItemReceived"
  | "InspectionPassed"
  | "InspectionFailed"
  | "ReadyForCollection"
  | "OutForDelivery"
  | "Completed"
  | "Refunded";

export interface OfficeBranch {
  id: string;
  name: string;
  address: string;
  state: string;
  city: string | null;
  phone: string | null;
  openingHours: string | null;
  latitude: number;
  longitude: number;
  distanceKm: number | null;
}

export interface OfficePickupQuote {
  available: boolean;
  itemPriceKobo: number;
  serviceFeeKobo: number;
  totalKobo: number;
  cancellationFeeKobo: number;
  serviceFeePercent: number;
  cancellationFeePercent: number;
  /** The caller is this ad's seller - office pickup is never offered to them. */
  isOwnListing: boolean;
}

export interface OfficePickupSummary {
  id: string;
  reference: string;
  listingId: string;
  listingTitle: string;
  listingThumbnailUrl: string | null;
  myRole: "Buyer" | "Seller";
  status: OfficePickupStatus;
  statusLabel: string;
  totalKobo: number;
  branchName: string;
  cancellationRequested: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OfficePickupActivity {
  status: OfficePickupStatus;
  title: string;
  note: string | null;
  createdAt: string;
}

export interface OfficePickupDetail {
  summary: OfficePickupSummary;
  itemPriceKobo: number;
  serviceFeeKobo: number;
  paidAt: string | null;
  branch: OfficeBranch;
  fulfilment: "BranchCollection" | "HomeDelivery" | null;
  deliveryAddress: string | null;
  cancellationRequestedAt: string | null;
  cancellationReason: string | null;
  cancellationFeeKobo: number | null;
  refundedKobo: number | null;
  refundedAt: string | null;
  completedAt: string | null;
  /** Newest first. */
  activities: OfficePickupActivity[];
}

export interface OfficePickupCheckout {
  request: OfficePickupSummary;
  paymentReference: string;
  redirectUrl: string;
}

/** Active branches - nearest first when coordinates are passed. */
export function getBranches(
  coords?: { latitude: number; longitude: number } | null,
): Promise<OfficeBranch[]> {
  const query = coords
    ? `?latitude=${coords.latitude}&longitude=${coords.longitude}`
    : "";
  return api.get<OfficeBranch[]>(`/office-pickups/branches${query}`);
}

export function getQuote(listingId: string): Promise<OfficePickupQuote> {
  return api.get<OfficePickupQuote>(`/office-pickups/quote/${listingId}`);
}

/** Creates the request and starts the Paystack checkout. Open redirectUrl, then confirmPayment. */
export function start(
  listingId: string,
  branchId: string,
): Promise<OfficePickupCheckout> {
  return api.post<OfficePickupCheckout>("/office-pickups", {
    listingId,
    branchId,
  });
}

/** The buyer closed the payment page: cancelled unless the gateway says it's paid or still in progress. */
export function cancelPayment(id: string): Promise<OfficePickupDetail> {
  return api.post<OfficePickupDetail>(`/office-pickups/${id}/cancel-payment`);
}

/** Safe to call repeatedly; stays AwaitingPayment until the bank confirms. */
export function confirmPayment(id: string): Promise<OfficePickupDetail> {
  return api.post<OfficePickupDetail>(`/office-pickups/${id}/confirm-payment`);
}

export function getMine(): Promise<OfficePickupSummary[]> {
  return api.get<OfficePickupSummary[]>("/office-pickups/mine");
}

export function get(id: string): Promise<OfficePickupDetail> {
  return api.get<OfficePickupDetail>(`/office-pickups/${id}`);
}

export function requestCancellation(
  id: string,
  reason: string,
): Promise<OfficePickupDetail> {
  return api.post<OfficePickupDetail>(`/office-pickups/${id}/cancel`, {
    reason,
  });
}

export const formatKobo = (kobo: number) =>
  `₦${(Math.round(kobo) / 100).toLocaleString("en-NG")}`;

/** Badge colours per stage, matching the dispute badges. */
export const OFFICE_PICKUP_STATUS_STYLE: Record<
  OfficePickupStatus,
  { label: string; className: string }
> = {
  AwaitingPayment: { label: "Awaiting payment", className: "bg-surface text-ink-500" },
  PaymentFailed: { label: "Payment failed", className: "bg-surface text-ink-500" },
  PaymentCancelled: { label: "Cancelled", className: "bg-surface text-ink-500" },
  PaymentConfirmed: { label: "Paid", className: "bg-gold-50 text-gold-700" },
  ItemReceived: { label: "At our office", className: "bg-brand-50 text-brand-700" },
  InspectionPassed: { label: "Inspected", className: "bg-brand-50 text-brand-700" },
  InspectionFailed: { label: "Failed inspection", className: "bg-danger/10 text-danger" },
  ReadyForCollection: { label: "Ready", className: "bg-brand-600 text-white" },
  OutForDelivery: { label: "On its way", className: "bg-brand-600 text-white" },
  Completed: { label: "Completed", className: "bg-brand-50 text-brand-700" },
  Refunded: { label: "Refunded", className: "bg-surface text-ink-500" },
};
