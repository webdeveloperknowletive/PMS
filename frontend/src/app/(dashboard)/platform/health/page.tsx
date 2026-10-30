"use client";

import { Activity, Loader2, ShieldAlert } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { useAuthStore } from "@/store/auth-store";
import { platformApi } from "@/lib/api/platform";
import { formatDate, formatTime } from "@/lib/utils";

function healthLabel(value: string) {
  if (value === "healthy" || value === "configured") return "Healthy";
  if (value === "not_configured") return "Not configured";
  return "Unavailable";
}

export default function PlatformHealthPage() {
  const roleNames = useAuthStore((state) => state.user?.role_names ?? []);
  const isSuperAdmin = roleNames.some((role) => role.trim().toLowerCase() === "super admin");
  const health = useQuery({ queryKey: ["platform-health"], queryFn: platformApi.health, enabled: isSuperAdmin, refetchInterval: 30_000 });
  if (!isSuperAdmin) return <div className="flex flex-col items-center justify-center py-24 text-center"><ShieldAlert className="mb-4 h-8 w-8 text-destructive" /><h1 className="font-semibold">Platform access restricted</h1></div>;
  if (health.isLoading) return <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  return <div className="space-y-6"><PageHeader title="Platform health" description="Current status of the checks exposed by the platform API." />
    {health.isError ? <Card><CardContent className="py-12 text-center text-sm text-destructive">Health status could not be loaded. Refresh to try again.</CardContent></Card> : <>
      <div className="grid gap-4 md:grid-cols-3">{(["api", "database", "email_provider"] as const).map((key) => <Card key={key}><CardHeader><CardTitle className="flex items-center justify-between text-base"><span className="flex items-center gap-2"><Activity className="h-4 w-4 text-violet-600" />{key === "email_provider" ? "Email provider" : key === "api" ? "API" : "Database"}</span><Badge variant={health.data?.[key] === "unavailable" ? "destructive" : "outline"}>{healthLabel(health.data?.[key] ?? "unavailable")}</Badge></CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">{key === "email_provider" && health.data?.email_provider === "not_configured" ? "No email provider is configured." : health.data?.[key] === "unavailable" ? "The health check could not confirm availability." : "Status reported by the platform health endpoint."}</CardContent></Card>)}</div>
      <p className="text-xs text-muted-foreground">Last checked: {health.data?.checked_at ? `${formatDate(health.data.checked_at)} at ${formatTime(health.data.checked_at)}` : "Unavailable"} · Refreshes automatically every 30 seconds.</p>
    </>}
  </div>;
}
