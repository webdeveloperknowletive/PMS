export interface CalendarEventBase {
  project_id: string;
  organizer?: string | null;
  title: string;
  description?: string | null;
  event_type: string;
  start_datetime: string; // ISO datetime
  end_datetime: string; // ISO datetime, must be >= start_datetime
  location?: string | null;
}

export interface CalendarEventCreate extends CalendarEventBase {}

export interface CalendarEventUpdate {
  title?: string;
  description?: string | null;
  event_type?: string;
  start_datetime?: string;
  end_datetime?: string;
  location?: string | null;
}

export interface CalendarEvent extends CalendarEventBase {
  event_id: string;
  created_at: string;
}
