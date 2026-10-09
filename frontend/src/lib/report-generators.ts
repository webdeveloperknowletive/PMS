import Papa from "papaparse";
import type { Task } from "@/types/task";
import type { Project } from "@/types/project";
import type { Milestone } from "@/types/milestone";
import { TASK_STATUS_LABEL, PRIORITY_LABEL } from "@/lib/constants";

/** Triggers a real browser download of a CSV Blob — no backend file storage involved. */
function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function generateTaskReportCsv(projectName: string, tasks: Task[], userMap: Map<string, { name: string }>) {
  const rows = tasks.map((t) => ({
    "Task Name": t.task_name,
    Status: TASK_STATUS_LABEL[t.status],
    Priority: PRIORITY_LABEL[t.priority],
    Assignee: t.user_id ? userMap.get(t.user_id)?.name ?? "Unknown" : "Unassigned",
    "Due Date": t.due_date ?? "",
    "Created At": t.created_at,
  }));
  downloadCsv(`${projectName.replace(/\s+/g, "_")}_task_report_${Date.now()}.csv`, rows);
}

export function generateProjectSummaryCsv(project: Project, tasks: Task[], milestones: Milestone[]) {
  const taskCounts = tasks.reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1;
    return acc;
  }, {});

  const rows = [
    { Metric: "Project Name", Value: project.project_name },
    { Metric: "Status", Value: project.status },
    { Metric: "Total Tasks", Value: tasks.length },
    ...Object.entries(taskCounts).map(([status, count]) => ({
      Metric: `Tasks — ${TASK_STATUS_LABEL[status as keyof typeof TASK_STATUS_LABEL] ?? status}`,
      Value: count,
    })),
    { Metric: "Total Milestones", Value: milestones.length },
    { Metric: "Completed Milestones", Value: milestones.filter((m) => m.is_completed).length },
  ];
  downloadCsv(`${project.project_name.replace(/\s+/g, "_")}_summary_${Date.now()}.csv`, rows);
}