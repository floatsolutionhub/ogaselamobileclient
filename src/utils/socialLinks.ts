/**
 * The optional social links on an ad - mirrors ListingSocialLinks on the API: blank, or an http(s)
 * link on that platform's own domain (subdomains like vm.tiktok.com or m.facebook.com included).
 */
export type SocialPlatform = "tiktok" | "facebook" | "instagram" | "youtube";

export const SOCIAL_PLATFORMS: {
  key: SocialPlatform;
  label: string;
  /** Brand colour, for the link chips on the ad. */
  color: string;
  domains: string[];
  placeholder: string;
}[] = [
  { key: "youtube", label: "YouTube", color: "#FF0000", domains: ["youtube.com", "youtu.be"], placeholder: "https://youtu.be/..." },
  { key: "tiktok", label: "TikTok", color: "#111111", domains: ["tiktok.com"], placeholder: "https://www.tiktok.com/@you/video/..." },
  { key: "instagram", label: "Instagram", color: "#E4405F", domains: ["instagram.com", "instagr.am"], placeholder: "https://www.instagram.com/p/..." },
  { key: "facebook", label: "Facebook", color: "#1877F2", domains: ["facebook.com", "fb.com", "fb.watch"], placeholder: "https://www.facebook.com/..." },
];

export function isPlatformLink(platform: SocialPlatform, url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return true;
  const match = /^https?:\/\/([^/?#:]+)/i.exec(trimmed);
  if (!match) return false;
  const host = match[1].toLowerCase();
  const { domains } = SOCIAL_PLATFORMS.find((p) => p.key === platform)!;
  return domains.some((d) => host === d || host.endsWith(`.${d}`));
}

/** The video id from a watch, short, embed, live or youtu.be link; null if there isn't one. */
export function youTubeVideoId(url: string): string | null {
  const patterns = [
    /youtu\.be\/([\w-]{6,})/i,
    /[?&]v=([\w-]{6,})/i,
    /youtube\.com\/(?:shorts|embed|live|v)\/([\w-]{6,})/i,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(url);
    if (match) return match[1];
  }
  return null;
}
