export interface NotificationBase {
  user_id: string;
  project_id?: string | null;
  title: string;
  message: string;
  notification_type: string;
  is_read: boolean;
}

export interface NotificationCreate extends NotificationBase {}

export interface NotificationUpdate {
  is_read?: boolean;
}

export interface Notification extends NotificationBase {
  notification_id: string;
  sent_at: string;
}
