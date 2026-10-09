"use client";

import { useMemo } from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/shared/user-avatar";
import type { GanttTask } from "@/types/gantt";
import type { Task } from "@/types/task";
import type { User } from "@/types/user";

const DAY_WIDTH = 28; // px per day at 100% zoom
const ROW_HEIGHT = 44;

const BAR_COLOR_BY_STATUS: Record<string, string> = {
  TODO: "#94A3B8",
  IN_PROGRESS: "#3B82F6",
  IN_REVIEW: "#F59E0B",
  DONE: "#22C55E",
  BLOCKED: "#EF4444",
  CANCELLED: "#CBD5E1",
};

function toDate(iso: string) {
  return new Date(iso + "T00:00:00");
}
function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}
function startOfWeek(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday-start weeks
  date.setDate(date.getDate() + diff);
  return date;
}
function formatScheduleDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function GanttChart({
  entries,
  taskMap,
  userMap,
  onEdit,
  onDelete,
}: {
  entries: GanttTask[];
  taskMap: Map<string, Task>;
  userMap: Map<string, User>;
  onEdit?: (entry: GanttTask) => void;
  onDelete?: (entry: GanttTask) => void;
}) {
  const sorted = useMemo(
    () => [...entries].sort((a, b) => toDate(a.start_date).getTime() - toDate(b.start_date).getTime()),
    [entries]
  );

  const { rangeStart, weeks, totalDays } = useMemo(() => {
    if (sorted.length === 0) {
      const today = new Date();
      const start = startOfWeek(today);
      return { rangeStart: start, weeks: 8, totalDays: 56 };
    }
    const earliest = sorted.reduce((min, e) => (toDate(e.start_date) < min ? toDate(e.start_date) : min), toDate(sorted[0].start_date));
    const latest = sorted.reduce((max, e) => (toDate(e.end_date) > max ? toDate(e.end_date) : max), toDate(sorted[0].end_date));
    const start = startOfWeek(earliest);
    // pad 1 week on each side so bars don't touch the edges
    const paddedStart = new Date(start);
    paddedStart.setDate(paddedStart.getDate() - 7);
    const days = Math.max(56, daysBetween(paddedStart, latest) + 14);
    return { rangeStart: paddedStart, weeks: Math.ceil(days / 7), totalDays: days };
  }, [sorted]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayOffset = daysBetween(rangeStart, today);
  const showTodayLine = todayOffset >= 0 && todayOffset <= totalDays;

  const weekLabels = Array.from({ length: weeks }, (_, i) => {
    const weekStart = new Date(rangeStart);
    weekStart.setDate(weekStart.getDate() + i * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    return { start: weekStart, end: weekEnd };
  });

  return (
    <div className="flex overflow-hidden rounded-xl border border-border bg-card">
      {/* Fixed left column: task list */}
      <div className="w-72 shrink-0 border-r border-border">
        <div className="flex h-14 items-center border-b border-border px-4 text-xs font-semibold text-muted-foreground">
          Task
        </div>
        {sorted.map((entry) => {
          const task = taskMap.get(entry.task_id);
          return (
            <div
              key={entry.gantt_id}
              className="flex items-center justify-between border-b border-border px-4"
              style={{ height: ROW_HEIGHT }}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{task?.task_name ?? "Unknown task"}</p>
                <p className="text-xs text-muted-foreground">
                  {formatScheduleDate(entry.start_date)} – {formatScheduleDate(entry.end_date)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <UserAvatar user={task?.user_id ? userMap.get(task.user_id) : null} showName={false} size="sm" />
                {(onEdit || onDelete) && <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {onEdit && <DropdownMenuItem onClick={() => onEdit(entry)}>
                      <Pencil />
                      Edit
                    </DropdownMenuItem>}
                    {onDelete && <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(entry)}>
                      <Trash2 />
                      Remove
                    </DropdownMenuItem>}
                  </DropdownMenuContent>
                </DropdownMenu>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Scrollable timeline */}
      <div className="flex-1 overflow-x-auto scrollbar-thin">
        <div style={{ width: totalDays * DAY_WIDTH, position: "relative" }}>
          {/* Week header */}
          <div className="flex h-14 border-b border-border">
            {weekLabels.map((w, i) => (
              <div
                key={i}
                className="shrink-0 border-r border-border px-2 py-2 text-xs text-muted-foreground"
                style={{ width: DAY_WIDTH * 7 }}
              >
                <p className="font-medium text-foreground">
                  {w.start.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </p>
                <p>{w.end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
              </div>
            ))}
          </div>

          {/* Today marker */}
          {showTodayLine && (
            <div
              className="pointer-events-none absolute bottom-0 top-14 z-10 w-px bg-primary"
              style={{ left: todayOffset * DAY_WIDTH }}
            >
              <span className="absolute -left-4 -top-5 rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                Today
              </span>
            </div>
          )}

          {/* Rows + bars */}
          {sorted.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              No tasks scheduled yet
            </div>
          ) : (
            sorted.map((entry) => {
              const left = daysBetween(rangeStart, toDate(entry.start_date)) * DAY_WIDTH;
              const width = Math.max(DAY_WIDTH, (daysBetween(toDate(entry.start_date), toDate(entry.end_date)) + 1) * DAY_WIDTH);
              const task = taskMap.get(entry.task_id);
              const color = BAR_COLOR_BY_STATUS[task?.status ?? "TODO"];
              const progress = Number(entry.progress || 0); // backend may send NUMERIC as a string
              const labelFitsInside = width >= 90; // roughly enough room for a short task name

              return (
                <div key={entry.gantt_id} className="relative border-b border-border" style={{ height: ROW_HEIGHT }}>
                  <div
                    className="absolute top-1/2 -translate-y-1/2 rounded-md shadow-sm"
                    style={{ left, width, height: 26, backgroundColor: `${color}33` }}
                    title={`${task?.task_name ?? ""}: ${formatScheduleDate(entry.start_date)} – ${formatScheduleDate(entry.end_date)} · ${progress}% complete`}
                  >
                    <div className="h-full overflow-hidden rounded-md" style={{ width: `${progress}%`, backgroundColor: color }} />
                    {labelFitsInside ? (
                      <span className="pointer-events-none absolute inset-0 flex items-center overflow-hidden text-ellipsis whitespace-nowrap px-2 text-[11px] font-medium text-white">
                        {task?.task_name}
                      </span>
                    ) : (
                      <span className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap text-[11px] font-medium text-foreground">
                        {task?.task_name}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
