"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateCalendarEvent, useUpdateCalendarEvent, useDeleteCalendarEvent } from "@/hooks/queries/use-calendar";
import { useProjects } from "@/hooks/queries/use-projects";
import { useAuthStore } from "@/store/auth-store";
import { getApiErrorMessage } from "@/lib/api/client";
import type { CalendarEvent } from "@/types/calendar";

const EVENT_TYPES = ["Meeting", "Deadline", "Milestone", "Review", "Planning", "Standup", "Holiday", "Other"];

const schema = z
  .object({
    project_id: z.string().min(1, "Project is required"),
    title: z.string().min(2, "Title is required"),
    description: z.string().optional(),
    event_type: z.string().min(1, "Event type is required"),
    date: z.string().min(1, "Date is required"),
    start_time: z.string().min(1, "Start time is required"),
    end_time: z.string().min(1, "End time is required"),
    location: z.string().optional(),
  })
  .refine((data) => data.end_time >= data.start_time, {
    message: "End time must be after start time",
    path: ["end_time"],
  });
type FormValues = z.infer<typeof schema>;

function splitDatetime(iso: string) {
  const d = new Date(iso);
  const date = d.toISOString().slice(0, 10);
  const time = d.toTimeString().slice(0, 5);
  return { date, time };
}

export function EventFormDialog({
  open,
  onOpenChange,
  event,
  defaultProjectId,
  defaultDate,
  calendarScope = "ORGANIZATION",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: CalendarEvent | null;
  defaultProjectId?: string;
  defaultDate?: string; // "YYYY-MM-DD", used when creating from clicking a day cell
  calendarScope?: "PERSONAL" | "ORGANIZATION";
}) {
  const isEditing = !!event;
  const { data: projects } = useProjects();
  const currentUser = useAuthStore((s) => s.user);
  const createMutation = useCreateCalendarEvent();
  const updateMutation = useUpdateCalendarEvent();
  const deleteMutation = useDeleteCalendarEvent();
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      project_id: defaultProjectId ?? "",
      title: "",
      description: "",
      event_type: "Meeting",
      date: defaultDate ?? "",
      start_time: "09:00",
      end_time: "10:00",
      location: "",
    },
  });

  useEffect(() => {
    if (open) {
      if (event) {
        const start = splitDatetime(event.start_datetime);
        const end = splitDatetime(event.end_datetime);
        reset({
          project_id: event.project_id,
          title: event.title,
          description: event.description ?? "",
          event_type: event.event_type,
          date: start.date,
          start_time: start.time,
          end_time: end.time,
          location: event.location ?? "",
        });
      } else {
        reset({
          project_id: defaultProjectId ?? "",
          title: "",
          description: "",
          event_type: "Meeting",
          date: defaultDate ?? "",
          start_time: "09:00",
          end_time: "10:00",
          location: "",
        });
      }
    }
  }, [open, event, defaultProjectId, defaultDate, reset]);

  const onSubmit = async (values: FormValues) => {
    const payload = {
      project_id: values.project_id,
      // Default the organizer to whoever is creating the event — the backend
      // column is nullable and there's no attendee list to pick from, so
      // "the creator" is the only sensible default. Kept as-is on edit
      // (not overwritten) so re-assigning organizer isn't silently possible
      // from this form.  
      ...(isEditing ? {} : { organizer: currentUser?.user_id ?? null }),
      title: values.title,
      description: values.description || null,
      event_type: values.event_type,
      start_datetime: new Date(`${values.date}T${values.start_time}:00`).toISOString(),
      end_datetime: new Date(`${values.date}T${values.end_time}:00`).toISOString(),
      location: values.location || null,
      ...(isEditing ? {} : {
        calendar_scope: calendarScope,
        calendar_owner_id: calendarScope === "PERSONAL" ? currentUser?.user_id ?? null : null,
      }),
    };
    try {
      if (isEditing && event) {
        await updateMutation.mutateAsync({ id: event.event_id, payload });
        toast.success("Event updated");
      } else {
        await createMutation.mutateAsync(payload as never);
        toast.success("Event created");
      }
      onOpenChange(false);
    } catch (err) {
      setError("root", { message: getApiErrorMessage(err) });
    }
  };

  const handleDelete = async () => {
    if (!event) return;
    try {
      await deleteMutation.mutateAsync(event.event_id);
      toast.success("Event deleted");
      onOpenChange(false);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Event" : "Create Event"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update this event's details." : "Add a new event to the project calendar."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" placeholder="e.g. Sprint Planning" {...register("title")} />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" placeholder="Optional notes" {...register("description")} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Project</Label>
              <Controller
                control={control}
                name="project_id"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select project" />
                    </SelectTrigger>
                    <SelectContent>
                      {(projects ?? []).map((p) => (
                        <SelectItem key={p.project_id} value={p.project_id}>
                          {p.project_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.project_id && <p className="text-xs text-destructive">{errors.project_id.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Event type</Label>
              <Controller
                control={control}
                name="event_type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EVENT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" {...register("date")} />
            {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="start_time">Start time</Label>
              <Input id="start_time" type="time" {...register("start_time")} />
              {errors.start_time && <p className="text-xs text-destructive">{errors.start_time.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end_time">End time</Label>
              <Input id="end_time" type="time" {...register("end_time")} />
              {errors.end_time && <p className="text-xs text-destructive">{errors.end_time.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="location">Location</Label>
            <Input id="location" placeholder="Optional — room, link, etc." {...register("location")} />
          </div>

          {errors.root && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{errors.root.message}</p>
          )}

          <DialogFooter className="flex items-center justify-between sm:justify-between">
            {isEditing ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                {isEditing ? "Save changes" : "Create event"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
