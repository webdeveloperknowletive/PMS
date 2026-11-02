"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { RecordDetailPage, type DetailField } from "@/components/shared/record-detail-page";
import { useCalendarEvents, useUpdateCalendarEvent } from "@/hooks/queries/use-calendar";
import { usePermissions } from "@/hooks/use-permissions";
import type { CalendarEventUpdate } from "@/types/calendar";
const localDateTime = (value: string) => {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
export default function CalendarEventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { data = [], isLoading } = useCalendarEvents();
  const update = useUpdateCalendarEvent();
  const { permissionCodes } = usePermissions();
  const item = data.find((entry) => entry.event_id === eventId);
  if (isLoading) return <p>Loading event…</p>;
  if (!item) return <p>Event unavailable.</p>;
  const canEdit = permissionCodes.includes("calendar.manage") && !item.is_automatic;
  const fields: DetailField[] = [
    { label: "Title", key: "title", value: item.title, required: true },
    { label: "Type", key: "event_type", value: item.event_type, required: true },
    { label: "Start", key: "start_datetime", value: localDateTime(item.start_datetime), type: "datetime-local", parse: (value) => new Date(value).toISOString() },
    { label: "End", key: "end_datetime", value: localDateTime(item.end_datetime), type: "datetime-local", parse: (value) => new Date(value).toISOString() },
    { label: "Location", key: "location", value: item.location, parse: (value) => value || null },
    { label: "Scope", value: item.calendar_scope },
    { label: "Project", value: item.project_id, display: <Link href={"/projects/" + item.project_id} className="text-[#0c66e4] hover:underline">Open project</Link> },
    { label: "Description", key: "description", value: item.description, type: "textarea", parse: (value) => value || null },
  ];
  return <RecordDetailPage title={item.title} subtitle="Calendar event" backHref="/calendar" backLabel="Calendar" fields={fields} canEdit={canEdit} onSave={async (key, value) => { await update.mutateAsync({ id: eventId, payload: { [key]: value } as CalendarEventUpdate }); }} />;
}
