// Ogasela.Api/Controllers/Verification/VerificationController.cs - the consumer (non-Moderator) routes only.
import { api } from "@/lib/apiClient";
import { appendFile, type LocalFile } from "@/services/me";
import type {
  CreateLivenessSessionResponse,
  SubmitBiometricConsentResponse,
  SubmitVerificationResponse,
  VerificationStatusResponse,
} from "@/types/api";

export function submitConsent(): Promise<SubmitBiometricConsentResponse> {
  return api.post<SubmitBiometricConsentResponse>("/verification/consent");
}

export function createLivenessSession(): Promise<CreateLivenessSessionResponse> {
  return api.post<CreateLivenessSessionResponse>("/verification/liveness-session");
}

/** Multipart, up to 20MB. Form fields: selfie, idPhoto, livenessSessionRef. */
export function submit(
  selfie: LocalFile,
  idPhoto: LocalFile,
  livenessSessionRef: string
): Promise<SubmitVerificationResponse> {
  const formData = new FormData();
  appendFile(formData, "selfie", selfie);
  appendFile(formData, "idPhoto", idPhoto);
  formData.append("livenessSessionRef", livenessSessionRef);
  return api.postForm<SubmitVerificationResponse>("/verification/submit", formData);
}

export function getStatus(): Promise<VerificationStatusResponse> {
  return api.get<VerificationStatusResponse>("/verification/status");
}
