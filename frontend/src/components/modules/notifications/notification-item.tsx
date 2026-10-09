
"use client";

import { Bell, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { Notification } from "@/types/notification";

export function NotificationItem({
  notification,
  onMarkRead,
  onDelete,
}: {
  notification: Notification;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const unread = !notification.is_read;

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border border-transparent px-3 py-3 transition-colors hover:border-border",
        unread && "bg-primary/5"
      )}
      onClick={() => unread && onMarkRead(notification.notification_id)}
      role="button"
    >
      <div
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          unread ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
        )}
      >
        <Bell className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className={cn("text-sm", unread ? "font-semibold text-foreground" : "text-foreground")}>
            {notification.title}
          </p>
          {unread && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">{notification.message}</p>
        <p className="mt-1 text-xs text-muted-foreground">{formatRelativeTime(notification.sent_at)}</p>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="shrink-0 text-muted-foreground hover:text-destructive"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(notification.notification_id);
        }}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}