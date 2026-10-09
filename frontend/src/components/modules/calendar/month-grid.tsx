import { getEventTypeColor } from "@/lib/event-colors";
import type { CalendarEvent } from "@/types/calendar";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function MonthGrid({
  viewDate,
  events,
  onDayClick,
  onEventClick,
}: {
  viewDate: Date;
  events: CalendarEvent[];
  onDayClick?: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
}) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay(); // 0 = Sunday
  const gridStart = new Date(year, month, 1 - startOffset);

  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const today = new Date();

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="grid grid-cols-7 border-b border-border bg-muted/40">
        {WEEKDAYS.map((d) => (
          <div key={d} className="px-3 py-2 text-xs font-semibold text-muted-foreground">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const inMonth = day.getMonth() === month;
          const isToday = isSameDay(day, today);
          const dayEvents = events
            .filter((e) => isSameDay(new Date(e.start_datetime), day))
            .sort((a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime());

          return (
            <div
              key={i}
              className={`min-h-28 border-b border-r border-border p-1.5 last:border-r-0 ${
                inMonth ? "bg-background" : "bg-muted/20"
              } ${onDayClick ? "cursor-pointer" : ""}`}
              onClick={onDayClick ? () => onDayClick(day) : undefined}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                  isToday
                    ? "bg-primary font-semibold text-primary-foreground"
                    : inMonth
                      ? "text-foreground"
                      : "text-muted-foreground"
                }`}
              >
                {day.getDate()}
              </span>
              <div className="mt-1 space-y-1">
                {dayEvents.slice(0, 3).map((e) => (
                  <button
                    key={e.event_id}
                    onClick={onEventClick ? (ev) => {
                      ev.stopPropagation();
                      onEventClick(e);
                    } : undefined}
                    disabled={!onEventClick}
                    className={`flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[11px] ${onEventClick ? "hover:opacity-80" : "cursor-default"}`}
                    style={{ backgroundColor: `${getEventTypeColor(e.event_type)}1A` }}
                  >
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: getEventTypeColor(e.event_type) }}
                    />
                    <span className="truncate" style={{ color: getEventTypeColor(e.event_type) }}>
                      {e.title}
                    </span>
                  </button>
                ))}
                {dayEvents.length > 3 && (
                  <p className="px-1 text-[10px] text-muted-foreground">+{dayEvents.length - 3} more</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
