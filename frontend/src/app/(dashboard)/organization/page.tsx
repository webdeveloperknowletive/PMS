"use client";

import { Building2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { InlineDetailField } from "@/components/shared/inline-detail-field";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentOrganization, useUpdateCurrentOrganization } from "@/hooks/queries/use-organizations";
import { usePermissions } from "@/hooks/use-permissions";
import { WORKSPACE_DOMAIN } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

export default function OrganizationPage() {
  const { canManageOrganization, isLoading: permissionsLoading } = usePermissions();
  const { data: organization, isLoading } = useCurrentOrganization();
  const update = useUpdateCurrentOrganization();
  const workspaceSlug = organization?.slug ?? "";
  const workspaceUrl = WORKSPACE_DOMAIN.includes("localhost")
    ? `http://${WORKSPACE_DOMAIN}/login?workspace_slug=${encodeURIComponent(workspaceSlug)}`
    : `https://${workspaceSlug}.${WORKSPACE_DOMAIN}`;

  const save = async (payload: { name?: string; slug?: string }) => {
    if (!organization) return;
    await update.mutateAsync({ name: payload.name ?? organization.name, slug: payload.slug ?? organization.slug });
    toast.success("Workspace updated");
  };

  if (!permissionsLoading && !canManageOrganization) {
    return <Card><CardContent className="p-6 text-sm text-slate-600">You do not have permission to manage organization settings.</CardContent></Card>;
  }

  return (
    <div className="workspace-page animate-enter space-y-5">
      <PageHeader title="Organization" description="Manage your company's workspace details and view its current trial." />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(260px,0.75fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-4 w-4 text-violet-600" /> Workspace details</CardTitle>
            <CardDescription>These details identify your company workspace to its members.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <div className="space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div> : organization && <div className="space-y-4">
              <InlineDetailField label="Organization name" value={organization.name} canEdit={canManageOrganization} required validate={(value) => value.length < 2 || value.length > 180 ? "Use 2 to 180 characters" : undefined} onSave={(value) => save({ name: value })} />
              <InlineDetailField label="Workspace address" value={organization.slug} canEdit={canManageOrganization} required validate={(value) => /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(value) && value.length >= 3 && value.length <= 63 ? undefined : "Use 3 to 63 lowercase letters, numbers, or hyphens"} onSave={(value) => save({ slug: value.toLowerCase() })} />
              <p className="text-xs text-slate-500">Workspace members can use this address to sign in to the right company space.</p>
            </div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Plan status</CardTitle><CardDescription>Current subscription record for this workspace.</CardDescription></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {isLoading ? <Skeleton className="h-16 w-full" /> : <>
              <div className="flex items-center justify-between gap-3"><span className="text-slate-500">Plan</span><span className="font-semibold text-slate-900">{organization?.plan_code ?? "—"}</span></div>
              <div className="flex items-center justify-between gap-3"><span className="text-slate-500">Status</span><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{organization?.subscription_status ?? organization?.status ?? "—"}</span></div>
              {organization?.trial_ends_at && <div className="flex items-center justify-between gap-3"><span className="text-slate-500">Trial ends</span><span className="font-medium text-slate-900">{formatDate(organization.trial_ends_at)}</span></div>}
              {organization?.slug && <a className="block break-all rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm font-medium text-blue-700 hover:underline" href={workspaceUrl} target="_blank" rel="noreferrer">Open workspace sign-in: {workspaceUrl}</a>}
              <p className="rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-500">Billing checkout is not connected yet. This page shows trial information only; no payment is being taken.</p>
            </>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
