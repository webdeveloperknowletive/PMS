export interface AuditEvent {
  event_id: string;
  organization_id: string;
  actor_id: string | null;
  actor_name: string;
  actor_roles: string;
  method: string;
  path: string;
  status_code: number;
  created_at: string;
}
