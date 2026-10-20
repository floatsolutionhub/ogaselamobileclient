import { Ban, Check, MapPin, Search, X } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Modal } from "@/components/ActivityModal";
import { CategoryIcon } from "@/components/CategoryCard";
import { colors } from "@/theme/colors";
import { ICON } from "@/theme/typography";

export type SheetOption = { id: string; name: string; imageUrl?: string | null };

type OptionSheetProps = {
  visible: boolean;
  title: string;
  options: SheetOption[];
  selectedId: string;
  /** Called with the picked option's id, or "" for the clear row. */
  onSelect: (id: string) => void;
  onClose: () => void;
  /** When set, a first row with this label clears the choice. */
  clearLabel?: string;
  /** What's beside each name: a category's image/icon, or a map pin for a place. */
  art?: "category" | "place";
  /** When set, a search box above the list filters it by name. */
  searchPlaceholder?: string;
  loading?: boolean;
};

/** A list of options to pick one from, in a sheet that slides up from the bottom. */
export function OptionSheet({
  visible,
  title,
  options,
  selectedId,
  onSelect,
  onClose,
  clearLabel,
  art = "category",
  searchPlaceholder,
  loading,
}: OptionSheetProps) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const shown = q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options;

  // Each opening starts with the full list.
  const close = () => {
    setQuery("");
    onClose();
  };

  const choose = (id: string) => {
    onSelect(id);
    close();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(16,24,40,0.45)" }}>
        <Pressable style={{ flex: 1 }} onPress={close} accessibilityLabel="Close" />
        <View
          className="rounded-t-3xl bg-white pt-5"
          style={{ maxHeight: "80%", paddingBottom: Math.max(insets.bottom, 16) }}
        >
          <View className="mb-2 flex-row items-center justify-between px-6">
            <Text className="font-poppins-semibold text-title text-ink-900">{title}</Text>
            <Pressable
              onPress={close}
              hitSlop={10}
              accessibilityLabel="Close"
              className="h-9 w-9 items-center justify-center rounded-full bg-surface"
            >
              <X size={ICON.md} color={colors.ink700} />
            </Pressable>
          </View>

          {searchPlaceholder ? (
            <View className="mx-6 mb-1 mt-2 flex-row items-center gap-2 rounded-2xl border border-brand-100 bg-surface px-4 py-3">
              <Search size={ICON.sm} color={colors.ink500} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={searchPlaceholder}
                placeholderTextColor={colors.ink300}
                className="flex-1 font-poppins text-body text-ink-900"
              />
            </View>
          ) : null}

          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 8 }}
            keyboardShouldPersistTaps="handled"
          >
            {loading ? <ActivityIndicator color={colors.brand600} style={{ marginVertical: 24 }} /> : null}
            {clearLabel && !q ? (
              <Row label={clearLabel} art="clear" selected={!selectedId} onPress={() => choose("")} />
            ) : null}
            {shown.map((option) => (
              <Row
                key={option.id}
                label={option.name}
                imageUrl={option.imageUrl}
                art={art}
                selected={option.id === selectedId}
                onPress={() => choose(option.id)}
              />
            ))}
            {!loading && q && shown.length === 0 ? (
              <Text className="mt-6 text-center font-poppins text-body text-ink-500">Nothing matches “{query}”</Text>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Row({
  label,
  imageUrl,
  art,
  selected,
  onPress,
}: {
  label: string;
  imageUrl?: string | null;
  /** "clear" is the row that clears the choice. */
  art: "category" | "place" | "clear";
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      className="flex-row items-center justify-between border-b border-brand-50 py-3.5"
    >
      <View className="flex-1 flex-row items-center gap-3">
        {art === "place" ? (
          <MapPin size={ICON.sm} color={selected ? colors.brand600 : colors.ink300} />
        ) : (
          <View className="h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-brand-50">
            {/* Same artwork and fallback icons as the home page category cards. */}
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={{ width: 40, height: 40 }} resizeMode="cover" />
            ) : art === "clear" ? (
              <Ban size={ICON.md} color={colors.ink300} strokeWidth={1.75} />
            ) : (
              <CategoryIcon name={label} size={ICON.md} color={colors.ink700} strokeWidth={1.75} />
            )}
          </View>
        )}
        <Text
          numberOfLines={1}
          className={`flex-1 font-poppins-medium text-body ${selected ? "text-brand-700" : "text-ink-900"}`}
        >
          {label}
        </Text>
      </View>
      {selected ? <Check size={ICON.md} color={colors.brand600} /> : null}
    </Pressable>
  );
}
