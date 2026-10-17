// Ogasela.Api/Controllers/Accounts/AuthController.cs - one function per route, in the same order
// they're declared there. Internal-role-only routes (admin/login, admin/login/verify) are omitted -
// this is the consumer mobile client.
import { api } from "@/lib/apiClient";
import type {
  AuthTokenResponse,
  RegisterResponse,
  UserRole,
} from "@/types/api";

export interface RegisterInput {
  phone: string | null;
  email: string | null;
  password: string;
  accountType: UserRole;
  businessName: string | null;
  rcNumber: string | null;
  nin: string | null;
  name?: string | null;
}

export function register(input: RegisterInput): Promise<RegisterResponse> {
  return api.post<RegisterResponse>("/auth/register", input);
}

/** Sends a 6-digit SMS code to the phone, valid 5 minutes. Used for both phone-verification and the "request" half of password reset - nothing ties a code to a specific purpose. */
export function requestOtp(phone: string): Promise<void> {
  return api.post<void>("/auth/otp/request", { phone });
}

export function verifyOtp(phone: string, code: string): Promise<void> {
  return api.post<void>("/auth/otp/verify", { phone, code });
}

export type PasswordResetChannel = "Email" | "Phone";

/** Sends a reset code to the chosen email or phone. Succeeds even if no account matches (the API never reveals that). */
export function requestPasswordReset(
  input:
    { channel: "Email"; email: string } | { channel: "Phone"; phone: string },
): Promise<void> {
  return api.post<void>("/auth/password-reset/request", {
    channel: input.channel,
    email: input.channel === "Email" ? input.email : null,
    phone: input.channel === "Phone" ? input.phone : null,
  });
}

/** Pass the same email or phone the code was sent to. Signs the account out everywhere on success. */
export function confirmPasswordReset(
  destination: { email: string } | { phone: string },
  code: string,
  newPassword: string,
): Promise<void> {
  return api.post<void>("/auth/password-reset/confirm", {
    phone: "phone" in destination ? destination.phone : null,
    email: "email" in destination ? destination.email : null,
    code,
    newPassword,
  });
}

/**
 * maskedEmail/maskedPhone: where the code went (empty if it wasn't sent there).
 * verificationRequired: the email/phone they signed in with isn't verified yet - the code went
 * only there, and entering it verifies it and finishes signing in.
 */
export interface LoginOtpSentResponse {
  maskedEmail: string;
  maskedPhone: string;
  verificationRequired: boolean;
  channel: "Email" | "Phone";
}

/** Step 1: phone-or-email + password. No tokens yet - a 6-digit code has been sent to the identifier used (and the other contact too, if verified); complete sign-in with verifyLoginOtp. Exactly one of phone/email must be provided, the other should be null. */
export function login(credentials: {
  phone?: string | null;
  email?: string | null;
  password: string;
}): Promise<LoginOtpSentResponse> {
  return api.post<LoginOtpSentResponse>("/auth/login", {
    phone: credentials.phone ?? null,
    email: credentials.email ?? null,
    password: credentials.password,
  });
}

/** Step 2: the OTP login() sent. Pass the same identifier (phone or email) used in step 1. */
export function verifyLoginOtp(credentials: {
  phone?: string | null;
  email?: string | null;
  code: string;
}): Promise<AuthTokenResponse> {
  return api.post<AuthTokenResponse>("/auth/login/verify", {
    phone: credentials.phone ?? null,
    email: credentials.email ?? null,
    code: credentials.code,
  });
}

export type SocialProvider = "Google" | "Apple" | "Facebook";

export interface SocialLoginResponse extends AuthTokenResponse {
  isNewUser: boolean;
}

/** One-step sign in / sign up with a provider token (Google/Apple ID token, Facebook access token). Returns tokens directly - no OTP step. */
export function socialLogin(input: {
  provider: SocialProvider;
  token: string;
  name: string | null;
  accountType: UserRole;
}): Promise<SocialLoginResponse> {
  return api.post<SocialLoginResponse>("/auth/social", input);
}

export function refresh(refreshToken: string): Promise<AuthTokenResponse> {
  return api.post<AuthTokenResponse>("/auth/refresh", { refreshToken });
}

export function logout(refreshToken: string): Promise<void> {
  return api.post<void>("/auth/logout", { refreshToken });
}

export function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  return api.post<void>("/auth/change-password", {
    currentPassword,
    newPassword,
  });
}
