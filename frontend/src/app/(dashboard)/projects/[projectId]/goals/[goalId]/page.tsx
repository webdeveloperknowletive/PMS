"use client";
import { useParams } from "next/navigation";
import { RecordDetailPage, type DetailField } from "@/components/shared/record-detail-page";
import { useProjectGoals, useUpdateProjectGoal } from "@/hooks/queries/use-projects";
import { useUsers } from "@/hooks/queries/use-users";
import { usePermissions } from "@/hooks/use-permissions";
import type { ProjectGoal } from "@/types/task";
export default function GoalDetailPage() {
  const { projectId, goalId } = useParams<{ projectId: string; goalId: string }>();
  const { data = [], isLoading } = useProjectGoals(projectId);
  const { data: users = [] } = useUsers();
  const update = useUpdateProjectGoal();
  const { permissionCodes } = usePermissions();
  const item = data.find((entry) => entry.goal_id === goalId);
  if (isLoading) return <p>Loading goal…</p>;
  if (!item) return <p>Goal unavailable.</p>;
  const canEdit = ["projects.create", "projects.update", "projects.delete", "projects.manage", "roles.manage"].some((code) => permissionCodes.includes(code));
  const fields: DetailField[] = [
    { label: "Name", key: "name", value: item.name, required: true },
    { label: "Status", key: "status", value: item.status, type: "select", options: ["ACTIVE","AT_RISK","COMPLETED","CANCELLED"].map((value) => ({ value, label: value })) },
    { label: "Owner", key: "owner_id", value: item.owner_id, type: "select", display: item.owner_name, options: [{ value: "", label: "Unassigned" }, ...users.map((user) => ({ value: user.user_id, label: user.name }))], parse: (value) => value || null },
    { label: "Parent initiative", key: "parent_goal_id", value: item.parent_goal_id, type: "select", display: data.find((goal) => goal.goal_id === item.parent_goal_id)?.name, options: [{ value: "", label: "None" }, ...data.filter((goal) => goal.goal_id !== goalId).map((goal) => ({ value: goal.goal_id, label: goal.name }))], parse: (value) => value || null },
    { label: "Target date", key: "target_date", value: item.target_date, type: "date", parse: (value) => value || null },
    { label: "Progress", value: item.progress_percent + "%" },
    { label: "Description", key: "description", value: item.description, type: "textarea", parse: (value) => value || null },
    { label: "Success measure", key: "success_measure", value: item.success_measure, type: "textarea", parse: (value) => value || null },
  ];
  return <RecordDetailPage title={item.name} subtitle="Project goal" backHref={"/projects/" + projectId + "#project-goals"} backLabel="Project goals" fields={fields} canEdit={canEdit} onSave={async (key, value) => { await update.mutateAsync({ projectId, goalId, payload: { [key]: value } as Partial<ProjectGoal> }); }} />;
}
