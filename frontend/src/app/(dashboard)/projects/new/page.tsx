"use client";

import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { ProjectFormDialog } from "@/components/modules/projects/project-form-dialog";
import { usePermissions } from "@/hooks/use-permissions";

export default function NewProjectPage() {
  const router = useRouter();
  const { permissionCodes, isLoading } = usePermissions();
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading permissions…</p>;
  if (!permissionCodes.includes("projects.create")) return <p className="text-sm text-destructive">You cannot create projects.</p>;
  return <div className="space-y-6"><PageHeader title="Create project" description="Set up the project, team, board, and workflow." showHome={false} /><ProjectFormDialog page open onOpenChange={() => router.push("/projects")} onSaved={(id) => router.push(`/projects/${id}`)} /></div>;
}
