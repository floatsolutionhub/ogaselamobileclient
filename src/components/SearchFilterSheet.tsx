import { X } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "@/theme/colors";
import type { ListingCondition, SearchSort } from "@/types/api";

export type SearchFilterValues = {
  sort: SearchSort;
  minPrice: number | undefined;
  maxPrice: number | undefined;
  condition: ListingCondition | undefined;
  verifiedSellerOnly: boolean;
  radiusKm: number | undefined;
};

export const DEFAULT_SEARCH_FILTERS: SearchFilterValues = {
  sort: "relevance",
  minPrice: undefined,
  maxPrice: undefined,
  condition: undefined,
  verifiedSellerOnly: false,
  radiusKm: undefined,
};

/** How many filters differ from the defaults - drives the badge on the Filters button. */
export function countActiveFilters(filters: SearchFilterValues): number {
  return [
    filters.sort !== "relevance",
    filters.minPrice !== undefined || filters.maxPrice !== undefined,
    filters.condition !== undefined,
    filters.verifiedSellerOnly,
    filters.radiusKm !== undefined,
  ].filter(Boolean).length;
}

const SORT_OPTIONS: {
  value: SearchSort;
  label: string;
  needsLocation?: boolean;
}[] = [
  { value: "relevance", label: "Best match" },
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Lowest price" },
  { value: "price_desc", label: "Highest price" },
  { value: "distance", label: "Nearest", needsLocation: true },
];

const CONDITION_OPTIONS: {
  value: ListingCondition | undefined;
  label: string;
}[] = [
  { value: undefined, label: "Any" },
  { value: "New", label: "New" },
  { value: "Used", label: "Used" },
];

const RADIUS_OPTIONS: { value: number | undefined; label: string }[] = [
  { value: undefined, label: "Anywhere" },
  { value: 5, label: "5 km" },
  { value: 10, label: "10 km" },
  { value: 25, label: "25 km" },
  { value: 50, label: "50 km" },
  { value: 100, label: "100 km" },
];

type SearchFilterSheetProps = {
  visible: boolean;
  value: SearchFilterValues;
  /** Distance sort and radius need the user's location; hidden without it. */
  hasLocation: boolean;
  onApply: (value: SearchFilterValues) => void;
  onClose: () => void;
};

function toAmount(text: string): number | undefined {
  const digits = text.replace(/\D/g, "");
  return digits ? Number(digits) : undefined;
}

export function SearchFilterSheet({
  visible,
  value,
  hasLocation,
  onApply,
  onClose,
}: SearchFilterSheetProps) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<SearchFilterValues>(value);
  const [minText, setMinText] = useState("");
  const [maxText, setMaxText] = useState("");

  useEffect(() => {
    if (visible) {
      setDraft(value);
      setMinText(value.minPrice?.toString() ?? "");
      setMaxText(value.maxPrice?.toString() ?? "");
    }
  }, [visible, value]);

  const minPrice = toAmount(minText);
  const maxPrice = toAmount(maxText);
  const priceError =
    minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice
      ? "Minimum price can't be more than the maximum."
      : null;

  const apply = () => {
    if (priceError) return;
    onApply({ ...draft, minPrice, maxPrice });
  };

  const reset = () => {
    setDraft(DEFAULT_SEARCH_FILTERS);
    setMinText("");
    setMaxText("");
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(16,24,40,0.45)",
        }}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View
          className="rounded-t-3xl bg-white pt-5"
          style={{
            paddingBottom: Math.max(insets.bottom, 16) + 8,
            maxHeight: "88%",
          }}
        >
          <View className="mb-2 flex-row items-center justify-between px-6">
            <Text className="font-poppins-semibold text-lg text-ink-900">
              Filters
            </Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <X size={20} color={colors.ink500} />
            </Pressable>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 8 }}
          >
            <FilterGroup title="Sort by">
              {SORT_OPTIONS.filter(
                (option) => !option.needsLocation || hasLocation,
              ).map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  active={draft.sort === option.value}
                  onPress={() =>
                    setDraft((prev) => ({ ...prev, sort: option.value }))
                  }
                />
              ))}
            </FilterGroup>

            <View className="mt-5">
              <Text className="mb-2 font-poppins-semibold text-sm text-ink-900">
                Price (₦)
              </Text>
              <View className="flex-row items-center gap-3">
                <PriceInput
                  placeholder="Min"
                  value={minText}
                  onChangeText={setMinText}
                />
                <Text className="font-poppins text-ink-300">–</Text>
                <PriceInput
                  placeholder="Max"
                  value={maxText}
                  onChangeText={setMaxText}
                />
              </View>
              {priceError ? (
                <Text className="mt-1 font-poppins text-xs text-danger">
                  {priceError}
                </Text>
              ) : null}
            </View>

            <FilterGroup title="Condition">
              {CONDITION_OPTIONS.map((option) => (
                <Chip
                  key={option.label}
                  label={option.label}
                  active={draft.condition === option.value}
                  onPress={() =>
                    setDraft((prev) => ({ ...prev, condition: option.value }))
                  }
                />
              ))}
            </FilterGroup>

            {hasLocation ? (
              <FilterGroup title="Distance from you">
                {RADIUS_OPTIONS.map((option) => (
                  <Chip
                    key={option.label}
                    label={option.label}
                    active={draft.radiusKm === option.value}
                    onPress={() =>
                      setDraft((prev) => ({ ...prev, radiusKm: option.value }))
                    }
                  />
                ))}
              </FilterGroup>
            ) : null}

            <View className="mt-5 flex-row items-center justify-between rounded-2xl border border-brand-50 bg-surface px-4 py-3">
              <View className="mr-3 flex-1">
                <Text className="font-poppins-semibold text-sm text-ink-900">
                  Verified sellers only
                </Text>
                <Text className="font-poppins text-xs text-ink-500">
                  Sellers who completed identity verification
                </Text>
              </View>
              <Switch
                value={draft.verifiedSellerOnly}
                onValueChange={(next) =>
                  setDraft((prev) => ({ ...prev, verifiedSellerOnly: next }))
                }
                trackColor={{ true: colors.brand500, false: colors.ink300 }}
                thumbColor={colors.white}
              />
            </View>
          </ScrollView>

          <View className="mt-3 flex-row gap-3 px-6">
            <Pressable
              onPress={reset}
              className="flex-1 items-center justify-center rounded-2xl border border-brand-100 py-4"
            >
              <Text className="font-poppins-semibold text-base text-ink-700">
                Reset
              </Text>
            </Pressable>
            <Pressable
              onPress={apply}
              disabled={!!priceError}
              className="flex-[2] items-center justify-center rounded-2xl bg-brand-600 py-4"
              style={{ opacity: priceError ? 0.5 : 1 }}
            >
              <Text className="font-poppins-semibold text-base text-white">
                Show results
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function FilterGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View className="mt-5">
      <Text className="mb-2 font-poppins-semibold text-sm text-ink-900">
        {title}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {children}
      </View>
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-full border px-4 py-2 ${
        active ? "border-brand-600 bg-brand-600" : "border-brand-100 bg-white"
      }`}
    >
      <Text
        className={`font-poppins-medium text-xs ${active ? "text-white" : "text-ink-700"}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function PriceInput({
  placeholder,
  value,
  onChangeText,
}: {
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={(text) => onChangeText(text.replace(/\D/g, ""))}
      placeholder={placeholder}
      placeholderTextColor={colors.ink300}
      keyboardType="number-pad"
      maxLength={12}
      className="flex-1 rounded-2xl border border-brand-100 bg-surface px-4 py-3 font-poppins text-sm text-ink-900"
    />
  );
}
