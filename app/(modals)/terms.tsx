import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const SECTIONS = [
  {
    title: "1. Acceptance of Terms",
    body: "By creating an Ogasela account or using any of our services, you agree to be bound by these Terms of Service. If you do not agree, please do not use the app.",
  },
  {
    title: "2. Eligibility",
    body: "You must be at least 18 years old and able to form a legally binding contract to use Ogasela. You are responsible for the accuracy of the information you provide during registration.",
  },
  {
    title: "3. Account Security",
    body: "You are responsible for maintaining the confidentiality of your login credentials and for all activity under your account. Notify us immediately of any unauthorized use.",
  },
  {
    title: "4. Listings and Transactions",
    body: "Ogasela is a marketplace that connects buyers and sellers directly. We do not own, inspect, or guarantee any item listed, and we are not a party to any transaction between users. Buyers and sellers are solely responsible for verifying each other and the condition of items before exchanging money or goods.",
  },
  {
    title: "5. Prohibited Listings",
    body: "You may not post listings for illegal items, counterfeit goods, stolen property, or anything that violates applicable law or Ogasela's posting guidelines. We may remove any listing or account at our discretion.",
  },
  {
    title: "6. Changes to These Terms",
    body: "We may update these Terms from time to time. Continued use of the app after changes take effect constitutes acceptance of the revised Terms.",
  },
];

export default function TermsScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="flex-1 px-6 pt-4" contentContainerStyle={{ paddingBottom: 40 }}>
        <Text className="mt-1 mb-6 font-poppins text-xs text-ink-500">
          Last updated: September 2026
        </Text>

        {SECTIONS.map((section) => (
          <View key={section.title} className="mb-5">
            <Text className="mb-1 font-poppins-semibold text-base text-ink-900">
              {section.title}
            </Text>
            <Text className="font-poppins text-sm leading-6 text-ink-700">
              {section.body}
            </Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
