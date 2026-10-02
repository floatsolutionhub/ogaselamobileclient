// Ogasela.Api/Controllers/Verification/VerificationController.cs - the consumer (non-Moderator) routes only.
import { api } from "@/lib/apiClient";
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
  selfie: { uri: string; name: string; type: string },
  idPhoto: { uri: string; name: string; type: string },
  livenessSessionRef: string
): Promise<SubmitVerificationResponse> {
  const formData = new FormData();
  formData.append("selfie", { uri: selfie.uri, name: selfie.name, type: selfie.type } as unknown as Blob);
  formData.append("idPhoto", { uri: idPhoto.uri, name: idPhoto.name, type: idPhoto.type } as unknown as Blob);
  formData.append("livenessSessionRef", livenessSessionRef);
  return api.postForm<SubmitVerificationResponse>("/verification/submit", formData);
}

export function getStatus(): Promise<VerificationStatusResponse> {
  return api.get<VerificationStatusResponse>("/verification/status");
}
