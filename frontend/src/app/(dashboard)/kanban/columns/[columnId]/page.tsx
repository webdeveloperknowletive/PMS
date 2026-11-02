"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { RecordDetailPage, type DetailField } from "@/components/shared/record-detail-page";
import { useKanbanColumns, useUpdateKanbanColumn } from "@/hooks/queries/use-kanban";
import { usePermissions } from "@/hooks/use-permissions";
import type { KanbanColumnUpdate } from "@/types/kanban";
export default function ColumnDetailPage() {
  const { columnId } = useParams<{ columnId: string }>();
  const { data = [], isLoading } = useKanbanColumns();
  const update = useUpdateKanbanColumn();
  const { canManageKanbanBoard } = usePermissions();
  const item = data.find((entry) => entry.column_id === columnId);
  if (isLoading) return <p>Loading column…</p>;
  if (!item) return <p>Column unavailable.</p>;
  const fields: DetailField[] = [
    { label: "Name", key: "column_name", value: item.column_name, required: true },
    { label: "Position", key: "position", value: item.position, type: "number", required: true, parse: Number },
    { label: "WIP limit", key: "wip_limit", value: item.wip_limit, type: "number", parse: (value) => value ? Number(value) : null },
    { label: "Color", key: "color", value: item.color, parse: (value) => value || null },
    { label: "Project", value: item.project_id, display: <Link href={"/projects/" + item.project_id} className="text-[#0c66e4] hover:underline">Open project</Link> },
  ];
  return <RecordDetailPage title={item.column_name} subtitle="Board column" backHref={"/kanban?project_id=" + item.project_id} backLabel="Project board" fields={fields} canEdit={canManageKanbanBoard} onSave={async (key, value) => { await update.mutateAsync({ columnId, payload: { [key]: value } as KanbanColumnUpdate }); }} />;
}
