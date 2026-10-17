import type { LoginOtpSentResponse } from "@/services/auth";

/** Heading and message for the code step of sign-in and sign-up. */
export function loginOtpCopy(sent: LoginOtpSentResponse): { title: string; message: string } {
  if (sent.verificationRequired) {
    const destination = sent.channel === "Email" ? sent.maskedEmail : sent.maskedPhone;
    return sent.channel === "Email"
      ? {
          title: "Verify your email",
          message: `Your email isn’t verified yet. Enter the 6-digit code we sent to ${destination} to verify it and finish signing in.`,
        }
      : {
          title: "Verify your phone number",
          message: `Your phone number isn’t verified yet. Enter the 6-digit code we sent to ${destination} to verify it and finish signing in.`,
        };
  }

  const destinations = [sent.maskedEmail, sent.maskedPhone].filter(Boolean).join(" and ");
  return { title: "Enter your code", message: `We sent a 6-digit code to ${destinations}.` };
}
