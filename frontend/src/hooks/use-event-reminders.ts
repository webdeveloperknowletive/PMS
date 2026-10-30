"use client";

import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCalendarEvents } from "@/hooks/queries/use-calendar";
import { useAuthStore } from "@/store/auth-store";
import { notificationSettingsApi, notificationsApi } from "@/lib/api/notifications";
import { tasksApi } from "@/lib/api/tasks";
import { formatTime } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";

const POLL_INTERVAL_MS = 10_000;
const STORAGE_KEY = "pms_reminded_events_v1";

function loadRemindedKeys(userId: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${userId}`);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveRemindedKeys(userId: string, keys: Set<string>) {
  // Cap stored size so this doesn't grow forever across months of use.
  const arr = Array.from(keys).slice(-500);
  localStorage.setItem(`${STORAGE_KEY}_${userId}`, JSON.stringify(arr));
}

/**
 * In-app only reminder: fires while this browser tab has the app open.
 * There's no backend scheduler (no Celery/APScheduler etc. in requirements.txt),
 * so this intentionally does NOT persist across the user closing the app —
 * that would need a real backend job. Only reminds for events the current
 * user organizes, since calendar_events has no attendee/invitee list — the
 * only per-user linkage available is the `organizer` field.
 */
export function useEventReminders(enabled = true) {
  const user = useAuthStore((s) => s.user);
  const { permissionCodes } = usePermissions(enabled);
  const calendarAccess = permissionCodes.includes("modules.calendar.access") && permissionCodes.includes("calendar.view");
  const taskReminderAccess = permissionCodes.some((code) => [
    "tasks.view", "tasks.team_view", "tasks.manage", "tasks.update",
    "tasks.update_assigned", "kanban.view", "kanban.move", "roles.manage",
  ].includes(code));
  const canViewReminderSettings = permissionCodes.includes("modules.notifications.access") && permissionCodes.includes("notifications.settings.view");
  const { data: events } = useCalendarEvents(enabled && calendarAccess);
  const { data: reminderSetting } = useQuery({
    queryKey: ["meeting-reminder-setting"],
    queryFn: notificationSettingsApi.getMeetingReminder,
    enabled: enabled && !!user && calendarAccess && canViewReminderSettings,
    refetchInterval: 10_000,
  });
  const queryClient = useQueryClient();
  const remindedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled || !user) return;
    remindedRef.current = loadRemindedKeys(user.user_id);

    const checkReminders = async () => {
      const now = new Date();
      const windowEnd = new Date(now.getTime() + (reminderSetting?.lead_minutes ?? 60) * 60_000);

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

      if (due.length > 0) saveRemindedKeys(user.user_id, remindedRef.current);
    };

    checkReminders();
    const interval = setInterval(checkReminders, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [enabled, events, user, queryClient, reminderSetting]);

  useEffect(() => {
    if (!enabled || !user || !taskReminderAccess) return;
    let checking = false;
    const checkTaskReminders = async () => {
      if (checking) return;
      checking = true;
      const now = new Date();
      const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      try {
        const result = await tasksApi.checkDeadlineReminders(localDate);
        if (result.created_count > 0) {
          await queryClient.invalidateQueries({ queryKey: ["notifications"] });
        }
      } catch {
        // Reminders are best-effort while the user has the app open. The API
        // rechecks assignments and de-duplicates every delivery server-side.
      } finally {
        checking = false;
      }
    };

    void checkTaskReminders();
    const interval = setInterval(() => void checkTaskReminders(), 60_000);
    return () => clearInterval(interval);
  }, [enabled, user?.user_id, taskReminderAccess, queryClient]);
}
