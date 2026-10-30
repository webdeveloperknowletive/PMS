"use client";

import Link from "next/link";
import { useState } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { useAuthStore } from "@/store/auth-store";
import { platformApi } from "@/lib/api/platform";
import { formatDate } from "@/lib/utils";

export default function PlatformSubscriptionsPage() {
  const roleNames = useAuthStore((state) => state.user?.role_names ?? []);
  const isSuperAdmin = roleNames.some((role) => role.trim().toLowerCase() === "super admin");
  const [plan, setPlan] = useState("");
  const [status, setStatus] = useState("");
  const [skip, setSkip] = useState(0);
  const limit = 50;
  const subscriptions = useQuery({
    queryKey: ["platform-subscriptions", plan, status, skip],
    queryFn: () => platformApi.subscriptions({ plan_code: plan || undefined, subscription_status: status || undefined, skip, limit }),
    enabled: isSuperAdmin,
  });
  const plans = useQuery({ queryKey: ["platform-plans"], queryFn: platformApi.plans, enabled: isSuperAdmin });

  if (!isSuperAdmin) return <div className="flex flex-col items-center justify-center py-24 text-center"><ShieldAlert className="mb-4 h-8 w-8 text-destructive" /><h1 className="font-semibold">Platform access restricted</h1></div>;
  if (subscriptions.isLoading) return <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return <div className="space-y-6">
    <PageHeader title="Plans & subscriptions" description="Subscription records associated with registered organizations." />
    <Card><CardHeader><CardTitle className="text-base">Subscription catalog summary</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-2">{(plans.data ?? []).map((item) => <Badge key={`${item.plan_code}-${item.subscription_status}`} variant="secondary">{item.plan_code} · {item.subscription_status}: {item.organization_count}</Badge>)}{plans.isError && <p className="text-sm text-destructive">Plan summary is unavailable.</p>}{plans.data?.length === 0 && <p className="text-sm text-muted-foreground">No subscription records are configured.</p>}</CardContent></Card>
    <Card><CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle className="text-base">Organization subscriptions</CardTitle><p className="mt-1 text-xs text-muted-foreground">Billing actions and payment history are not available in this view.</p></div><div className="grid gap-2 sm:grid-cols-2"><select aria-label="Filter by plan" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={plan} onChange={(event) => { setPlan(event.target.value); setSkip(0); }}><option value="">All plans</option>{Array.from(new Set((plans.data ?? []).map((item) => item.plan_code))).map((value) => <option key={value} value={value}>{value}</option>)}</select><select aria-label="Filter by subscription status" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={status} onChange={(event) => { setStatus(event.target.value); setSkip(0); }}><option value="">All statuses</option>{Array.from(new Set((plans.data ?? []).map((item) => item.subscription_status))).map((value) => <option key={value} value={value}>{value}</option>)}</select></div></CardHeader><CardContent>{subscriptions.isError ? <p className="py-10 text-center text-sm text-destructive">Subscriptions could not be loaded. Refresh to try again.</p> : <><div className="space-y-3">{(subscriptions.data?.items ?? []).map((item) => <div key={item.subscription_id} className="flex flex-col justify-between gap-3 rounded-xl border p-4 sm:flex-row sm:items-center"><div><Link className="font-semibold text-primary hover:underline" href={`/platform/organizations/${item.organization_id}`}>{item.organization_name}</Link><p className="text-xs text-muted-foreground">/{item.organization_slug} · {item.plan_code}</p></div><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{item.status}</Badge><span className="text-xs text-muted-foreground">Trial ends: {item.trial_ends_at ? formatDate(item.trial_ends_at) : "Unavailable"}</span><span className="text-xs text-muted-foreground">Period ends: {item.period_ends_at ? formatDate(item.period_ends_at) : "Unavailable"}</span><span className="text-xs text-muted-foreground">{item.cancel_at_period_end ? "Cancels at period end" : "No scheduled cancellation"}</span></div></div>)}{!subscriptions.data?.items.length && <p className="py-10 text-center text-sm text-muted-foreground">No subscriptions match these filters.</p>}</div><div className="mt-5 flex items-center justify-between border-t pt-4 text-sm"><p className="text-muted-foreground">Showing {subscriptions.data?.items.length ?? 0} of {subscriptions.data?.total ?? 0} subscriptions</p><div className="flex gap-2"><Button size="sm" variant="outline" disabled={skip === 0} onClick={() => setSkip(Math.max(0, skip - limit))}>Previous</Button><Button size="sm" variant="outline" disabled={skip + limit >= (subscriptions.data?.total ?? 0)} onClick={() => setSkip(skip + limit)}>Next</Button></div></div></>}</CardContent></Card>
  </div>;
}
