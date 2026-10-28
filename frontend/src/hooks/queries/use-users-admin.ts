"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usersApi } from "@/lib/api/users";
import type { UserCreate, UserUpdate } from "@/types/user";

const KEY = "users";

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UserCreate) => usersApi.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateUserProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: UserUpdate }) => usersApi.updateProfile(userId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useToggleUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, is_active }: { userId: string; is_active: boolean }) => usersApi.updateStatus(userId, is_active),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => usersApi.remove(userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUserPermissionCatalog(enabled = true) {
  return useQuery({
    queryKey: ["user-permission-catalog"],
    queryFn: () => usersApi.getPermissionCatalog(),
    enabled,
  });
}

export function useUserPermissions(userId?: string, enabled = true) {
  return useQuery({
    queryKey: ["user-permissions", userId],
    queryFn: () => usersApi.getPermissions(userId!),
    enabled: !!userId && enabled,
  });
}

export function useSetUserPermissions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, permissionIds }: { userId: string; permissionIds: string[] }) =>
      usersApi.setPermissions(userId, permissionIds),
    onSuccess: async (permissions, variables) => {
      queryClient.setQueryData(["user-permissions", variables.userId], permissions);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["user-permissions", variables.userId] }),
        queryClient.invalidateQueries({ queryKey: ["current-user-permissions"] }),
      ]);
    },
  });
}
