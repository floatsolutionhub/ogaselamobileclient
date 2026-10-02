import { Check, X } from "lucide-react-native";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { CategoryNode } from "@/hooks/useCategoryTree";
import { colors } from "@/theme/colors";

type CategoryFilterSheetProps = {
  visible: boolean;
  tree: CategoryNode[];
  /** undefined = all categories. */
  selectedId: string | undefined;
  onSelect: (categoryId: string | undefined) => void;
  onClose: () => void;
};

/** Pick which category Hot Picks shows: everything, a whole category, or one subcategory. */
export function CategoryFilterSheet({
  visible,
  tree,
  selectedId,
  onSelect,
  onClose,
}: CategoryFilterSheetProps) {
  const insets = useSafeAreaInsets();

  const choose = (id: string | undefined) => {
    onSelect(id);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(16,24,40,0.45)",
        }}
      >
        <Pressable
          style={{ flex: 1 }}
          onPress={onClose}
          accessibilityLabel="Close"
        />
        <View
          className="rounded-t-3xl bg-white pt-5"
          style={{
            maxHeight: "80%",
            paddingBottom: Math.max(insets.bottom, 16),
          }}
        >
          <View className="mb-2 flex-row items-center justify-between px-6">
            <Text className="font-poppins-semibold text-lg text-ink-900">
              Show Hot Picks from
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              className="h-9 w-9 items-center justify-center rounded-full bg-surface"
            >
              <X size={18} color={colors.ink700} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 8 }}
          >
            <Row
              label="All categories"
              selected={!selectedId}
              onPress={() => choose(undefined)}
            />
            {tree.map((category) => (
              <View key={category.id}>
                <Row
                  label={category.name}
                  selected={selectedId === category.id}
                  onPress={() => choose(category.id)}
                />
                {category.children.length > 0 ? (
                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      gap: 8,
                      paddingBottom: 12,
                      paddingLeft: 4,
                    }}
                  >
                    {category.children.map((child) => {
                      const selected = selectedId === child.id;
                      return (
                        <Pressable
                          key={child.id}
                          onPress={() => choose(child.id)}
                          className={`rounded-full border px-3 py-1.5 ${
                            selected
                              ? "border-brand-600 bg-brand-600"
                              : "border-brand-100 bg-white"
                          }`}
                        >
                          <Text
                            className={`font-poppins-medium text-xs ${selected ? "text-white" : "text-ink-700"}`}
                          >
                            {child.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Row({
  label,
  selected,
  onPress,
}: {
  label: string;
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
      <Text
        className={`font-poppins-medium text-sm ${selected ? "text-brand-700" : "text-ink-900"}`}
      >
        {label}
      </Text>
      {selected ? <Check size={18} color={colors.brand600} /> : null}
    </Pressable>
  );
}
