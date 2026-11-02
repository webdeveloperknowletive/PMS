"use client";
import { useParams } from "next/navigation";
import { RecordDetailPage, type DetailField } from "@/components/shared/record-detail-page";
import { useKanbanLabels, useUpdateKanbanLabel } from "@/hooks/queries/use-kanban";
import { usePermissions } from "@/hooks/use-permissions";
import type { KanbanLabelUpdate } from "@/types/kanban";
export default function LabelDetailPage() {
  const { labelId } = useParams<{ labelId: string }>();
  const { data = [], isLoading } = useKanbanLabels();
  const update = useUpdateKanbanLabel();
  const { permissionCodes } = usePermissions();
  const item = data.find((entry) => entry.label_id === labelId);
  if (isLoading) return <p>Loading label…</p>;
  if (!item) return <p>Label unavailable.</p>;
  const fields: DetailField[] = [
    { label: "Name", key: "name", value: item.name, required: true },
    { label: "Color", key: "color", value: item.color, required: true, validate: (value) => /^#[0-9a-f]{6}$/i.test(value) ? undefined : "Use a 6-digit hex color" },
    { label: "Key", value: item.label_key },
  ];
  return <RecordDetailPage title={item.name} subtitle="Board label" backHref="/kanban" backLabel="Board" fields={fields} canEdit={permissionCodes.includes("kanban.labels.manage") || permissionCodes.includes("roles.manage")} onSave={async (key, value) => { await update.mutateAsync({ labelId, payload: { [key]: value } as KanbanLabelUpdate }); }} />;
}
