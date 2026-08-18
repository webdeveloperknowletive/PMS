"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationsApi } from "@/lib/api/notifications";
import { useAuthStore } from "@/store/auth-store";
import type { Notification } from "@/types/notification";

/**
 * Shared query key across the header bell and the /notifications page so
 * both read from (and invalidate) the same cache entry.
 */
export const NOTIFICATIONS_KEY = "notifications";

export function useNotifications() {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: [NOTIFICATIONS_KEY, user?.user_id],
    queryFn: () => notificationsApi.list({ limit: 100 }),
    enabled: !!user,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  return useMutation({
    mutationFn: (notificationId: string) => notificationsApi.update(notificationId, { is_read: true }),
    // Optimistic update so the badge/list feel instant instead of waiting on a refetch.
    onMutate: async (notificationId) => {
      const key = [NOTIFICATIONS_KEY, user?.user_id];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Notification[]>(key);
      queryClient.setQueryData<Notification[]>(key, (old) =>
        old?.map((n) => (n.notification_id === notificationId ? { ...n, is_read: true } : n))
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
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