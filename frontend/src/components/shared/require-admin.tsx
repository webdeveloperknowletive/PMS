"use client";

import { ShieldAlert } from "lucide-react";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { Skeleton } from "@/components/ui/skeleton";

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { isAdmin, isLoading } = useIsAdmin();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-24 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <ShieldAlert className="h-6 w-6 text-destructive" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">Access restricted</h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          This page is only available to administrators.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}