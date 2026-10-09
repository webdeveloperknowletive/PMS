import { createCrudApi } from "./crud-factory";
import { apiClient } from "./client";
import type { Notification, NotificationCreate, NotificationUpdate } from "@/types/notification";

export const notificationsApi = createCrudApi<Notification, NotificationCreate, NotificationUpdate>(
  "/notifications",
  "notification_id"
);

export const notificationSettingsApi = {
  getMeetingReminder: async (): Promise<{ lead_minutes: number }> =>
    (await apiClient.get<{ lead_minutes: number }>("/notifications/settings/meeting-reminder")).data,
  updateMeetingReminder: async (lead_minutes: number): Promise<{ lead_minutes: number }> =>
    (await apiClient.put<{ lead_minutes: number }>("/notifications/settings/meeting-reminder", { lead_minutes })).data,
  getToastDuration: async (): Promise<{ duration_seconds: number }> =>
    (await apiClient.get<{ duration_seconds: number }>("/notifications/settings/toast-duration")).data,
  updateToastDuration: async (duration_seconds: number): Promise<{ duration_seconds: number }> =>
    (await apiClient.put<{ duration_seconds: number }>("/notifications/settings/toast-duration", { duration_seconds })).data,
  getSound: async (): Promise<{ sound_key: string }> =>
    (await apiClient.get<{ sound_key: string }>("/notifications/settings/sound")).data,
  updateSound: async (sound_key: string): Promise<{ sound_key: string }> =>
    (await apiClient.put<{ sound_key: string }>("/notifications/settings/sound", { sound_key })).data,
  getVolume: async (): Promise<{ volume_percent: number }> =>
    (await apiClient.get<{ volume_percent: number }>("/notifications/settings/volume")).data,
  updateVolume: async (volume_percent: number): Promise<{ volume_percent: number }> =>
    (await apiClient.put<{ volume_percent: number }>("/notifications/settings/volume", { volume_percent })).data,
};
