"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationsApi } from "@/lib/api/notifications";
import { useAuthStore } from "@/store/auth-store";
import type { Notification } from "@/types/notification";

/**
 * Shared query key across the header bell and the /notifications page so
 * both read from (and invalidate) the exact same cache entry.
 */
export const NOTIFICATIONS_KEY = "notifications";

/**
 * GET /notifications has NO server-side user filter — it returns every
 * user's rows. The `select` below is mandatory: without it this hook would
 * mix every user's notifications together.
 */
export function useNotifications() {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: [NOTIFICATIONS_KEY, user?.user_id],
    queryFn: () => notificationsApi.list({ limit: 500 }),
    enabled: !!user,
    select: (data) => data.filter((n) => n.user_id === user?.user_id),
  });
}

/** Toggles read/unread — pass the target state explicitly rather than assuming "mark read". */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  return useMutation({
    mutationFn: ({ id, is_read }: { id: string; is_read: boolean }) => notificationsApi.update(id, { is_read }),
    // Optimistic update so the badge/list feel instant instead of waiting on a refetch.
    onMutate: async ({ id, is_read }) => {
      const key = [NOTIFICATIONS_KEY, user?.user_id];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Notification[]>(key);
      queryClient.setQueryData<Notification[]>(key, (old) =>
        old?.map((n) => (n.notification_id === id ? { ...n, is_read } : n))
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData([NOTIFICATIONS_KEY, user?.user_id], context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_KEY, user?.user_id] }),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  return useMutation({
    mutationFn: async (unreadIds: string[]) => {
      await Promise.all(unreadIds.map((id) => notificationsApi.update(id, { is_read: true })));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_KEY, user?.user_id] }),
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  return useMutation({
    mutationFn: (notificationId: string) => notificationsApi.remove(notificationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_KEY, user?.user_id] }),
  });
}