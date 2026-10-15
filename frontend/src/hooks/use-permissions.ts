"use client";

import { useQuery } from "@tanstack/react-query";
import { rolesApi } from "@/lib/api/roles";
import { useAuthStore } from "@/store/auth-store";
import { getCapabilities, type Capabilities } from "@/lib/permissions";

export function usePermissions(): Capabilities & { roleNames: string[]; permissionCodes: string[]; isLoading: boolean } {
  const user = useAuthStore((s) => s.user);

  const { data: permissionCodes, isLoading } = useQuery({
    queryKey: ["current-user-permissions", user?.user_id],
    queryFn: () => rolesApi.getMyPermissions(),
    enabled: !!user,
  });
  return { ...getCapabilities(permissionCodes ?? []), permissionCodes: permissionCodes ?? [], roleNames: user?.role_names ?? [], isLoading };
}
