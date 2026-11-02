"use client";
import { useParams } from "next/navigation";
import { RecordDetailPage, type DetailField } from "@/components/shared/record-detail-page";
import { useProjectReleases, useUpdateProjectRelease } from "@/hooks/queries/use-projects";
import { usePermissions } from "@/hooks/use-permissions";
import type { ProjectRelease } from "@/types/task";
export default function ReleaseDetailPage() {
  const { projectId, releaseId } = useParams<{ projectId: string; releaseId: string }>();
  const { data = [], isLoading } = useProjectReleases(projectId);
  const update = useUpdateProjectRelease();
  const { permissionCodes } = usePermissions();
  const item = data.find((entry) => entry.release_id === releaseId);
  if (isLoading) return <p>Loading release…</p>;
  if (!item) return <p>Release unavailable.</p>;
  const fields: DetailField[] = [
    { label: "Name", key: "name", value: item.name, required: true },
    { label: "Version", key: "version", value: item.version, parse: (value) => value || null },
    { label: "Status", key: "status", value: item.status, type: "select", options: ["PLANNED","IN_PROGRESS","RELEASED","CANCELLED"].map((value) => ({ value, label: value })) },
    { label: "Release date", key: "release_date", value: item.release_date, type: "date", parse: (value) => value || null },
    { label: "Tasks", value: item.task_count },
    { label: "Unresolved tasks", value: item.unresolved_task_count },
    { label: "Notes", key: "notes", value: item.notes, type: "textarea", parse: (value) => value || null },
  ];
  return <RecordDetailPage title={item.name} subtitle="Project release" backHref={"/projects/" + projectId + "#project-releases"} backLabel="Project releases" fields={fields} canEdit={permissionCodes.includes("projects.update") || permissionCodes.includes("roles.manage")} onSave={async (key, value) => { await update.mutateAsync({ projectId, releaseId, payload: { [key]: value } as Partial<ProjectRelease> }); }} />;
}
