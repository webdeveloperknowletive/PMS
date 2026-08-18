"use client";

import { useQuery } from "@tanstack/react-query";
import { usersApi } from "@/lib/api/users";
import type { ListParams } from "@/types/common";

const KEY = "users";

export function useUsers(params?: ListParams) {
  return useQuery({
    queryKey: [KEY, params],
    queryFn: () => usersApi.list(params ?? { limit: 200 }),
  });
}

export function useUser(userId: string | undefined) {
  return useQuery({
    queryKey: [KEY, userId],
    queryFn: () => usersApi.get(userId as string),
    enabled: !!userId,
  });
}
