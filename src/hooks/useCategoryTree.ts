import { useEffect, useMemo, useState } from "react";

import { getCategories } from "@/services/categories";
import type { Category } from "@/types/api";

export type CategoryNode = Category & { children: Category[] };

/**
 * Fetches the real flat category list and builds a two-level tree client-side:
 * top-level categories (parentCategoryId === null), each with a `children` array
 * of categories whose parentCategoryId matches it. The backend has no deeper nesting.
 */
export function useCategoryTree() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    getCategories()
      .then((data) => {
        if (active) setCategories(data);
      })
      .catch(() => {
        if (active) setCategories([]);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const tree = useMemo<CategoryNode[]>(() => {
    const topLevel = categories.filter((category) => category.parentCategoryId === null);
    return topLevel.map((category) => ({
      ...category,
      children: categories.filter((child) => child.parentCategoryId === category.id),
    }));
  }, [categories]);

  return { categories, tree, isLoading };
}
