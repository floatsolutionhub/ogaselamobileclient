// Ogasela.Api/Controllers/Accounts/MeController.cs - one function per route.
import { File as ExpoFile } from "expo-file-system";

import { api } from "@/lib/apiClient";
import type { CurrentUser } from "@/types/api";

export function getCurrentUser(): Promise<CurrentUser> {
  return api.get<CurrentUser>("/me");
}

/** Only the name is edited directly - phone, email and business info go through change requests (staff approval). */
export function updateProfile(input: { name: string }): Promise<void> {
  return api.patch<void>("/me/profile", input);
}

export type ProfileChangeType = "Phone" | "Email" | "BusinessInfo";
export type ProfileChangeStatus = "PendingReview" | "Approved" | "Rejected" | "Cancelled";

export interface ProfileChange {
  id: string;
  type: ProfileChangeType;
  /** The new phone or email; null for business info. */
  newValue: string | null;
  businessName: string | null;
  storeAddress: string | null;
  status: ProfileChangeStatus;
  /** Why staff rejected it; null otherwise. */
  reviewNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

/** Newest first - the first of each type is the latest. */
export function getMyChangeRequests(): Promise<ProfileChange[]> {
  return api.get<ProfileChange[]>("/me/change-requests");
}

/** Sends a code to the NEW phone (SMS) or email. 409 if another account already uses it. */
export function requestContactChangeCode(type: "Phone" | "Email", value: string): Promise<void> {
  return api.post<void>("/me/change-requests/contact/code", { type, value });
}

/** Checks the code and files the change for approval - it isn't applied until staff approve it. */
export function submitContactChange(
  type: "Phone" | "Email",
  value: string,
  code: string,
): Promise<ProfileChange> {
  return api.post<ProfileChange>("/me/change-requests/contact", { type, value, code });
}

/** Sellers: files a new business name/store address for approval. An empty storeAddress clears it. */
export function submitBusinessInfoChange(businessName: string, storeAddress: string): Promise<ProfileChange> {
  return api.post<ProfileChange>("/me/change-requests/business", { businessName, storeAddress });
}

export function cancelChangeRequest(id: string): Promise<void> {
  return api.del<void>(`/me/change-requests/${id}`);
}

/** Pass null to clear the token (e.g. on logout from this device). */
export function setPushToken(token: string | null): Promise<void> {
  return api.put<void>("/me/push-token", { token });
}

/** A local file to upload - a camera/photo-library URI on native, a File on web. */
export interface LocalFile {
  uri: string;
  name: string;
  type: string;
  webFile?: File;
}

export function appendFile(formData: FormData, field: string, file: LocalFile) {
  formData.append(field, file.webFile ?? new ExpoFile(file.uri), file.name);
}

/** Sets the profile photo. The API rejects it unless it shows exactly one clear face. */
export function uploadProfilePhoto(file: LocalFile): Promise<{ url: string }> {
  const formData = new FormData();
  appendFile(formData, "image", file);
  return api.postForm<{ url: string }>("/me/photo", formData);
}

export type UserDocumentType =
  | "IdCard"
  | "UtilityBill"
  /** Sellers only. */
  | "BusinessRegistration"
  /** Sellers only: proof of the office/business address. */
  | "OfficeUtilityBill";
export type IdDocumentType =
  | "NationalIdCard"
  | "NinSlip"
  | "VotersCard"
  | "DriversLicence"
  | "InternationalPassport";
export type UserDocumentStatus = "PendingReview" | "Approved" | "Rejected";

export interface UserDocument {
  id: string;
  type: UserDocumentType;
  idType: IdDocumentType | null;
  /** Masked to its last 4 characters. */
  idNumber: string | null;
  fileName: string;
  contentType: string;
  status: UserDocumentStatus;
  fileUrl: string;
  createdAt: string;
  /** Why staff rejected it; null otherwise. */
  reviewNote?: string | null;
}

export type VerificationTrackStatus =
  | "NotStarted"
  | "InProgress"
  | "PendingReview"
  | "Verified";
export type VerificationItemKey =
  | "Selfie"
  | "IdCard"
  | "UtilityBill"
  | "BusinessRegistration"
  | "OfficeUtilityBill";
export type VerificationItemState =
  | "Missing"
  | "Submitted"
  | "Approved"
  | "Rejected";

export interface VerificationTrack {
  status: VerificationTrackStatus;
  verifiedAt: string | null;
  items: { key: VerificationItemKey; state: VerificationItemState; note?: string | null }[];
}

export interface VerificationOverview {
  personal: VerificationTrack;
  /** Null for buyers - they get a business once staff verify them and they become a seller. */
  business: VerificationTrack | null;
}

/** Personal and (sellers) business verification: status plus what's still missing. */
export function getVerificationOverview(): Promise<VerificationOverview> {
  return api.get<VerificationOverview>("/me/verification");
}

/** Newest first - the first of each type is the current one. */
export function getMyDocuments(): Promise<UserDocument[]> {
  return api.get<UserDocument[]>("/me/documents");
}

export function uploadDocument(input: {
  type: UserDocumentType;
  idType?: IdDocumentType;
  idNumber?: string;
  file: LocalFile;
}): Promise<UserDocument> {
  const formData = new FormData();
  formData.append("type", input.type);
  if (input.idType) formData.append("idType", input.idType);
  if (input.idNumber) formData.append("idNumber", input.idNumber);
  appendFile(formData, "file", input.file);
  return api.postForm<UserDocument>("/me/documents", formData);
}
