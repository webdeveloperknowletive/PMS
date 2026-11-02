"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth-store";

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
  const roleNames = useAuthStore((state) => state.user?.role_names ?? []);
  const isProjectManager = roleNames.some((role) => role.trim().toLowerCase() === "project manager");
  const isPlatformAdmin = roleNames.some((role) => role.trim().toLowerCase() === "super admin");

  return (
    <div className="flex flex-col justify-between gap-3 border-b border-[#dfe1e6] pb-4 sm:flex-row sm:items-end">
      <div>
        <p className="mb-1 text-xs text-[#626f86]">{isPlatformAdmin ? "Platform administration" : "SprintIX / Project"}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-[#172b4d] sm:text-[26px]">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-[#626f86]">{description}</p>}
      </div>
      <div className="relative z-10 flex shrink-0 items-center gap-2">
        {showHome && !isProjectManager && !isPlatformAdmin && <Button asChild variant="outline" size="sm" aria-label="Go to home dashboard" className="rounded-md">
          <Link href="/dashboard"><Home className="h-4 w-4" /> Home</Link>
        </Button>}
        {actions}
      </div>
    </div>
  );
}
