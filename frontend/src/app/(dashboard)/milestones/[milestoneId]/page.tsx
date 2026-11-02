"use client";
import { useParams } from "next/navigation";
import { RecordDetailPage, type DetailField } from "@/components/shared/record-detail-page";
import { useMilestones, useUpdateMilestone } from "@/hooks/queries/use-milestones";
import { usePermissions } from "@/hooks/use-permissions";
import type { MilestoneUpdate } from "@/types/milestone";
export default function MilestoneDetailPage() {
  const { milestoneId } = useParams<{ milestoneId: string }>();
  const { data = [], isLoading } = useMilestones();
  const update = useUpdateMilestone();
  const { canManageMilestones } = usePermissions();
  const item = data.find((entry) => entry.milestone_id === milestoneId);
  if (isLoading) return <p>Loading milestone…</p>;
  if (!item) return <p>Milestone unavailable.</p>;
  const fields: DetailField[] = [
    { label: "Title", key: "title", value: item.title, required: true },
    { label: "Due date", key: "due_date", value: item.due_date, type: "date", required: true },
    { label: "Status", key: "is_completed", value: item.is_completed ? "completed" : "open", type: "select", options: [{ value: "open", label: "Open" }, { value: "completed", label: "Completed" }], parse: (value) => value === "completed" },
    { label: "Description", key: "description", value: item.description, type: "textarea", parse: (value) => value || null },
  ];
  return <RecordDetailPage title={item.title} subtitle="Milestone" backHref="/milestones" backLabel="All milestones" fields={fields} canEdit={canManageMilestones} onSave={async (key, value) => { await update.mutateAsync({ id: milestoneId, payload: { [key]: value } as MilestoneUpdate }); }} />;
}
