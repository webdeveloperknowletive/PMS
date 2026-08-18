import { createCrudApi } from "./crud-factory";
import type { Notification, NotificationCreate, NotificationUpdate } from "@/types/notification";

export const notificationsApi = createCrudApi<Notification, NotificationCreate, NotificationUpdate>(
  "/notifications",
  "notification_id"
);
