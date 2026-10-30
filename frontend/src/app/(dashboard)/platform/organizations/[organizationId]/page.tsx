"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { Building2, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { usePermissions } from "@/hooks/use-permissions";
import { platformApi } from "@/lib/api/platform";
import { formatDate } from "@/lib/utils";

export default function PlatformOrganizationDetailPage() {
  const params = useParams<{ organizationId: string }>();
  const queryClient = useQueryClient();
  const { roleNames, isLoading: permissionsLoading } = usePermissions();
  const isSuperAdmin = roleNames.some((role) => role.trim().toLowerCase() === "super admin");
  const organization = useQuery({ queryKey: ["platform-organization", params.organizationId], queryFn: () => platformApi.organization(params.organizationId), enabled: isSuperAdmin && !!params.organizationId });
  if (permissionsLoading || organization.isLoading) return <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!isSuperAdmin) return <div className="flex flex-col items-center justify-center py-24 text-center"><ShieldAlert className="mb-4 h-8 w-8 text-destructive" /><h1 className="font-semibold">Platform access restricted</h1></div>;
  const item = organization.data;
  if (!item) return <p className="text-sm text-destructive">Organization not found.</p>;
  const changeStatus = async () => { const next = item.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED"; if (!window.confirm(`Are you sure you want to ${next === "SUSPENDED" ? "suspend" : "reactivate"} ${item.name}?`)) return; await platformApi.setOrganizationStatus(item.organization_id, next); await queryClient.invalidateQueries({ queryKey: ["platform-organization", item.organization_id] }); };
  return <div className="space-y-6"><PageHeader title={item.name} description={`Platform details for /${item.slug}`} /><div className="flex flex-wrap items-center gap-3"><Badge variant="outline">{item.status}</Badge><Badge variant="secondary">{item.plan_code}</Badge><Button variant="outline" onClick={changeStatus}>{item.status === "SUSPENDED" ? "Reactivate workspace" : "Suspend workspace"}</Button></div><div className="grid gap-6 lg:grid-cols-2"><Card><CardHeader><CardTitle className="text-base">Workspace summary</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><p><span className="text-muted-foreground">Users:</span> {item.user_count}</p><p><span className="text-muted-foreground">Created:</span> {formatDate(item.created_at)}</p><p><span className="text-muted-foreground">Last activity:</span> {item.last_activity_at ? formatDate(item.last_activity_at) : "No activity recorded"}</p><p><span className="text-muted-foreground">Subscription:</span> {item.subscription?.status ?? "Not configured"}</p></CardContent></Card><Card><CardHeader><CardTitle className="text-base">Workspace users and roles</CardTitle></CardHeader><CardContent className="space-y-2">{(item.users ?? []).map((user: { user_id: string; name: string; email: string; is_active: boolean; role_names?: string[] }) => <div key={user.user_id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"><span><span className="font-medium">{user.name}</span><span className="ml-2 text-xs text-muted-foreground">{user.email}</span><span className="mt-1 block text-xs text-muted-foreground">{user.role_names?.join(", ") || "No role"}</span></span><Badge variant={user.is_active ? "secondary" : "outline"}>{user.is_active ? "Active" : "Inactive"}</Badge></div>)}</CardContent></Card></div><Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-4 w-4" />Organization data</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">This developer-company panel is limited to workspace organization data. Billing, support tickets, email center, and security controls remain outside this dashboard.</CardContent></Card></div>;
}
