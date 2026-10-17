/**
 * The type and icon scales, for places that take style props rather than classNames (tab bar,
 * navigation options, inline styles). Keep in step with fontSize in tailwind.config.js.
 */
export const TYPE = {
  micro: { fontSize: 12, lineHeight: 16 },
  caption: { fontSize: 13, lineHeight: 18 },
  body: { fontSize: 15, lineHeight: 22 },
  subtitle: { fontSize: 17, lineHeight: 24 },
  title: { fontSize: 19, lineHeight: 26 },
  heading: { fontSize: 22, lineHeight: 28 },
  display: { fontSize: 26, lineHeight: 32 },
  hero: { fontSize: 30, lineHeight: 36 },
} as const;

export const FONT = {
  regular: "Poppins_400Regular",
  medium: "Poppins_500Medium",
  semibold: "Poppins_600SemiBold",
  bold: "Poppins_700Bold",
} as const;

/**
 * Icon sizes. xs: inline with captions and inside pills · sm: inline with body text, list
 * chevrons · md: buttons and inputs · lg: header and navigation actions · xl: feature icons
 * in tiles. Illustration-sized icons (empty states, hero art) can stay larger.
 */
export const ICON = {
  xs: 14,
  sm: 18,
  md: 20,
  lg: 24,
  xl: 28,
} as const;
