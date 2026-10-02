// Ogasela.Api/Controllers/Promotions/CategoriesController.cs - GET route only (create/update are SuperAdmin-only).
import { api } from "@/lib/apiClient";
import type { Category } from "@/types/api";

/** Flat list, not a tree - build parent/child structure client-side from parentCategoryId. */
export function getCategories(): Promise<Category[]> {
  return api.get<Category[]>("/categories");
}
