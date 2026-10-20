import {
  Briefcase,
  Building2,
  Car,
  Shirt,
  Smartphone,
  Sofa,
  Tag,
  Wrench,
  type LucideIcon,
  type LucideProps,
} from "lucide-react-native";
import { useState } from "react";
import { Image, Pressable, Text, View } from "react-native";

import { colors } from "@/theme/colors";
import { Category } from "@/types/api";

type CategoryCardProps = {
  category: Category;
  width: number;
  onPress: () => void;
};

// Fallback artwork until a category has an imageUrl set from the Control Portal.
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  electronics: Smartphone,
  fashion: Shirt,
  vehicles: Car,
  "real estate": Building2,
  "home & furniture": Sofa,
  jobs: Briefcase,
  services: Wrench,
};

/** The built-in icon for a category without an image. */
export function CategoryIcon({ name, ...props }: LucideProps & { name: string }) {
  const Icon = CATEGORY_ICONS[name.toLowerCase()] ?? Tag;
  return <Icon {...props} />;
}

export function CategoryCard({ category, width, onPress }: CategoryCardProps) {
  const [pressed, setPressed] = useState(false);
  const artSize = Math.round(width * 0.5);

  return (
    // Card styles live on a plain View with a static style object: NativeWind's Pressable
    // wrapper drops function-form styles (style={({ pressed }) => ...}), which silently lost the
    // size, background, radius and shadow. Press feedback is tracked in state instead.
    <View
      style={{
        width,
        height: width * 1.18,
        borderRadius: 16,
        backgroundColor: colors.white,
        transform: [{ scale: pressed ? 0.96 : 1 }],
        shadowColor: colors.ink900,
        shadowOffset: { width: 0, height: pressed ? 3 : 8 },
        shadowOpacity: pressed ? 0.12 : 0.18,
        shadowRadius: pressed ? 6 : 12,
        elevation: pressed ? 3 : 8,
      }}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        style={{
          flex: 1,
          borderRadius: 16,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 6,
          gap: 6,
        }}
      >
        <View
          style={{
            width: artSize,
            height: artSize,
            borderRadius: 12,
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {category.imageUrl ? (
            <Image
              source={{ uri: category.imageUrl }}
              style={{ width: artSize, height: artSize }}
              resizeMode="cover"
            />
          ) : (
            <CategoryIcon
              name={category.name}
              size={Math.round(artSize * 0.6)}
              color={colors.ink700}
              strokeWidth={1.75}
            />
          )}
        </View>
        <Text
          className="font-poppins-medium text-micro leading-[14px] text-ink-900"
          style={{ width: "100%", textAlign: "center" }}
          numberOfLines={2}
        >
          {category.name}
        </Text>
      </Pressable>
    </View>
  );
}
