"use client";
import { useParams } from "next/navigation";
import { RecordDetailPage, type DetailField } from "@/components/shared/record-detail-page";
import { useSprints, useUpdateSprint } from "@/hooks/queries/use-tasks";
import { usePermissions } from "@/hooks/use-permissions";
export default function SprintDetailPage() {
  const { projectId, sprintId } = useParams<{ projectId: string; sprintId: string }>();
  const { data = [], isLoading } = useSprints(projectId);
  const update = useUpdateSprint();
  const { canManageTasks } = usePermissions();
  const item = data.find((entry) => entry.sprint_id === sprintId);
  if (isLoading) return <p>Loading sprint…</p>;
  if (!item) return <p>Sprint unavailable.</p>;
  const fields: DetailField[] = [
    { label: "Name", key: "sprint_name", value: item.sprint_name, required: true },
    { label: "Status", key: "status", value: item.status, type: "select", options: ["PLANNED","ACTIVE","COMPLETED"].map((value) => ({ value, label: value })) },
    { label: "Start date", key: "start_date", value: item.start_date, type: "date", parse: (value) => value || null },
    { label: "End date", key: "end_date", value: item.end_date, type: "date", parse: (value) => value || null },
    { label: "Capacity points", key: "capacity_points", value: item.capacity_points, type: "number", parse: (value) => value ? Number(value) : null },
    { label: "Goal", key: "goal", value: item.goal, type: "textarea", parse: (value) => value || null },
  ];
  return <RecordDetailPage title={item.sprint_name} subtitle="Project sprint" backHref={"/projects/" + projectId + "#project-work"} backLabel="Project backlog" fields={fields} canEdit={canManageTasks} onSave={async (key, value) => { await update.mutateAsync({ id: sprintId, payload: { [key]: value } }); }} />;
}
