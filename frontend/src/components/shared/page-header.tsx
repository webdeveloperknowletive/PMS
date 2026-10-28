"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Home, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/use-permissions";

export function PageHeader({
  title,
  description,
  actions,
  showHome = true,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  showHome?: boolean;
}) {
  const { roleNames } = usePermissions();
  const isProjectManager = roleNames.some((role) => role.trim().toLowerCase() === "project manager");

  return (
    <div className="page-banner animate-enter">
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-violet-600">
          <Sparkles className="h-3.5 w-3.5" /> Project workspace
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-slate-600">{description}</p>}
      </div>
      <div className="relative z-10 flex shrink-0 items-center gap-2">
        {showHome && !isProjectManager && <Button asChild variant="outline" size="sm" aria-label="Go to home dashboard">
          <Link href="/dashboard"><Home className="h-4 w-4" /> Home</Link>
        </Button>}
        {actions}
      </div>
    </div>
  );
}
