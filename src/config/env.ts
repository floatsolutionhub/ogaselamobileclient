function parseMinutes(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const apiUrl = process.env.EXPO_PUBLIC_API_URL;
if (!apiUrl) {
  // Fails loudly at import time rather than producing confusing "Network request failed"
  // errors later once a screen actually tries to call the API.
  throw new Error(
    "EXPO_PUBLIC_API_URL is not set - copy .env.example to .env and fill it in.",
  );
}

export const env = {
  autoLogoutMinutes: parseMinutes(
    process.env.EXPO_PUBLIC_AUTO_LOGOUT_MINUTES,
    10,
  ),
  // Social sign-in. A provider whose id is blank shows its button but answers "not available
  // yet" - the API must also have the same ids configured (Ogasela.API SocialAuth settings).
  // EXPO_PUBLIC_GOOGLE_CLIENT_ID is the web client id (kept under its original name).
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? "",
  googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "",
  googleAndroidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? "",
  facebookAppId: process.env.EXPO_PUBLIC_FACEBOOK_APP_ID ?? "",
  // Support channels behind the floating support button. Either can be left blank to hide it.
  supportPhone: process.env.EXPO_PUBLIC_SUPPORT_PHONE ?? "",
  supportWhatsappUrl: process.env.EXPO_PUBLIC_SUPPORT_WHATSAPP_URL ?? "",
  apiUrl,
};
