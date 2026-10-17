import { PackageCheck } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { OfficePickupSheet } from "@/components/OfficePickupSheet";
import * as officePickups from "@/services/officePickups";
import { colors } from "@/theme/colors";
import { ICON } from "@/theme/typography";

/**
 * Sits under the chat safety notice: lets the buyer start office pickup for the ad they're
 * chatting about, the same flow as the ad's "Request Office Pickup" button. Renders nothing for
 * the seller, or when office pickup isn't offered on the ad's category.
 */
export function ChatOfficePickupPrompt({ listingId, listingTitle }: { listingId: string; listingTitle: string }) {
  const [available, setAvailable] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    officePickups
      .getQuote(listingId)
      .then((quote) => {
        if (active) setAvailable(quote.available);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [listingId]);

  if (!available) return null;

  return (
    <>
      <View className="mt-2 flex-row items-center gap-2 rounded-xl border border-brand-100 bg-brand-50 py-1.5 pl-3 pr-1.5">
        <PackageCheck size={ICON.sm} color={colors.brand600} />
        <Text className="flex-1 font-poppins-medium text-caption text-ink-900">Want office pickup?</Text>
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Send an office pickup request"
          className="rounded-lg bg-brand-600 px-3 py-1.5 active:bg-brand-700"
        >
          <Text className="font-poppins-semibold text-caption text-white">Send Request</Text>
        </Pressable>
      </View>

      <OfficePickupSheet
        visible={open}
        listingId={listingId}
        listingTitle={listingTitle}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
