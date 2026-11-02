"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { TeamFormDialog } from "@/components/modules/teams/team-form-dialog";
import { usePermissions } from "@/hooks/use-permissions";

export default function NewTeamPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { permissionCodes, isLoading } = usePermissions();
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading permissions…</p>;
  if (!permissionCodes.includes("teams.create")) return <p className="text-sm text-destructive">You cannot create teams.</p>;
  return <div className="space-y-6"><PageHeader title="Create team" description="Assign a team to a project." showHome={false} /><TeamFormDialog page open onOpenChange={() => router.push("/teams")} onSaved={() => router.push("/teams")} defaultProjectId={params.get("project_id") ?? undefined} /></div>;
}
