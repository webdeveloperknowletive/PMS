import { createCrudApi } from "./crud-factory";
import type { GanttTask, GanttTaskCreate, GanttTaskUpdate } from "@/types/gantt";

export const ganttApi = createCrudApi<GanttTask, GanttTaskCreate, GanttTaskUpdate>("/gantt/tasks", "gantt_id");
