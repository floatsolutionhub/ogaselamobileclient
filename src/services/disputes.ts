// Ogasela.Api/Controllers/Moderation/DisputesController.cs - buyer-seller disputes.
import { api } from "@/lib/apiClient";
import { appendFile, type LocalFile } from "@/services/me";

export type DisputeReason =
  | "ItemNotAsDescribed"
  | "NotDelivered"
  | "PaidNoResponse"
  | "FakeOrCounterfeit"
  | "BuyerDidNotPay"
  | "Other";
export type DisputeStatus = "Open" | "InReview" | "Resolved";
export type DisputeOutcome =
  "InFavourOfRaiser" | "InFavourOfRespondent" | "MutualAgreement" | "Dismissed";

export const DISPUTE_REASON_LABELS: Record<DisputeReason, string> = {
  ItemNotAsDescribed: "Item not as described",
  NotDelivered: "Item not delivered",
  PaidNoResponse: "Paid, seller stopped responding",
  FakeOrCounterfeit: "Fake or counterfeit item",
  BuyerDidNotPay: "Buyer didn't pay",
  Other: "Something else",
};

export const BUYER_REASONS: DisputeReason[] = [
  "NotDelivered",
  "ItemNotAsDescribed",
  "PaidNoResponse",
  "FakeOrCounterfeit",
  "Other",
];
export const SELLER_REASONS: DisputeReason[] = ["BuyerDidNotPay", "Other"];

export const MAX_EVIDENCE_FILES = 4;

export interface DisputeSummary {
  id: string;
  reference: string;
  listingId: string;
  listingTitle: string;
  listingThumbnailUrl: string | null;
  myRole: "Raiser" | "Respondent";
  otherPartyName: string;
  reason: DisputeReason;
  status: DisputeStatus;
  outcome: DisputeOutcome | null;
  createdAt: string;
  updatedAt: string;
}

export interface DisputeEvidence {
  url: string;
  isPdf: boolean;
}

export interface DisputeThreadMessage {
  id: string;
  authorRole: "Raiser" | "Respondent" | "Staff";
  authorName: string;
  body: string;
  attachment: DisputeEvidence | null;
  createdAt: string;
}

export interface DisputeDetail {
  summary: DisputeSummary;
  description: string;
  evidence: DisputeEvidence[];
  resolutionNote: string | null;
  resolvedAt: string | null;
  messages: DisputeThreadMessage[];
}

export function raiseDispute(input: {
  listingId: string;
  conversationId?: string | null;
  reason: DisputeReason;
  description: string;
  evidence: LocalFile[];
}): Promise<DisputeSummary> {
  const formData = new FormData();
  formData.append("listingId", input.listingId);
  if (input.conversationId)
    formData.append("conversationId", input.conversationId);
  formData.append("reason", input.reason);
  formData.append("description", input.description);
  input.evidence.forEach((file) => appendFile(formData, "evidence", file));
  return api.postForm<DisputeSummary>("/disputes", formData);
}

export function getMyDisputes(): Promise<DisputeSummary[]> {
  return api.get<DisputeSummary[]>("/disputes/mine");
}

export function getDispute(id: string): Promise<DisputeDetail> {
  return api.get<DisputeDetail>(`/disputes/${id}`);
}

export function replyToDispute(
  id: string,
  body: string,
  attachment: LocalFile | null,
): Promise<DisputeThreadMessage> {
  const formData = new FormData();
  formData.append("body", body);
  if (attachment) appendFile(formData, "attachment", attachment);
  return api.postForm<DisputeThreadMessage>(
    `/disputes/${id}/messages`,
    formData,
  );
}
