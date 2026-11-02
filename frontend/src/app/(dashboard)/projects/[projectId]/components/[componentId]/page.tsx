"use client";
import { useParams } from "next/navigation";
import { RecordDetailPage, type DetailField } from "@/components/shared/record-detail-page";
import { useProjectComponents, useUpdateProjectComponent } from "@/hooks/queries/use-projects";
import { usePermissions } from "@/hooks/use-permissions";
import type { ProjectComponentCreate } from "@/types/project";
export default function ComponentDetailPage() {
  const { projectId, componentId } = useParams<{ projectId: string; componentId: string }>();
  const { data = [], isLoading } = useProjectComponents(projectId);
  const update = useUpdateProjectComponent();
  const { permissionCodes } = usePermissions();
  const item = data.find((entry) => entry.component_id === componentId);
  if (isLoading) return <p>Loading component…</p>;
  if (!item) return <p>Component unavailable.</p>;
  const fields: DetailField[] = [
    { label: "Name", key: "name", value: item.name, required: true },
    { label: "Description", key: "description", value: item.description, type: "textarea", parse: (value) => value || null },
  ];
  return <RecordDetailPage title={item.name} subtitle="Project component" backHref={"/projects/" + projectId + "#project-components"} backLabel="Project components" fields={fields} canEdit={permissionCodes.includes("projects.update") || permissionCodes.includes("roles.manage")} onSave={async (key, value) => { await update.mutateAsync({ projectId, componentId, payload: { [key]: value } as Partial<ProjectComponentCreate> }); }} />;
}
