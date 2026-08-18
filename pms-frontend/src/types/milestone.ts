export interface MilestoneBase {
  project_id: string;
  title: string;
  description?: string | null;
  due_date: string; // ISO date
  is_completed: boolean;
}

export interface MilestoneCreate extends MilestoneBase {}

export interface MilestoneUpdate {
  title?: string;
  description?: string | null;
  due_date?: string;
  is_completed?: boolean;
}

export interface Milestone extends MilestoneBase {
  milestone_id: string;
  created_at: string;
}
