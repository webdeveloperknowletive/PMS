"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { TaskFormDialog } from "@/components/modules/tasks/task-form-dialog";
import { usePermissions } from "@/hooks/use-permissions";

const WORK_TYPES = ["EPIC", "STORY", "TASK", "BUG", "SPIKE"] as const;

export default function NewWorkItemPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { permissionCodes, isLoading } = usePermissions();
  const requestedType = params.get("type")?.toUpperCase();
  const workType = WORK_TYPES.find((type) => type === requestedType) ?? "TASK";
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading permissions…</p>;
  if (!permissionCodes.includes("tasks.create")) return <p className="text-sm text-destructive">You cannot create work items.</p>;
  return <div className="space-y-6">
    <PageHeader title={`Create ${workType.charAt(0) + workType.slice(1).toLowerCase()}`} description="Add a work item to a project." showHome={false} />
    <TaskFormDialog page open onOpenChange={() => router.push("/tasks")} onSaved={(task) => router.push(`/tasks/${task.task_id}`)} defaultProjectId={params.get("project_id") ?? undefined} defaultTaskType={workType} />
  </div>;
}
