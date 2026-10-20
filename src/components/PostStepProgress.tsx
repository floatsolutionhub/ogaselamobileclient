import { Text, View } from "react-native";

/**
 * Steps 1-3 are the post form (app/(app)/post.tsx); step 4 is checkout (app/choose-plan.tsx), or
 * finalLabel when an edit ends somewhere else (e.g. "Review" for a live ad's changes).
 */
export const POST_STEPS = ["Item details", "Photos", "Description & price", "Promote & pay"] as const;

export function PostStepProgress({ current, finalLabel }: { current: number; finalLabel?: string }) {
  const label = (index: number) => (index === POST_STEPS.length - 1 && finalLabel ? finalLabel : POST_STEPS[index]);
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
        Step {current + 1} of {POST_STEPS.length} · {label(current)}
      </Text>
    </>
  );
}
