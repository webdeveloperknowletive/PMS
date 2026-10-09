export interface GanttTaskBase {
  project_id: string;
  task_id: string;
  dependency_task?: string | null;
  start_date: string; // ISO date
  end_date: string; // ISO date, must be >= start_date (enforced by backend validator)
  progress: number; // 0-100
}

export interface GanttTaskCreate extends GanttTaskBase {}

export interface GanttTaskUpdate {
  dependency_task?: string | null;
  start_date?: string;
  end_date?: string;
  progress?: number;
}

export interface GanttTask extends GanttTaskBase {
  gantt_id: string;
  created_at: string;
}
