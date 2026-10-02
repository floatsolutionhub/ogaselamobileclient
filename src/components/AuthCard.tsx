import { View } from "react-native";

type AuthCardProps = {
  children: React.ReactNode;
  className?: string;
};

export function AuthCard({ children, className = "" }: AuthCardProps) {
  return (
    <View
      className={`rounded-3xl bg-white p-6 shadow-lg shadow-brand-500/10 border border-brand-50 ${className}`}
    >
      {children}
    </View>
  );
}
