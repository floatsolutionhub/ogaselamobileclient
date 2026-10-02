import {
  Baby,
  Briefcase,
  Building2,
  Car,
  HeartPulse,
  Shirt,
  Smartphone,
  Sofa,
  Tv,
  Wrench,
} from "lucide-react-native";

import { Category } from "@/types/listing";

export const categories: Category[] = [
  {
    id: "phones-tablets",
    label: "Phones & Tablets",
    icon: Smartphone,
    subcategories: [
      { id: "mobile-phones", label: "Mobile Phones" },
      { id: "tablets", label: "Tablets" },
      { id: "phone-accessories", label: "Accessories" },
      { id: "smart-watches", label: "Smart Watches" },
    ],
  },
  {
    id: "electronics",
    label: "Electronics",
    icon: Tv,
    subcategories: [
      { id: "tvs", label: "TVs" },
      { id: "audio-music", label: "Audio & Music" },
      { id: "computers-laptops", label: "Computers & Laptops" },
      { id: "home-appliances", label: "Home Appliances" },
      { id: "cameras", label: "Cameras" },
    ],
  },
  {
    id: "vehicles",
    label: "Vehicles",
    icon: Car,
    subcategories: [
      { id: "cars", label: "Cars" },
      { id: "buses-microbuses", label: "Buses & Microbuses" },
      { id: "motorcycles-scooters", label: "Motorcycles & Scooters" },
      { id: "tricycles", label: "Tricycles" },
      { id: "vehicle-parts", label: "Vehicle Parts & Accessories" },
    ],
  },
  {
    id: "property",
    label: "Property",
    icon: Building2,
    subcategories: [
      { id: "houses-apartments-rent", label: "Houses & Apartments for Rent" },
      { id: "houses-apartments-sale", label: "Houses & Apartments for Sale" },
      { id: "land-plots", label: "Land & Plots" },
      { id: "commercial-property", label: "Commercial Property" },
      { id: "short-let", label: "Short-let" },
    ],
  },
  {
    id: "fashion",
    label: "Fashion",
    icon: Shirt,
    subcategories: [
      { id: "womens-clothing", label: "Women's Clothing" },
      { id: "mens-clothing", label: "Men's Clothing" },
      { id: "shoes", label: "Shoes" },
      { id: "bags", label: "Bags" },
      { id: "jewelry-watches", label: "Jewelry & Watches" },
    ],
  },
  {
    id: "home-furniture",
    label: "Home & Furniture",
    icon: Sofa,
    subcategories: [
      { id: "furniture", label: "Furniture" },
      { id: "home-accessories", label: "Home Accessories" },
      { id: "kitchen-dining", label: "Kitchen & Dining" },
      { id: "beddings", label: "Beddings" },
    ],
  },
  {
    id: "health-beauty",
    label: "Health & Beauty",
    icon: HeartPulse,
    subcategories: [
      { id: "skin-care", label: "Skin Care" },
      { id: "makeup", label: "Makeup" },
      { id: "hair", label: "Hair" },
      { id: "fitness-nutrition", label: "Fitness & Nutrition" },
      { id: "perfumes-fragrances", label: "Perfumes & Fragrances" },
    ],
  },
  {
    id: "jobs",
    label: "Jobs",
    icon: Briefcase,
    subcategories: [
      { id: "sales-marketing", label: "Sales & Marketing" },
      { id: "customer-service", label: "Customer Service" },
      { id: "driving-delivery", label: "Driving & Delivery" },
      { id: "domestic-staff", label: "Domestic Staff" },
      { id: "it-tech", label: "IT & Tech" },
    ],
  },
  {
    id: "services",
    label: "Services",
    icon: Wrench,
    subcategories: [
      { id: "repair-services", label: "Repair Services" },
      { id: "home-services", label: "Home Services" },
      { id: "event-services", label: "Event Services" },
      { id: "automotive-services", label: "Automotive Services" },
      { id: "beauty-services", label: "Beauty Services" },
    ],
  },
  {
    id: "babies-kids",
    label: "Babies & Kids",
    icon: Baby,
    subcategories: [
      { id: "baby-clothing", label: "Baby Clothing" },
      { id: "toys", label: "Toys" },
      { id: "strollers-car-seats", label: "Strollers & Car Seats" },
      { id: "nursery-furniture", label: "Nursery Furniture" },
      { id: "feeding-nursing", label: "Feeding & Nursing" },
    ],
  },
];

export function getCategoryById(id: string | undefined): Category | undefined {
  return categories.find((category) => category.id === id);
}

export function getSubcategoryById(category: Category | undefined, id: string | undefined) {
  return category?.subcategories.find((subcategory) => subcategory.id === id);
}
