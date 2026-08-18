"use client";

import { useState } from "react";
import { CheckCheck, Bell } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NotificationItem } from "@/components/modules/notifications/notification-item";
import {
  useDeleteNotification,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "@/hooks/queries/use-notifications";
import { getApiErrorMessage } from "@/lib/api/client";

export default function NotificationsPage() {
  const { data: notifications, isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const deleteNotification = useDeleteNotification();

  const [tab, setTab] = useState<"all" | "unread">("all");

  const all = notifications ?? [];
  const unread = all.filter((n) => !n.is_read);
  const visible = tab === "unread" ? unread : all;

  const handleMarkAllRead = async () => {
    if (unread.length === 0) return;
    try {
      await markAllRead.mutateAsync(unread.map((n) => n.notification_id));
      toast.success("All notifications marked as read");
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNotification.mutateAsync(id);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description={unread.length > 0 ? `${unread.length} unread` : "You're all caught up"}
        actions={
          <Button variant="outline" onClick={handleMarkAllRead} disabled={unread.length === 0 || markAllRead.isPending}>
            <CheckCheck className="h-4 w-4" />
            Mark all as read
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as "all" | "unread")}>
        <TabsList>
          <TabsTrigger value="all">All ({all.length})</TabsTrigger>
          <TabsTrigger value="unread">Unread ({unread.length})</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        {isLoading ? (
          <CardContent className="space-y-3 p-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </CardContent>
        ) : visible.length === 0 ? (
          <CardContent className="p-5">
            <EmptyState
              icon={Bell}
              title={tab === "unread" ? "No unread notifications" : "No notifications yet"}
              description={
                tab === "unread"
                  ? "You're all caught up."
                  : "You'll see updates about your projects and tasks here."
              }
            />
          </CardContent>
        ) : (
          <CardContent className="space-y-1 p-3">
            {visible.map((notification) => (
              <NotificationItem
                key={notification.notification_id}
                notification={notification}
                onMarkRead={(id) => markRead.mutate(id)}
                onDelete={handleDelete}
              />
            ))}
          </CardContent>
        )}
      </Card>
    </div>
  );
}