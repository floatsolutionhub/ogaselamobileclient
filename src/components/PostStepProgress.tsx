import { Text, View } from "react-native";

/** Steps 1-3 are the post form (app/(app)/post.tsx); step 4 is checkout (app/choose-plan.tsx). */
export const POST_STEPS = ["Item details", "Photos", "Description & price", "Promote & pay"] as const;

export function PostStepProgress({ current }: { current: number }) {
  return (
    <>
      <View className="mt-4 flex-row gap-1.5">
        {POST_STEPS.map((label, index) => (
          <View
            key={label}
            className={`h-1.5 flex-1 rounded-full ${index <= current ? "bg-brand-600" : "bg-brand-100"}`}
          />
        ))}
      </View>
      <Text className="mt-2 font-poppins-medium text-caption text-ink-500">
        Step {current + 1} of {POST_STEPS.length} · {POST_STEPS[current]}
      </Text>
    </>
  );
}
