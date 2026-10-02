/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#EAF6EE",
          100: "#CFEBD8",
          200: "#A0D6B4",
          300: "#6CBE8B",
          400: "#3FA669",
          500: "#228C4C",
          600: "#146C36",
          700: "#0F5429",
          800: "#0B3F1F",
          900: "#072B15",
        },
        gold: {
          50: "#FFFBEA",
          100: "#FFF3C2",
          200: "#FEE488",
          300: "#FDD24D",
          400: "#FAC122",
          500: "#F0B400",
          600: "#D89A00",
          700: "#B37D00",
          800: "#8A6100",
          900: "#664700",
        },
        ink: {
          900: "#101828",
          700: "#344054",
          500: "#667085",
          300: "#98A2B3",
        },
        surface: "#FAFAF5",
        danger: "#E4483C",
        success: "#12B76A",
      },
      fontFamily: {
        poppins: ["Poppins_400Regular"],
        "poppins-medium": ["Poppins_500Medium"],
        "poppins-semibold": ["Poppins_600SemiBold"],
        "poppins-bold": ["Poppins_700Bold"],
      },
      boxShadow: {
        card: "0 8px 24px rgba(20, 108, 54, 0.12)",
      },
    },
  },
  plugins: [],
};
