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
    body: "Ogasela is a marketplace that connects buyers and sellers directly. We do not own, inspect, or guarantee any item listed, and we are not a party to any transaction between users - except an Office Pickup order (section 5). Buyers and sellers are solely responsible for verifying each other and the condition of items before exchanging money or goods.",
  },
  {
    title: "5. Office Pickup",
    body: "On ads in categories we select, a buyer can pay Ogasela for the item, have the seller drop it at an Ogasela branch, and collect it there (or have it delivered, where available) after we inspect it. An Office Pickup fee of 3% of the item's displayed price is added to that price and shown before you pay; a receipt is emailed to the address on your account, and we notify you in the app at each stage. Our inspection checks that the item matches its ad; it is not a warranty. If the item fails inspection, or you decide not to go ahead before collecting it or before it is sent out for delivery, you are refunded what you paid less a processing and cancellation fee of 1% of the item's price, to your original payment method. Sellers who receive an Office Pickup request agree to drop the item at the chosen branch promptly, and to collect it if it fails inspection or the order is cancelled.",
  },
  {
    title: "6. Prohibited Listings",
    body: "You may not post listings for illegal items, counterfeit goods, stolen property, or anything that violates applicable law or Ogasela's posting guidelines. We may remove any listing or account at our discretion.",
  },
  {
    title: "7. Changes to These Terms",
    body: "We may update these Terms from time to time. Continued use of the app after changes take effect constitutes acceptance of the revised Terms.",
  },
];

export default function TermsScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="flex-1 px-6 pt-4" contentContainerStyle={{ paddingBottom: 40 }}>
        <Text className="mt-1 mb-6 font-poppins text-caption text-ink-500">
          Last updated: October 2026
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
