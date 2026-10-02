import { Image } from "react-native";

type LogoProps = {
  size?: number;
};

export function Logo({ size = 64 }: LogoProps) {
  return (
    <Image
      source={require("../../assets/ogasela-icon.png")}
      style={{ width: size, height: size }}
      resizeMode="contain"
    />
  );
}
