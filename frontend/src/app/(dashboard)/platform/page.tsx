"use client";

import Link from "next/link";
import { useState } from "react";
import { Building2, Loader2, Search, ShieldAlert } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import { usePermissions } from "@/hooks/use-permissions";
import { platformApi } from "@/lib/api/platform";
import { formatDate } from "@/lib/utils";

export default function PlatformDashboardPage() {
  const { roleNames, isLoading: permissionsLoading } = usePermissions();
  const isSuperAdmin = roleNames.some((role) => role.trim().toLowerCase() === "super admin");
  const [search, setSearch] = useState("");
  const organizations = useQuery({ queryKey: ["platform-organizations", search], queryFn: () => platformApi.organizations(search), enabled: isSuperAdmin });
  if (permissionsLoading || organizations.isLoading) return <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!isSuperAdmin) return <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card py-24 text-center"><ShieldAlert className="mb-4 h-8 w-8 text-destructive" /><h1 className="text-base font-semibold">Platform access restricted</h1><p className="mt-1 text-sm text-muted-foreground">Only the developer company Super Admin can view registered organizations.</p></div>;
  return <div className="space-y-6"><PageHeader title="Registered organizations" description="Developer-company view of every SprintIX customer workspace." /><Card><CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle className="text-base">Customer workspaces</CardTitle><p className="mt-1 text-xs text-muted-foreground">Organization data only. Open a workspace to inspect its users, plan, and status.</p></div><div className="relative w-full sm:w-72"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search organizations" value={search} onChange={(event) => setSearch(event.target.value)} /></div></CardHeader><CardContent><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{(organizations.data ?? []).map((item) => <Link key={item.organization_id} href={`/platform/organizations/${item.organization_id}`} className="block"><Card className="h-full transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md"><CardContent className="space-y-4 p-5"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700"><Building2 className="h-5 w-5" /></div><div className="min-w-0"><p className="truncate font-semibold text-slate-800">{item.name}</p><p className="truncate text-xs text-muted-foreground">/{item.slug}</p></div></div><Badge variant="outline">{item.status}</Badge></div><div className="grid grid-cols-2 gap-3 text-xs"><div><p className="text-muted-foreground">Users</p><p className="font-semibold text-slate-700">{item.user_count}</p></div><div><p className="text-muted-foreground">Plan</p><p className="font-semibold text-slate-700">{item.plan_code}</p></div><div><p className="text-muted-foreground">Subscription</p><p className="font-semibold text-slate-700">{item.subscription_status ?? "Not configured"}</p></div><div><p className="text-muted-foreground">Created</p><p className="font-semibold text-slate-700">{formatDate(item.created_at)}</p></div></div></CardContent></Card></Link>)}{!organizations.isLoading && (organizations.data ?? []).length === 0 && <p className="py-10 text-center text-sm text-muted-foreground md:col-span-2 xl:col-span-3">No registered organizations found.</p>}</div></CardContent></Card></div>;
}
