import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";

import { useAuth } from "@/context/AuthContext";

/**
 * Safety net for tab screens that require auth: the tabPress listener in
 * (app)/_layout.tsx blocks navigation for guests, but this catches the edge
 * case where a user is auto-logged-out (inactivity) while already sitting on
 * a protected tab.
 */
export function useProtectedRoute(redirect: string) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      if (!isLoading && !isAuthenticated) {
        router.replace("/(app)/home");
        router.push({ pathname: "/(modals)/sign-in", params: { redirect } });
      }
    }, [isLoading, isAuthenticated, redirect, router])
  );
}
