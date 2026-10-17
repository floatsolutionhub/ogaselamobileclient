import {
  BadgeCheck,
  ChevronRight,
  Clock,
  Lock,
  ShieldAlert,
} from "lucide-react-native";
import { Pressable, Text } from "react-native";

import type { VerificationTrackStatus } from "@/services/me";
import { colors } from "@/theme/colors";
import { ICON } from "@/theme/typography";

const STYLE: Record<
  VerificationTrackStatus | "Locked",
  {
    text: string;
    Icon: typeof BadgeCheck;
    color: string;
    bg: string;
    textColor: string;
  }
> = {
  Verified: {
    text: "Verified",
    Icon: BadgeCheck,
    color: colors.brand600,
    bg: "bg-brand-50",
    textColor: "text-brand-700",
  },
  PendingReview: {
    text: "Pending review",
    Icon: Clock,
    color: colors.gold700,
    bg: "bg-gold-50",
    textColor: "text-gold-800",
  },
  InProgress: {
    text: "Not verified",
    Icon: ShieldAlert,
    color: colors.danger,
    bg: "bg-danger/10",
    textColor: "text-danger",
  },
  NotStarted: {
    text: "Not verified",
    Icon: ShieldAlert,
    color: colors.danger,
    bg: "bg-danger/10",
    textColor: "text-danger",
  },
  // Buyers: a business comes once the account is verified.
  Locked: {
    text: "After account verification",
    Icon: Lock,
    color: colors.ink500,
    bg: "bg-surface",
    textColor: "text-ink-500",
  },
};

/** "Account: Verified" style status chip; tapping it opens where the user can act on it. */
export function VerificationStatusPill({
  label,
  status,
  onPress,
}: {
  label: string;
  /** null: not available yet (no business until the account is verified). */
  status: VerificationTrackStatus | null;
  onPress?: () => void;
}) {
  const style = STYLE[status ?? "Locked"];
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : "text"}
      accessibilityLabel={`${label} verification: ${style.text}`}
      className={`flex-row items-center gap-1.5 rounded-full px-3 py-1.5 active:opacity-80 ${style.bg}`}
    >
      <style.Icon size={ICON.xs} color={style.color} />
      <Text className={`font-poppins-medium text-micro ${style.textColor}`}>
        {label}: {style.text}
      </Text>
      {onPress && status !== "Verified" ? (
        <ChevronRight size={ICON.xs} color={style.color} />
      ) : null}
    </Pressable>
  );
}
