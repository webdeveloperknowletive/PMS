"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon } from "lucide-react";
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
import type { CalendarEvent } from "@/types/calendar";

const ALL = "__all__";
const LEGEND_TYPES = ["Meeting", "Deadline", "Milestone", "Review", "Planning", "Standup", "Holiday"];

export default function CalendarPage() {
  const { data: events, isLoading } = useCalendarEvents();
  const { data: projects } = useProjects();

  const [projectFilter, setProjectFilter] = useState(ALL);
  const [viewDate, setViewDate] = useState(() => new Date());

  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [prefillDate, setPrefillDate] = useState<string | undefined>(undefined);

  const filteredEvents = useMemo(
    () => (events ?? []).filter((e) => projectFilter === ALL || e.project_id === projectFilter),
    [events, projectFilter]
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
        description="View and manage your events, meetings, and deadlines in one place"
        actions={
          <Button onClick={() => openCreate()}>
            <Plus className="h-4 w-4" />
            Create Event
          </Button>
        }
      />

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
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        {isLoading ? (
          <Skeleton className="h-[600px] w-full" />
        ) : (projects ?? []).length === 0 ? (
          <EmptyState icon={CalendarIcon} title="No projects yet" description="Create a project first to schedule events." />
        ) : (
          <MonthGrid viewDate={viewDate} events={filteredEvents} onDayClick={openCreate} onEventClick={openEdit} />
        )}

        <UpcomingEventsList events={filteredEvents} onEventClick={openEdit} />
      </div>

      <EventFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        event={editingEvent}
        defaultProjectId={projectFilter !== ALL ? projectFilter : undefined}
        defaultDate={prefillDate}
      />
    </div>
  );
}
