import { LinearGradient } from "expo-linear-gradient";
import { cssInterop } from "nativewind";

// expo-linear-gradient isn't a core React Native component, so NativeWind
// doesn't wire up `className` for it automatically the way it does for
// View/Text/ScrollView/etc. Without this, `className="flex-1"` on a
// LinearGradient is silently ignored, the gradient collapses to zero size,
// and every screen built on top of it (see GradientScreen) renders blank.
cssInterop(LinearGradient, {
  className: "style",
});
