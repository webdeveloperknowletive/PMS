"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, ShieldAlert } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { useAuthStore } from "@/store/auth-store";
import { useEventReminders } from "@/hooks/use-event-reminders";
import { ChatWidget } from "@/components/layout/chat-widget";
import { usePermissions } from "@/hooks/use-permissions";
import { canAccessModule } from "@/lib/permissions";
import { PlatformShell } from "@/components/layout/platform-shell";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { isAuthenticated, isInitializing } = useAuthStore();
  const permissions = usePermissions();

  useEventReminders(); // polls for upcoming events across the whole app while a session is active

  useEffect(() => {
    if (!isInitializing && !isAuthenticated) {
      router.replace(pathname.startsWith("/platform") ? "/platform/login" : "/login");
    }
  }, [isInitializing, isAuthenticated, router]);

  if (isInitializing) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) return null;
  const accessDenied = !permissions.isLoading && !canAccessModule(pathname, permissions.permissionCodes);

  if (pathname.startsWith("/platform")) {
    return <PlatformShell>{children}</PlatformShell>;
  }
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header onMenuClick={() => setMobileNavOpen(true)} />
        <main className="min-h-0 flex-1 overflow-y-auto scrollbar-thin [scrollbar-gutter:stable] px-4 py-5 sm:px-6 sm:py-7 xl:px-9">
          <div className="mx-auto min-h-full w-full max-w-[1600px]">{accessDenied ? <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card py-24 text-center"><ShieldAlert className="mb-4 h-8 w-8 text-destructive" /><h1 className="text-base font-semibold">Access restricted</h1><p className="mt-1 max-w-sm text-sm text-muted-foreground">Your assigned role does not include access to this module.</p></div> : children}</div>
        </main>
      </div>
      {permissions.permissionCodes.includes("modules.chat.access") && <ChatWidget />}
    </div>
  );
}
