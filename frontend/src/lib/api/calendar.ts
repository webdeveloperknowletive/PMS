import { createCrudApi } from "./crud-factory";
import type { CalendarEvent, CalendarEventCreate, CalendarEventUpdate } from "@/types/calendar";

export const calendarApi = createCrudApi<CalendarEvent, CalendarEventCreate, CalendarEventUpdate>(
  "/calendar/events",
  "event_id"
);
