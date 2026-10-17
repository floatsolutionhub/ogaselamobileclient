import { ChevronRight, type LucideIcon } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import type { UserDocument, UserDocumentStatus } from "@/services/me";
import { colors } from "@/theme/colors";
import { ICON } from "@/theme/typography";

export const DOCUMENT_STATUS_STYLE: Record<
  UserDocumentStatus,
  { label: string; className: string }
> = {
  PendingReview: { label: "In review", className: "bg-gold-50 text-gold-700" },
  Approved: { label: "Approved", className: "bg-brand-50 text-brand-700" },
  Rejected: { label: "Rejected", className: "bg-danger/10 text-danger" },
};

/** One document slot in a card: its latest upload's status, or a prompt to add one. */
export function DocumentRow({
  icon: Icon,
  title,
  document,
  subtitleFor,
  onPress,
  last,
}: {
  icon: LucideIcon;
  title: string;
  document?: UserDocument;
  subtitleFor: (document: UserDocument) => string;
  onPress: () => void;
  last?: boolean;
}) {
  const status = document ? DOCUMENT_STATUS_STYLE[document.status] : null;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className={`flex-row items-center gap-3 px-5 py-4 active:bg-brand-50 ${last ? "" : "border-b border-brand-50"}`}
    >
      <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-50">
        <Icon size={ICON.md} color={colors.brand600} />
      </View>
      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text className="font-poppins-medium text-body text-ink-900">
            {title}
          </Text>
          {status ? (
            <Text
              className={`rounded-full px-2 py-0.5 font-poppins-medium text-micro ${status.className}`}
            >
              {status.label}
            </Text>
          ) : null}
        </View>
        <Text className="font-poppins text-caption text-ink-500" numberOfLines={1}>
          {document ? subtitleFor(document) : "Not uploaded - tap to add"}
        </Text>
        {document?.status === "Rejected" && document.reviewNote ? (
          <Text
            className="mt-0.5 font-poppins text-caption text-danger"
            numberOfLines={2}
          >
            {document.reviewNote} Tap to upload again.
          </Text>
        ) : null}
      </View>
      <ChevronRight size={ICON.sm} color={colors.ink300} />
    </Pressable>
  );
}
