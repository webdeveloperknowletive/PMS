"use client";

import { useQuery } from "@tanstack/react-query";
import { rolesApi } from "@/lib/api/roles";
import { useAuthStore } from "@/store/auth-store";
import { useRoles } from "@/hooks/queries/use-roles";
import { isAdminRoleName } from "@/lib/permissions";

export function useIsAdmin() {
  const user = useAuthStore((s) => s.user);
  const { data: roles } = useRoles(); // full Role list — {role_id, role_name, ...}

  const { data: myAssignments, isLoading } = useQuery({
    queryKey: ["current-user-roles", user?.user_id],
    queryFn: () => rolesApi.getUserRoles(user!.user_id), // {role_id, ...}[] — no role_name
    enabled: !!user,
  });

  const roleNameById = new Map((roles ?? []).map((r) => [r.role_id, r.role_name]));
  const isAdmin = (myAssignments ?? []).some((a) => {
    const name = roleNameById.get(a.role_id);
    return name ? isAdminRoleName(name) : false;
  });

  return { isAdmin, isLoading: isLoading || !roles };
}