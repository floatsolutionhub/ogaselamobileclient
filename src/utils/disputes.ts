import type { DisputeStatus } from "@/services/disputes";

export const DISPUTE_STATUS_STYLE: Record<
  DisputeStatus,
  { label: string; className: string }
> = {
  Open: { label: "Open", className: "bg-danger/10 text-danger" },
  InReview: { label: "In review", className: "bg-gold-50 text-gold-700" },
  Resolved: { label: "Resolved", className: "bg-brand-50 text-brand-700" },
};
