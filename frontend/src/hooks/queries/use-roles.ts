"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { rolesApi } from "@/lib/api/roles";
import { useUsers } from "@/hooks/queries/use-users";
import type { RoleCreate, RoleUpdate, UserRoleCreate } from "@/types/role";

const ROLES_KEY = "roles";
const ASSIGNMENTS_KEY = "role-assignments";

export function useRoles() {
  return useQuery({
    queryKey: [ROLES_KEY],
    queryFn: () => rolesApi.list({ limit: 200 }),
  });
}

export function useCreateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: RoleCreate) => rolesApi.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [ROLES_KEY] }),
  });
}

export function useUpdateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: RoleUpdate }) => rolesApi.update(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [ROLES_KEY] }),
  });
}

export function useDeleteRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => rolesApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [ROLES_KEY] }),
  });
}

/**
 * The backend only exposes GET /roles/users/{user_id} — "roles for this
 * user" — there's no reverse "users for this role" endpoint. To know how
 * many users hold each role (or list them), we fetch every user's role
 * assignments in parallel and build both directions of the mapping
 * ourselves. Fine at the scale of dozens/low-hundreds of users; would need
 * a real backend aggregate endpoint if this app ever has thousands.
 */
export function useAllRoleAssignments() {
  const { data: users } = useUsers();
  return useQuery({
    queryKey: [ASSIGNMENTS_KEY, (users ?? []).map((u) => u.user_id).join(",")],
    queryFn: async () => {
      const results = await Promise.all(
        (users ?? []).map(async (u) => ({
          user: u,
          roles: await rolesApi.getUserRoles(u.user_id),
        }))
      );
      return results; // [{ user, roles: UserRole[] }, ...]
    },
    enabled: !!users && users.length > 0,
  });
}

export function useAssignRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: UserRoleCreate }) =>
      rolesApi.assignRole(userId, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [ASSIGNMENTS_KEY] }),
        queryClient.invalidateQueries({ queryKey: ["current-user-permissions"] }),
      ]);
    },
  });
}

export function useRemoveRoleAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) => rolesApi.removeRole(userId, roleId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [ASSIGNMENTS_KEY] }),
        queryClient.invalidateQueries({ queryKey: ["current-user-permissions"] }),
      ]);
    },
  });
}

export function usePermissionCatalog() {
  return useQuery({ queryKey: ["permission-catalog"], queryFn: () => rolesApi.getPermissions() });
}

export function useRolePermissions(roleId?: string) {
  return useQuery({
    queryKey: ["role-permissions", roleId],
    queryFn: () => rolesApi.getRolePermissions(roleId!),
    enabled: !!roleId,
  });
}

export function useSetRolePermissions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, permissionIds }: { roleId: string; permissionIds: string[] }) => rolesApi.setRolePermissions(roleId, permissionIds),
    onSuccess: async (_result, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["role-permissions", variables.roleId] }),
        queryClient.invalidateQueries({ queryKey: ["current-user-permissions"] }),
        queryClient.invalidateQueries({ queryKey: ["permission-catalog"] }),
      ]);
    },
  });
}
