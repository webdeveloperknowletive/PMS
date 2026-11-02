"use client";
import { useParams } from "next/navigation";
import { RecordDetailPage, type DetailField } from "@/components/shared/record-detail-page";
import { useProjectCustomFields } from "@/hooks/queries/use-projects";
export default function CustomFieldDetailPage() {
  const { projectId, fieldId } = useParams<{ projectId: string; fieldId: string }>();
  const { data = [], isLoading } = useProjectCustomFields(projectId);
  const item = data.find((entry) => entry.field_id === fieldId);
  if (isLoading) return <p>Loading custom field…</p>;
  if (!item) return <p>Custom field unavailable.</p>;
  const fields: DetailField[] = [
    { label: "Name", value: item.name },
    { label: "Type", value: item.field_type },
    { label: "Required", value: item.is_required ? "Yes" : "No" },
    { label: "Options", value: item.options.join(", ") },
    { label: "Default value", value: item.default_value == null ? "" : String(item.default_value) },
  ];
  return <RecordDetailPage title={item.name} subtitle="Project custom field · definitions are fixed after creation" backHref={"/projects/" + projectId + "#project-custom-fields"} backLabel="Project custom fields" fields={fields} canEdit={false} onSave={async () => {}} />;
}
