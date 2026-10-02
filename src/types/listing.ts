import { LucideIcon } from "lucide-react-native";

export type Subcategory = {
  id: string;
  label: string;
};

export type Category = {
  id: string;
  label: string;
  icon: LucideIcon;
  subcategories: Subcategory[];
};

export type Listing = {
  id: string;
  title: string;
  price: number;
  currency: "NGN";
  categoryId: string;
  subcategoryId: string;
  location: string;
  latitude: number;
  longitude: number;
  image: string;
  postedAt: string;
  isRecommended?: boolean;
};
