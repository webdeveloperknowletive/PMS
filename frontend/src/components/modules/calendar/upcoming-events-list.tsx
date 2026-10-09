import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getEventTypeColor } from "@/lib/event-colors";
import { formatDate, formatTime } from "@/lib/utils";
import type { CalendarEvent } from "@/types/calendar";

export function UpcomingEventsList({ events, onEventClick }: { events: CalendarEvent[]; onEventClick?: (e: CalendarEvent) => void }) {
  const now = new Date();
  const upcoming = events
    .filter((e) => new Date(e.end_datetime) >= now)
    .sort((a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime())
    .slice(0, 6);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Upcoming Events</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">No upcoming events.</p>
        ) : (
          upcoming.map((e) => (
            <button
              key={e.event_id}
              onClick={onEventClick ? () => onEventClick(e) : undefined}
              disabled={!onEventClick}
              className={`flex w-full items-start gap-2 rounded-lg p-2 text-left ${onEventClick ? "hover:bg-muted/50" : "cursor-default"}`}
            >
              <span
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: getEventTypeColor(e.event_type) }}
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{e.title}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(e.start_datetime)} · {formatTime(e.start_datetime)} – {formatTime(e.end_datetime)}
                </p>
              </div>
            </button>
          ))
        )}
      </CardContent>
    </Card>
  );
}
