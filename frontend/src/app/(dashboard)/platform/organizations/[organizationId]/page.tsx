"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Building2, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { useAuthStore } from "@/store/auth-store";
import { platformApi } from "@/lib/api/platform";
import { formatDate, formatTime } from "@/lib/utils";

export default function PlatformOrganizationDetailPage() {
  const params = useParams<{ organizationId: string }>();
  const queryClient = useQueryClient();
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState("");
  const roleNames = useAuthStore((state) => state.user?.role_names ?? []);
  const isSuperAdmin = roleNames.some((role) => role.trim().toLowerCase() === "super admin");
  const organization = useQuery({ queryKey: ["platform-organization", params.organizationId], queryFn: () => platformApi.organization(params.organizationId), enabled: isSuperAdmin && !!params.organizationId });
  if (organization.isLoading && isSuperAdmin) return <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!isSuperAdmin) return <div className="flex flex-col items-center justify-center py-24 text-center"><ShieldAlert className="mb-4 h-8 w-8 text-destructive" /><h1 className="font-semibold">Platform access restricted</h1></div>;
  if (organization.isError) return <div className="space-y-4"><Link href="/platform" className="inline-flex items-center gap-2 text-sm text-primary"><ArrowLeft className="h-4 w-4" />All organizations</Link><p className="text-sm text-destructive">Organization details could not be loaded.</p></div>;
  const item = organization.data;
  if (!item) return <p className="text-sm text-muted-foreground">Organization not found.</p>;
  const organizationUsers = item.users ?? [];
  const recentActivity = item.recent_activity ?? [];

  const changeStatus = async () => {
    if (statusUpdating) return;
    const next = item.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED";
    if (!window.confirm(`Are you sure you want to ${next === "SUSPENDED" ? "suspend" : "reactivate"} ${item.name}?`)) return;
    setStatusUpdating(true);
    setStatusFeedback("");
    try {
      await platformApi.setOrganizationStatus(item.organization_id, next);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["platform-organization", item.organization_id] }),
        queryClient.invalidateQueries({ queryKey: ["platform-organizations"] }),
        queryClient.invalidateQueries({ queryKey: ["platform-overview"] }),
      ]);
      setStatusFeedback(`Organization ${next === "SUSPENDED" ? "suspended" : "reactivated"}.`);
    } catch {
      setStatusFeedback("Could not update this organization. Please try again.");
    } finally {
      setStatusUpdating(false);
    }
  };

  return <div className="space-y-6">
    <PageHeader title={item.name} description={`Platform details for /${item.slug}`} actions={<Button variant="outline" asChild><Link href="/platform"><ArrowLeft className="h-4 w-4" />All organizations</Link></Button>} />
    <div className="flex flex-wrap items-center gap-3"><Badge variant="outline">{item.status}</Badge><Badge variant="secondary">{item.plan_code}</Badge><Button variant="outline" disabled={statusUpdating} onClick={() => void changeStatus()}>{statusUpdating && <Loader2 className="h-4 w-4 animate-spin" />}{item.status === "SUSPENDED" ? "Reactivate workspace" : "Suspend workspace"}</Button>{statusFeedback && <p role="status" className={`text-sm ${statusFeedback.startsWith("Could not") ? "text-destructive" : "text-emerald-700"}`}>{statusFeedback}</p>}</div>
    <div className="grid gap-6 lg:grid-cols-2">
      <Card><CardHeader><CardTitle className="text-base">Organization summary</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">
        <p><span className="text-muted-foreground">Owner:</span> {item.owner?.name ?? "Not identified"}</p>
        <p><span className="text-muted-foreground">Owner email:</span> {item.owner?.email ?? "Not available"}</p>
        <p><span className="text-muted-foreground">Users:</span> {item.user_count}</p>
        <p><span className="text-muted-foreground">Created:</span> {formatDate(item.created_at)}</p>
        <p><span className="text-muted-foreground">Last activity:</span> {item.last_activity_at ? formatDate(item.last_activity_at) : "No activity recorded"}</p>
        <p><span className="text-muted-foreground">Subscription:</span> {item.subscription?.status ?? "Not configured"}</p>
        <p><span className="text-muted-foreground">Subscription plan:</span> {item.subscription?.plan_code ?? "Not configured"}</p>
        {item.subscription?.trial_ends_at && <p><span className="text-muted-foreground">Trial ends:</span> {formatDate(item.subscription.trial_ends_at)}</p>}
        {item.subscription?.period_ends_at && <p><span className="text-muted-foreground">Current period ends:</span> {formatDate(item.subscription.period_ends_at)}</p>}
        {item.subscription && <p><span className="text-muted-foreground">Cancellation:</span> {item.subscription.cancel_at_period_end ? "Scheduled at period end" : "Not scheduled"}</p>}
      </CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">Workspace users and roles</CardTitle></CardHeader><CardContent className="space-y-2">
        {organizationUsers.map((user) => <div key={user.user_id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"><span className="min-w-0"><span className="font-medium">{user.name}</span><span className="ml-2 text-xs text-muted-foreground">{user.email}</span><span className="mt-1 block text-xs text-muted-foreground">{user.role_names?.join(", ") || "No role"}</span></span><Badge variant={user.is_active ? "secondary" : "outline"}>{user.is_active ? "Active" : "Inactive"}</Badge></div>)}
        {organizationUsers.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No users are associated with this organization.</p>}
        {item.user_count > organizationUsers.length && <p className="pt-1 text-xs text-muted-foreground">Showing the 25 most recently created of {item.user_count} users.</p>}
      </CardContent></Card>
    </div>
    <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-4 w-4" />Recent organization activity</CardTitle></CardHeader><CardContent className="space-y-2">
      {recentActivity.map((event) => <div key={event.event_id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg border px-3 py-2 text-sm"><div><span className="font-medium">{event.actor_name}</span><span className="ml-2 text-muted-foreground">{event.method} {event.path}</span></div><span className="text-xs text-muted-foreground">{formatDate(event.created_at)} at {formatTime(event.created_at)} · {event.status_code}</span></div>)}
      {recentActivity.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No audit activity is recorded for this organization.</p>}
    </CardContent></Card>
  </div>;
}
