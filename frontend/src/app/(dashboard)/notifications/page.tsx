"use client";

import { useMemo, useState } from "react";
import { Bell, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useDeleteNotification,
  useMarkNotificationRead,
  useNotifications,
} from "@/hooks/queries/use-notifications";
import { getApiErrorMessage } from "@/lib/api/client";
import type { Notification } from "@/types/notification";

function groupByDay(notifications: Notification[]) {
  const groups: { label: string; items: Notification[] }[] = [];
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86_400_000).toDateString();

  const buckets = new Map<string, Notification[]>();
  for (const n of notifications) {
    const d = new Date(n.sent_at);
    let label: string;
    if (d.toDateString() === today) label = "Today";
    else if (d.toDateString() === yesterday) label = "Yesterday";
    else label = d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

    if (!buckets.has(label)) buckets.set(label, []);
    buckets.get(label)!.push(n);
  }
  for (const [label, items] of buckets) groups.push({ label, items });
  return groups;
}

export default function NotificationsPage() {
  const { data: notifications, isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const deleteMutation = useDeleteNotification();

  const [tab, setTab] = useState<"all" | "unread" | "read">("all");

  const sorted = useMemo(
    () => [...(notifications ?? [])].sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()),
    [notifications]
  );
  const filtered = tab === "unread" ? sorted.filter((n) => !n.is_read) : tab === "read" ? sorted.filter((n) => n.is_read) : sorted;
  const grouped = useMemo(() => groupByDay(filtered), [filtered]);

  const total = notifications?.length ?? 0;
  const unread = notifications?.filter((n) => !n.is_read).length ?? 0;
  const showNotificationResults = (selectedTab: typeof tab) => {
    setTab(selectedTab);
    requestAnimationFrame(() => document.getElementById("notification-results")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const handleToggleRead = async (n: Notification) => {
    try {
      await markRead.mutateAsync({ id: n.notification_id, is_read: !n.is_read });
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const handleMarkAllRead = async () => {
    const unreadOnes = (notifications ?? []).filter((n) => !n.is_read);
    if (unreadOnes.length === 0) return;
    try {
      await Promise.all(unreadOnes.map((n) => markRead.mutateAsync({ id: n.notification_id, is_read: true })));
      toast.success("All notifications marked as read");
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const handleDelete = async (n: Notification) => {
    try {
      await deleteMutation.mutateAsync(n.notification_id);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Stay updated with all important activities and updates"
        actions={
          <Button variant="outline" onClick={handleMarkAllRead} disabled={unread === 0}>
            <Check className="h-4 w-4" />
            Mark all as read
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <button type="button" onClick={() => showNotificationResults("all")} className="metric-card rounded-2xl border border-border bg-card text-left transition hover:border-violet-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
          <div className="p-4">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="mt-1 text-2xl font-semibold">{total}</p>
          </div>
        </button>
        <button type="button" onClick={() => showNotificationResults("unread")} className="metric-card rounded-2xl border border-border bg-card text-left transition hover:border-violet-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
          <div className="p-4">
            <p className="text-xs text-muted-foreground">Unread</p>
            <p className="mt-1 text-2xl font-semibold text-primary">{unread}</p>
          </div>
        </button>
        <button type="button" onClick={() => showNotificationResults("read")} className="metric-card rounded-2xl border border-border bg-card text-left transition hover:border-violet-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
          <div className="p-4">
            <p className="text-xs text-muted-foreground">Read</p>
            <p className="mt-1 text-2xl font-semibold text-muted-foreground">{total - unread}</p>
          </div>
        </button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">Unread {unread > 0 && `(${unread})`}</TabsTrigger>
          <TabsTrigger value="read">Read</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card id="notification-results" className="scroll-mt-6">
        {isLoading ? (
          <CardContent className="space-y-3 p-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </CardContent>
        ) : filtered.length === 0 ? (
          <CardContent className="p-5">
            <EmptyState
              icon={Bell}
              title={tab === "unread" ? "No unread notifications" : "No notifications yet"}
              description="You're all caught up."
            />
          </CardContent>
        ) : (
          <div className="divide-y divide-border">
            {grouped.map((group) => (
              <div key={group.label}>
                <p className="bg-muted/40 px-5 py-2 text-xs font-semibold text-muted-foreground">{group.label}</p>
                {group.items.map((n) => (
                  <div
                    key={n.notification_id}
                    className={`flex items-start justify-between gap-3 px-5 py-3 hover:bg-muted/30 ${
                      !n.is_read ? "bg-accent/30" : ""
                    }`}
                  >
                    <button className="flex flex-1 items-start gap-3 text-left" onClick={() => handleToggleRead(n)}>
                      <span
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${!n.is_read ? "bg-primary" : "bg-transparent"}`}
                      />
                      <div>
                        <p className={`text-sm ${!n.is_read ? "font-semibold text-foreground" : "font-medium text-foreground"}`}>
                          {n.title}
                        </p>
                        <p className="mt-0.5 text-sm text-muted-foreground">{n.message}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(n.sent_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} ·{" "}
                          {n.notification_type}
                        </p>
                      </div>
                    </button>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button variant="outline" size="icon" className="h-8 w-8" aria-label={`Mark notification ${n.is_read ? "unread" : "read"}`} title={`Mark ${n.is_read ? "unread" : "read"}`} onClick={() => handleToggleRead(n)}><Check className="h-4 w-4" /></Button>
                      <Button variant="outline" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" aria-label="Delete notification" title="Delete notification" onClick={() => handleDelete(n)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
