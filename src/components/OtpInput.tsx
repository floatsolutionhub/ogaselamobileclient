import { useRef, useState } from "react";
import {
  LayoutChangeEvent,
  NativeSyntheticEvent,
  TextInput,
  TextInputKeyPressEventData,
  View,
} from "react-native";

import { colors } from "@/theme/colors";

type OtpInputProps = {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  error?: boolean;
};

const GAP = 10;
const MAX_BOX = 58;

export function OtpInput({
  value,
  onChange,
  length = 6,
  error,
}: OtpInputProps) {
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [boxSize, setBoxSize] = useState(MAX_BOX);
  const digits = Array.from({ length }, (_, index) => value[index] ?? "");

  // Boxes grow to fill the row (up to MAX_BOX) with a fixed gap, instead of small fixed boxes
  // pushed apart by space-between.
  const handleLayout = (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    setBoxSize(
      Math.min(MAX_BOX, Math.floor((width - GAP * (length - 1)) / length)),
    );
  };

  const handleChangeText = (index: number, text: string) => {
    let typed = text.replace(/[^0-9]/g, "");

    // Typing over a box that already has a digit gives "old + new" - keep just the new one.
    if (typed.length === 2 && digits[index]) {
      typed = typed.slice(-1);
    }

    // A pasted or auto-filled code arrives as several digits at once: spread it across the boxes.
    if (typed.length > 1) {
      const next = digits.slice();
      typed
        .slice(0, length - index)
        .split("")
        .forEach((digit, offset) => {
          next[index + offset] = digit;
        });
      onChange(next.join(""));
      const lastFilled = Math.min(index + typed.length, length) - 1;
      inputRefs.current[Math.min(lastFilled + 1, length - 1)]?.focus();
      return;
    }

    const next = digits.slice();
    next[index] = typed;
    onChange(next.join(""));

    if (typed && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (
    index: number,
    event: NativeSyntheticEvent<TextInputKeyPressEventData>,
  ) => {
    if (event.nativeEvent.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      const next = digits.slice();
      next[index - 1] = "";
      onChange(next.join(""));
    }
  };

  return (
    <View
      onLayout={handleLayout}
      className="flex-row justify-center"
      style={{ gap: GAP }}
    >
      {digits.map((digit, index) => {
        const focused = focusedIndex === index;
        return (
          <TextInput
            key={index}
            ref={(ref) => {
              inputRefs.current[index] = ref;
            }}
            value={digit}
            onChangeText={(text) => handleChangeText(index, text)}
            onKeyPress={(event) => handleKeyPress(index, event)}
            onFocus={() => setFocusedIndex(index)}
            onBlur={() =>
              setFocusedIndex((current) => (current === index ? null : current))
            }
            keyboardType="number-pad"
            // Only the first box takes the SMS/email one-time-code autofill; it then spreads the code.
            textContentType={index === 0 ? "oneTimeCode" : "none"}
            autoComplete={index === 0 ? "sms-otp" : "off"}
            // Room for a whole pasted code; handleChangeText keeps one digit per box.
            maxLength={index === 0 ? length : 1}
            textAlign="center"
            selectionColor={colors.brand500}
            className="rounded-2xl font-poppins-semibold text-ink-900"
            style={{
              width: boxSize,
              height: Math.round(boxSize * 1.15),
              fontSize: Math.round(boxSize * 0.45),
              borderWidth: focused ? 2 : 1,
              borderColor: error
                ? colors.danger
                : focused
                  ? colors.brand500
                  : colors.brand100,
              backgroundColor: focused || digit ? colors.white : colors.surface,
            }}
          />
        );
      })}
    </View>
  );
}
