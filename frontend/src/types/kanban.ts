export interface KanbanColumnBase {
  project_id: string;
  column_name: string;
  position: number;
  color?: string | null;
  wip_limit?: number | null;
}

export interface KanbanColumnCreate extends KanbanColumnBase {}

export interface KanbanColumnUpdate {
  column_name?: string;
  position?: number;
  color?: string | null;
  wip_limit?: number | null;
}

export interface KanbanColumn extends KanbanColumnBase {
  column_id: string;
  created_at: string;
}

export interface KanbanTaskBase {
  task_id: string;
  column_id: string;
  position: number;
  moved_by?: string | null;
}

export interface KanbanTaskCreate extends KanbanTaskBase {}

export interface KanbanTaskUpdate {
  column_id?: string;
  position?: number;
  moved_by?: string | null;
}

/** Body for the dedicated drag-and-drop move endpoint — no `moved_by` here,
 *  since the backend stamps that from the authenticated user's token. */
export interface KanbanTaskMovePayload {
  column_id: string;
  position: number;
}

export interface KanbanTask extends KanbanTaskBase {
  kanban_task_id: string;
  moved_at: string;
}

export interface KanbanCardMemberOption {
  user_id: string;
  name: string;
  profile_picture_url?: string | null;
  is_active: boolean;
  is_eligible: boolean;
}

export interface KanbanLabel {
  label_id: string;
  label_key: string;
  name: string;
  color: string;
  created_at: string;
}

export interface KanbanLabelCreate {
  name: string;
  color: string;
}

export interface KanbanLabelUpdate {
  name?: string;
  color?: string;
}
