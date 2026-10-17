import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const SECTIONS = [
  {
    title: "1. Information We Collect",
    body: "We collect the information you provide during registration (full name, email, phone number) as well as the listings, favourites, and messages you create to help operate and improve Ogasela.",
  },
  {
    title: "2. How We Use Your Information",
    body: "Your information is used to verify your identity, connect you with buyers and sellers, personalize your experience, and communicate important account updates.",
  },
  {
    title: "3. Data Sharing",
    body: "We do not sell your personal information. Contact details you choose to share with another user (for example, when messaging about a listing) are visible to that user. We may share data with trusted service providers strictly to operate the app, or when required by law.",
  },
  {
    title: "4. Data Security",
    body: "We use industry-standard safeguards, including encrypted storage and secure sessions, to protect your data from unauthorized access.",
  },
  {
    title: "5. Your Choices",
    body: "You can review, update, or request deletion of your personal information at any time from your Profile settings or by contacting support.",
  },
];

export default function PrivacyScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="flex-1 px-6 pt-4" contentContainerStyle={{ paddingBottom: 40 }}>
        <Text className="mt-1 mb-6 font-poppins text-caption text-ink-500">
          Last updated: September 2026
        </Text>

        {SECTIONS.map((section) => (
          <View key={section.title} className="mb-5">
            <Text className="mb-1 font-poppins-semibold text-subtitle text-ink-900">
              {section.title}
            </Text>
            <Text className="font-poppins text-body leading-6 text-ink-700">
              {section.body}
            </Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
