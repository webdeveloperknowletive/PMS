"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { rolesApi } from "@/lib/api/roles";
import type { RoleCreate, RoleUpdate, UserRoleCreate } from "@/types/role";

const ROLES_KEY = "roles";
const ASSIGNMENTS_KEY = "role-assignments";

export function useRoles(enabled = true) {
  return useQuery({
    queryKey: [ROLES_KEY],
    queryFn: () => rolesApi.list({ limit: 200 }),
    enabled,
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

/** One bounded backend query returns user assignments for role administration. */
export function useAllRoleAssignments(enabled = true) {
  return useQuery({
    queryKey: [ASSIGNMENTS_KEY],
    queryFn: () => rolesApi.getAllRoleAssignments(),
    enabled,
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

export function usePermissionCatalog(enabled = true) {
  return useQuery({ queryKey: ["permission-catalog"], queryFn: () => rolesApi.getPermissions(), enabled });
}

export function useRolePermissions(roleId?: string, enabled = true) {
  return useQuery({
    queryKey: ["role-permissions", roleId],
    queryFn: () => rolesApi.getRolePermissions(roleId!),
    enabled: !!roleId && enabled,
  });
}

export function useSetRolePermissions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, permissionIds }: { roleId: string; permissionIds: string[] }) => rolesApi.setRolePermissions(roleId, permissionIds),
    onSuccess: async (permissions, variables) => {
      queryClient.setQueryData(["role-permissions", variables.roleId], permissions);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["role-permissions", variables.roleId] }),
        queryClient.invalidateQueries({ queryKey: ["current-user-permissions"] }),
        queryClient.invalidateQueries({ queryKey: [ROLES_KEY] }),
      ]);
    },
  });
}
