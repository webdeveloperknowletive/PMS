"use client";

import { useQuery } from "@tanstack/react-query";
import { rolesApi } from "@/lib/api/roles";
import { useAuthStore } from "@/store/auth-store";
import { useRoles } from "@/hooks/queries/use-roles";
import { getCapabilities, type Capabilities } from "@/lib/permissions";

export function usePermissions(): Capabilities & { roleNames: string[]; permissionCodes: string[]; isLoading: boolean } {
  const user = useAuthStore((s) => s.user);
  const { data: allRoles } = useRoles();

  const { data: permissionCodes, isLoading } = useQuery({
    queryKey: ["current-user-permissions", user?.user_id],
    queryFn: () => rolesApi.getMyPermissions(),
    enabled: !!user,
  });
  const { data: myAssignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ["current-user-roles", user?.user_id],
    queryFn: () => rolesApi.getUserRoles(user!.user_id),
    enabled: !!user,
  });

  const roleNameById = new Map((allRoles ?? []).map((r) => [r.role_id, r.role_name]));
  const myRoleNames = (myAssignments ?? [])
    .map((a) => roleNameById.get(a.role_id))
    .filter((n): n is string => !!n);

  return { ...getCapabilities(permissionCodes ?? []), permissionCodes: permissionCodes ?? [], roleNames: myRoleNames, isLoading: isLoading || assignmentsLoading || !allRoles };
}
