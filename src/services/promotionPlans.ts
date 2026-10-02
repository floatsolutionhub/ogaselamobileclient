// Ogasela.Api/Controllers/Promotions/PromotionPlansController.cs - GET route only (create/update are SuperAdmin-only).
import { api } from "@/lib/apiClient";
import type { PromotionPlan } from "@/types/api";

/** Includes inactive plans - filter on isActive client-side before showing plan-choice UI. */
export function getPromotionPlans(): Promise<PromotionPlan[]> {
  return api.get<PromotionPlan[]>("/promotion-plans");
}
