import { useRouter } from "expo-router";
import {
  BadgeCheck,
  Check,
  Circle,
  Clock,
  ShieldAlert,
  Store,
  X,
} from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { joinLabels, outstandingItems } from "@/hooks/useVerificationOverview";
import type {
  VerificationItemKey,
  VerificationItemState,
  VerificationTrack,
} from "@/services/me";
import { colors } from "@/theme/colors";

const COPY = {
  personal: {
    title: "Your account isn't verified",
    pendingTitle: "Account verification Pending review",
    verifiedTitle: "Account verified",
    route: "/personal-info",
    Icon: ShieldAlert,
  },
  business: {
    title: "Your business isn't verified",
    pendingTitle: "Business verification Pending review",
    verifiedTitle: "Business verified",
    route: "/business-info",
    Icon: Store,
  },
} as const;

const ITEM_LABELS: Record<VerificationItemKey, string> = {
  Selfie: "Selfie",
  IdCard: "ID card",
  UtilityBill: "Utility bill",
  BusinessRegistration: "Registration",
  OfficeUtilityBill: "Office address",
};

/** How each checklist item reads at a glance: done, with staff, needs redoing, or not started. */
const ITEM_STATE_STYLE: Record<
  VerificationItemState,
  { Icon: typeof Check; color: string; chip: string; label: string }
> = {
  Approved: { Icon: Check, color: colors.brand600, chip: "bg-brand-50", label: "approved" },
  Submitted: { Icon: Clock, color: colors.gold700, chip: "bg-gold-100", label: "in review" },
  Rejected: { Icon: X, color: colors.danger, chip: "bg-danger/10", label: "rejected" },
  Missing: { Icon: Circle, color: colors.ink300, chip: "bg-white", label: "not uploaded" },
};

/**
 * One verification track's standing, always visible so the user knows where they are:
 * - verified: a slim green confirmation;
 * - everything submitted: "Pending review" with a View Submissions button;
 * - otherwise: what's missing and a Verify button.
 * Each unverified state also shows the item-by-item checklist (when known).
 */
export function VerificationBadge({
  kind,
  track,
  note,
}: {
  kind: keyof typeof COPY;
  track: VerificationTrack;
  /** Extra explanation under the title, e.g. why it's needed on this screen. */
  note?: string;
}) {
  const router = useRouter();
  const copy = COPY[kind];

  if (track.status === "Verified") {
    return (
      <View className="flex-row items-center gap-2 rounded-2xl border border-brand-100 bg-brand-50 px-4 py-2.5">
        <BadgeCheck size={18} color={colors.brand600} />
        <Text className="flex-1 font-poppins-semibold text-sm text-brand-700">
          {copy.verifiedTitle}
        </Text>
      </View>
    );
  }

  const pending = track.status === "PendingReview";
  const outstanding = outstandingItems(track);
  const Icon = pending ? Clock : copy.Icon;

  return (
    <View
      className={`flex-row gap-3 rounded-2xl border px-4 py-3 ${
        pending ? "border-brand-100 bg-brand-50" : "border-gold-200 bg-gold-50"
      }`}
    >
      <View className="pt-0.5">
        <Icon size={20} color={pending ? colors.brand600 : colors.gold700} />
      </View>
      <View className="flex-1">
        <View className="flex-row items-center justify-between gap-2">
          <Text className="flex-shrink font-poppins-semibold text-sm text-ink-900">
            {pending ? copy.pendingTitle : copy.title}
          </Text>
          <Pressable
            onPress={() => router.push(copy.route)}
            hitSlop={8}
            accessibilityRole="button"
            className={`rounded-full px-4 py-1.5 active:opacity-90 ${
              pending ? "bg-brand-600" : "bg-gold-500"
            }`}
          >
            <Text
              className={`font-poppins-semibold text-xs ${
                pending ? "text-white" : "text-ink-900"
              }`}
            >
              {pending ? "View Submissions" : "Verify"}
            </Text>
          </Pressable>
        </View>
        {note ? (
          <Text className="mt-1 font-poppins text-xs text-ink-700">{note}</Text>
        ) : null}
        {!pending && outstanding.length > 0 ? (
          <Text className="mt-0.5 font-poppins text-xs text-ink-500">
            Awaiting {joinLabels(outstanding)} upload
          </Text>
        ) : null}
        {track.items.length > 0 ? (
          <View className="mt-2 flex-row flex-wrap gap-1.5">
            {track.items.map((item) => {
              const style = ITEM_STATE_STYLE[item.state];
              return (
                <View
                  key={item.key}
                  accessible
                  accessibilityLabel={`${ITEM_LABELS[item.key]}: ${style.label}`}
                  className={`flex-row items-center gap-1 rounded-full px-2 py-1 ${style.chip}`}
                >
                  <style.Icon size={11} color={style.color} strokeWidth={2.5} />
                  <Text className="font-poppins-medium text-[10px] text-ink-700">
                    {ITEM_LABELS[item.key]}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : null}
      </View>
    </View>
  );
}
