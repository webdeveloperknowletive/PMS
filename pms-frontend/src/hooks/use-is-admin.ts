"use client";

import { usePermissions } from "@/hooks/use-permissions";

export function useIsAdmin() {
  const { isAdmin, isLoading } = usePermissions();
  return { isAdmin, isLoading };
}