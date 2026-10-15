"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { calendarApi } from "@/lib/api/calendar";
import type { CalendarEventCreate, CalendarEventUpdate } from "@/types/calendar";

const KEY = "calendar-events";

export function useCalendarEvents(enabled = true) {
  return useQuery({
    queryKey: [KEY],
    queryFn: () => calendarApi.list({ limit: 500 }),
    enabled,
  });
}

export function useCreateCalendarEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CalendarEventCreate) => calendarApi.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateCalendarEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CalendarEventUpdate }) => calendarApi.update(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteCalendarEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => calendarApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY] }),
  });
}
