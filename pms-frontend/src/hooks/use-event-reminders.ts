"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useCalendarEvents } from "@/hooks/queries/use-calendar";
import { useAuthStore } from "@/store/auth-store";
import { notificationsApi } from "@/lib/api/notifications";
import { formatTime } from "@/lib/utils";

const REMINDER_LEAD_MINUTES = 60;
const POLL_INTERVAL_MS = 60_000; // check once a minute
const STORAGE_KEY = "pms_reminded_events_v1";

function loadRemindedKeys(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveRemindedKeys(keys: Set<string>) {
  // Cap stored size so this doesn't grow forever across months of use.
  const arr = Array.from(keys).slice(-500);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

/**
 * In-app only reminder: fires while this browser tab has the app open.
 * There's no backend scheduler (no Celery/APScheduler etc. in requirements.txt),
 * so this intentionally does NOT persist across the user closing the app —
 * that would need a real backend job. Only reminds for events the current
 * user organizes, since calendar_events has no attendee/invitee list — the
 * only per-user linkage available is the `organizer` field.
 */
export function useEventReminders() {
  const user = useAuthStore((s) => s.user);
  const { data: events } = useCalendarEvents();
  const queryClient = useQueryClient();
  const remindedRef = useRef<Set<string>>(loadRemindedKeys());

  useEffect(() => {
    if (!user) return;

    const checkReminders = async () => {
      const now = new Date();
      const windowEnd = new Date(now.getTime() + REMINDER_LEAD_MINUTES * 60_000);

      const due = (events ?? []).filter((e) => {
        if (e.organizer !== user.user_id) return false;
        const start = new Date(e.start_datetime);
        // Key includes start_datetime so an edited/rescheduled event reminds again.
        const key = `${e.event_id}:${e.start_datetime}`;
        if (remindedRef.current.has(key)) return false;
        return start > now && start <= windowEnd;
      });

      for (const event of due) {
        const key = `${event.event_id}:${event.start_datetime}`;
        remindedRef.current.add(key);

        toast.info(`Upcoming: ${event.title}`, {
          description: `Starts at ${formatTime(event.start_datetime)}${event.location ? ` · ${event.location}` : ""}`,
          duration: 10_000,
        });

        // Also persist a real notification row so it shows up in the bell/Notifications page.
        try {
          await notificationsApi.create({
            user_id: user.user_id,
            project_id: event.project_id,
            title: `Upcoming: ${event.title}`,
            message: `Starts at ${formatTime(event.start_datetime)}${event.location ? ` at ${event.location}` : ""}.`,
            notification_type: "Reminder",
            is_read: false,
          });
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
        } catch {
          // Non-fatal — the toast already fired; don't block on notification persistence.
        }
      }

      if (due.length > 0) saveRemindedKeys(remindedRef.current);
    };

    checkReminders();
    const interval = setInterval(checkReminders, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [events, user, queryClient]);
}
