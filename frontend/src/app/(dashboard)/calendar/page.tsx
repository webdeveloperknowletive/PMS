"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, UserRound, Building2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MonthGrid } from "@/components/modules/calendar/month-grid";
import { UpcomingEventsList } from "@/components/modules/calendar/upcoming-events-list";
import { EventFormDialog } from "@/components/modules/calendar/event-form-dialog";
import { useCalendarEvents } from "@/hooks/queries/use-calendar";
import { useProjects } from "@/hooks/queries/use-projects";
import { getEventTypeColor } from "@/lib/event-colors";
import { usePermissions } from "@/hooks/use-permissions";
import { useTasks } from "@/hooks/queries/use-tasks";
import { useAuthStore } from "@/store/auth-store";
import type { CalendarEvent } from "@/types/calendar";

const ALL = "__all__";
const LEGEND_TYPES = ["Meeting", "Project", "Deadline", "Milestone", "Review", "Planning", "Standup", "Work activity", "Holiday"];

export default function CalendarPage() {
  const [projectFilter, setProjectFilter] = useState(ALL);
  const [calendarScope, setCalendarScope] = useState<"PERSONAL" | "ORGANIZATION">("PERSONAL");
  const [viewDate, setViewDate] = useState(() => new Date());
  const { data: events, isLoading } = useCalendarEvents();
  const { data: projects } = useProjects();
  const { canCreateEvent, permissionCodes } = usePermissions();
  const currentUser = useAuthStore((state) => state.user);
  const isDeveloper = currentUser?.role_names?.some((role) => role.trim().toLowerCase() === "developer") ?? false;
  const canReadOwnTasks = ["tasks.view", "tasks.update", "tasks.update_assigned", "kanban.tasks.view", "kanban.tasks.move"].some((code) => permissionCodes.includes(code));
  const { data: tasks = [] } = useTasks({ limit: 500 }, isDeveloper && calendarScope === "PERSONAL" && canReadOwnTasks);
  const canManageEvents = permissionCodes.includes("calendar.manage");

  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [prefillDate, setPrefillDate] = useState<string | undefined>(undefined);

  const filteredEvents = useMemo(
    () => (events ?? []).filter((e) => e.calendar_scope === calendarScope && (projectFilter === ALL || e.project_id === projectFilter)),
    [events, projectFilter, calendarScope]
  );
  const assignedCalendarTasks = useMemo(
    () => tasks.filter((task) => task.user_id === currentUser?.user_id && !!task.due_date && (projectFilter === ALL || task.project_id === projectFilter)),
    [tasks, currentUser?.user_id, projectFilter],
  );

  const monthLabel = viewDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const goToday = () => setViewDate(new Date());
  const goPrev = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  const goNext = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));

  const openCreate = (date?: Date) => {
    setEditingEvent(null);
    setPrefillDate(date ? date.toISOString().slice(0, 10) : undefined);
    setFormOpen(true);
  };
  const openEdit = (event: CalendarEvent) => {
    setEditingEvent(event);
    setPrefillDate(undefined);
    setFormOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        description="Switch between your personal task calendar and shared organization calendar."
        actions={canCreateEvent ? (
          <Button onClick={() => openCreate()}>
            <Plus className="h-4 w-4" />
            Create Event
          </Button>
        ) : undefined}
      />

      <div className="inline-flex rounded-xl border bg-white p-1 shadow-sm" role="tablist" aria-label="Choose calendar">
        <button type="button" role="tab" aria-selected={calendarScope === "PERSONAL"} onClick={() => setCalendarScope("PERSONAL")} className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${calendarScope === "PERSONAL" ? "bg-violet-600 text-white shadow" : "text-slate-600 hover:bg-slate-50"}`}><UserRound className="h-4 w-4" /> My Task Calendar</button>
        <button type="button" role="tab" aria-selected={calendarScope === "ORGANIZATION"} onClick={() => setCalendarScope("ORGANIZATION")} className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${calendarScope === "ORGANIZATION" ? "bg-violet-600 text-white shadow" : "text-slate-600 hover:bg-slate-50"}`}><Building2 className="h-4 w-4" /> Organization Calendar</button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={goPrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={goNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <h2 className="text-lg font-semibold text-foreground">{monthLabel}</h2>
          <Button variant="outline" size="sm" onClick={goToday}>
            Today
          </Button>
        </div>

        <div className="w-48">
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All Projects</SelectItem>
              {(projects ?? []).map((p) => (
                <SelectItem key={p.project_id} value={p.project_id}>
                  {p.project_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {LEGEND_TYPES.map((t) => (
          <span key={t} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: getEventTypeColor(t) }} />
            {t}
          </span>
        ))}
        {isDeveloper && calendarScope === "PERSONAL" && <>
          {[["To Do", "bg-slate-400"], ["In Progress", "bg-blue-500"], ["In Review", "bg-orange-500"], ["Done", "bg-emerald-500"]].map(([label, color]) => (
            <span key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className={`h-2 w-2 rounded-full ${color}`} />{label}</span>
          ))}
        </>}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        {isLoading ? (
          <Skeleton className="h-[600px] w-full" />
        ) : (projects ?? []).length === 0 ? (
          <EmptyState icon={CalendarIcon} title="No projects yet" description="Create a project first to schedule events." />
        ) : (
          <MonthGrid viewDate={viewDate} events={filteredEvents} tasks={isDeveloper && calendarScope === "PERSONAL" ? assignedCalendarTasks : []} onDayClick={canCreateEvent ? openCreate : undefined} onEventClick={canManageEvents ? (event) => { if (!event.is_automatic) openEdit(event); } : undefined} />
        )}

        <UpcomingEventsList events={filteredEvents} onEventClick={canManageEvents ? (event) => { if (!event.is_automatic) openEdit(event); } : undefined} />
      </div>

      {(canCreateEvent || canManageEvents) && <EventFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        event={editingEvent}
        defaultProjectId={projectFilter !== ALL ? projectFilter : undefined}
        defaultDate={prefillDate}
        calendarScope={calendarScope}
      />}
    </div>
  );
}
