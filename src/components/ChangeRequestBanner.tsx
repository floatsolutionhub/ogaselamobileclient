import { Clock, XCircle } from "lucide-react-native";
import moment from "moment";
import { Pressable, Text, View } from "react-native";

import type { ProfileChange } from "@/services/me";
import { colors } from "@/theme/colors";

/**
 * Shows where the latest change of one type stands: awaiting approval (with a way to withdraw
 * it) or rejected with the reviewer's reason. Approved/cancelled requests show nothing - the
 * new details are already on the account, or nothing changed.
 */
export function ChangeRequestBanner({
  change,
  pendingText,
  onCancel,
  cancelling,
}: {
  change?: ProfileChange;
  /** What's waiting, e.g. "New email: a@b.com". */
  pendingText: string;
  onCancel?: () => void;
  cancelling?: boolean;
}) {
  if (change?.status === "PendingReview") {
    return (
      <View className="flex-row gap-3 rounded-2xl border border-gold-50 bg-gold-50 p-4">
        <Clock size={18} color={colors.gold700} />
        <View className="flex-1">
          <Text className="font-poppins-semibold text-sm text-gold-700">
            Awaiting approval
          </Text>
          <Text className="mt-0.5 font-poppins text-xs text-ink-700">
            {pendingText}
          </Text>
          <Text className="mt-0.5 font-poppins text-[11px] text-ink-500">
            Submitted {moment(change.createdAt).format("D MMM YYYY, h:mm a")}.
            Your current details stay in use until it's approved.
          </Text>
          {onCancel ? (
            <Pressable
              onPress={onCancel}
              disabled={cancelling}
              hitSlop={8}
              className="mt-2 self-start"
            >
              <Text className="font-poppins-semibold text-xs text-danger">
                {cancelling ? "Withdrawing..." : "Withdraw request"}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  if (change?.status === "Rejected") {
    return (
      <View className="flex-row gap-3 rounded-2xl border border-danger/20 bg-danger/5 p-4">
        <XCircle size={18} color={colors.danger} />
        <View className="flex-1">
          <Text className="font-poppins-semibold text-sm text-danger">
            Last request wasn't approved
          </Text>
          {change.reviewNote ? (
            <Text className="mt-0.5 font-poppins text-xs text-ink-700">
              {change.reviewNote}
            </Text>
          ) : null}
          <Text className="mt-0.5 font-poppins text-[11px] text-ink-500">
            You can submit it again below.
          </Text>
        </View>
      </View>
    );
  }

  return null;
}
