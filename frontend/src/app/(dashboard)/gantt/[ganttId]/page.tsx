"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { RecordDetailPage, type DetailField } from "@/components/shared/record-detail-page";
import { useGanttTasks, useUpdateGanttTask } from "@/hooks/queries/use-gantt";
import { useTasks } from "@/hooks/queries/use-tasks";
import { usePermissions } from "@/hooks/use-permissions";
import type { GanttTaskUpdate } from "@/types/gantt";
export default function GanttDetailPage() {
  const { ganttId } = useParams<{ ganttId: string }>();
  const { data = [], isLoading } = useGanttTasks();
  const { data: tasks = [] } = useTasks({ limit: 500 });
  const update = useUpdateGanttTask();
  const { canManageGantt } = usePermissions();
  const item = data.find((entry) => entry.gantt_id === ganttId);
  if (isLoading) return <p>Loading schedule…</p>;
  if (!item) return <p>Schedule unavailable.</p>;
  const task = tasks.find((entry) => entry.task_id === item.task_id);
  const fields: DetailField[] = [
    { label: "Work item", value: item.task_id, display: <Link href={"/tasks/" + item.task_id} className="text-[#0c66e4] hover:underline">{task?.task_name ?? "Open work item"}</Link> },
    { label: "Start date", key: "start_date", value: item.start_date, type: "date", required: true },
    { label: "End date", key: "end_date", value: item.end_date, type: "date", required: true },
    { label: "Progress (%)", key: "progress", value: item.progress, type: "number", required: true, validate: (value) => Number(value) < 0 || Number(value) > 100 ? "Enter a value from 0 to 100" : undefined, parse: Number },
    { label: "Depends on", key: "dependency_task", value: item.dependency_task, type: "select", options: [{ value: "", label: "None" }, ...tasks.filter((entry) => entry.project_id === item.project_id && entry.task_id !== item.task_id).map((entry) => ({ value: entry.task_id, label: entry.task_name }))], parse: (value) => value || null },
    { label: "Project", value: item.project_id, display: <Link href={"/projects/" + item.project_id} className="text-[#0c66e4] hover:underline">Open project</Link> },
  ];
  return <RecordDetailPage title={task?.task_name ?? "Scheduled work item"} subtitle="Schedule details" backHref="/gantt" backLabel="Schedule" fields={fields} canEdit={canManageGantt} onSave={async (key, value) => { await update.mutateAsync({ id: ganttId, payload: { [key]: value } as GanttTaskUpdate }); }} />;
}
