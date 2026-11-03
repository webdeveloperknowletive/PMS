"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard, FolderKanban, CheckSquare, Users, Flag, Calendar, FileText, Activity,
  KanbanSquare, GanttChartSquare, BarChart3, Sparkles, ListChecks, ShieldAlert, IterationCw,
  FileStack, MessageSquareText, Bell, ShieldCheck, UserCog, Settings, Workflow, Building2,
  X, ChevronDown,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import { useCurrentOrganization } from "@/hooks/queries/use-organizations";
import { canAccessModule } from "@/lib/permissions";

const CORE_MODULES = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Projects", href: "/projects", icon: FolderKanban },
  { label: "Sprint Planning", href: "/sprint-planning", icon: IterationCw },
  { label: "Tasks", href: "/tasks", icon: CheckSquare },
  { label: "Teams", href: "/teams", icon: Users },
  { label: "Milestones", href: "/milestones", icon: Flag },
  { label: "Calendar", href: "/calendar", icon: Calendar },
  { label: "Documentation", href: "/documentation", icon: FileText },
  { label: "Workflow", href: "/workflow", icon: Workflow },
  { label: "Kanban Board", href: "/kanban", icon: KanbanSquare },
  { label: "Gantt Chart", href: "/gantt", icon: GanttChartSquare },
  { label: "Reports", href: "/reports", icon: BarChart3 },
];

const AI_MODULES = [
  { label: "AI Sprint Planning", href: "/ai/sprint-planning", icon: Sparkles },
  { label: "Task Estimation", href: "/ai/task-estimation", icon: ListChecks },
  { label: "Risk Prediction", href: "/ai/risk-prediction", icon: ShieldAlert },
  { label: "AI Documentation", href: "/ai/doc-generator", icon: FileStack },
  { label: "Meeting Summary", href: "/ai/meeting-summary", icon: MessageSquareText },
];

const ADMIN_MODULES = [
  { label: "Roles & Permissions", href: "/roles", icon: ShieldCheck },
  { label: "Users", href: "/users", icon: UserCog },
  { label: "Audit Log", href: "/audit-logs", icon: Activity },
];
const ORGANIZATION_MODULE = { label: "Organization", href: "/organization", icon: Building2 };
const PLATFORM_MODULE = { label: "Platform administration", href: "/platform", icon: Building2 };

function NavLink({ href, label, icon: Icon, onClick }: {
  href: string; label: string; icon: LucideIcon; onClick?: () => void;
}) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link href={href} onClick={onClick} aria-current={isActive ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium transition-colors",
        isActive
          ? "bg-[#e9f2ff] text-[#0c66e4]"
          : "text-[#44546f] hover:bg-[#f1f2f4] hover:text-[#172b4d]"
      )}>
      <Icon className={cn("h-[17px] w-[17px] shrink-0 transition-colors", isActive ? "text-[#0c66e4]" : "text-[#626f86]")} />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="px-3 pb-1 pt-5 text-[11px] font-semibold text-[#626f86]">{children}</p>;
}

export function Sidebar({ open = false, onClose }: { open?: boolean; onClose?: () => void }) {
  const permissions = usePermissions();
  const { canManageOrganization } = permissions;
  const isPlatformAdmin = permissions.roleNames.some((role) => role.trim().toLowerCase() === "super admin");
  const { data: organization } = useCurrentOrganization();
  const close = () => onClose?.();
  const canOpen = (href: string) => canAccessModule(href, permissions.permissionCodes);
  const firstAvailableHref = [...CORE_MODULES.slice(1), ...AI_MODULES, ...ADMIN_MODULES, ORGANIZATION_MODULE]
    .find((item) => canOpen(item.href))?.href ?? "/dashboard";
  const homeHref = canOpen("/dashboard") ? "/dashboard" : firstAvailableHref;

  return (
    <>
      {open && <button aria-label="Close navigation" onClick={close} className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden" />}
      <aside className={cn(
        "sidebar-shell fixed inset-y-0 left-0 z-50 flex h-screen w-[252px] shrink-0 flex-col border-r border-[#dfe1e6] bg-[#f7f8f9] shadow-xl transition-transform duration-300 lg:static lg:z-auto lg:translate-x-0 lg:shadow-none",
        open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="flex h-[56px] shrink-0 items-center justify-between border-b border-[#dfe1e6] px-4">
          <Link href={homeHref} onClick={close} className="flex items-center gap-3">
            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md bg-white p-0.5 ring-1 ring-[#dfe1e6]">
              <img src="/sprintix-logo-hd.png" alt="SprintIX logo" className="h-full w-full rounded object-contain" />
            </div>
            <div className="leading-tight">
              <p className="text-[15px] font-bold text-[#172b4d]">SprintIX</p>
              <p className="mt-0.5 text-[10px] font-medium text-[#626f86]">Software project</p>
            </div>
          </Link>
          <button aria-label="Close navigation" onClick={close} className="rounded-md p-2 text-[#626f86] hover:bg-[#e9edf2] lg:hidden"><X className="h-4 w-4" /></button>
        </div>

        <nav className="sidebar-scrollbar flex-1 overflow-y-auto px-3 pb-5 pt-3" aria-label="Workspace navigation">
          <div className="mb-3 flex items-center justify-between rounded-md px-3 py-2 text-sm font-semibold text-[#172b4d]"><span className="truncate">{organization?.name ?? "Workspace"}</span><ChevronDown className="h-4 w-4 shrink-0 text-[#626f86]" /></div>
          {canOpen(CORE_MODULES[0].href) && <div className="space-y-1"><NavLink {...CORE_MODULES[0]} onClick={close} /></div>}
          <SectionLabel>Project</SectionLabel>
          <div className="space-y-1">{CORE_MODULES.slice(1).filter((item) => canOpen(item.href)).map((item) => <NavLink key={item.href} {...item} onClick={close} />)}</div>
          {AI_MODULES.some((item) => canOpen(item.href)) && <><SectionLabel>AI Studio</SectionLabel>
          <div className="space-y-1">{AI_MODULES.filter((item) => canOpen(item.href)).map((item) => <NavLink key={item.href} {...item} onClick={close} />)}</div></>}
          <SectionLabel>Updates</SectionLabel>
          {canOpen("/notifications") && <div className="space-y-1"><NavLink href="/notifications" label="Notifications" icon={Bell} onClick={close} /></div>}
          {ADMIN_MODULES.some((item) => canOpen(item.href)) && <>
            <SectionLabel>Administration</SectionLabel>
            <div className="space-y-1">{ADMIN_MODULES.filter((item) => canOpen(item.href)).map((item) => <NavLink key={item.href} {...item} onClick={close} />)}</div>
          </>}
          {canManageOrganization && canOpen(ORGANIZATION_MODULE.href) && <>
            <SectionLabel>Workspace settings</SectionLabel>
            <div className="space-y-1"><NavLink {...ORGANIZATION_MODULE} onClick={close} /></div>
          </>}
          {isPlatformAdmin && <>
            <SectionLabel>Platform administration</SectionLabel>
            <div className="space-y-1"><NavLink {...PLATFORM_MODULE} onClick={close} /></div>
          </>}
        </nav>

        <div className="shrink-0 border-t border-[#dfe1e6] p-3">
          <NavLink href="/settings" label="Settings" icon={Settings} onClick={close} />
          <div className="mt-2 flex items-center gap-3 rounded-md bg-white px-3 py-2 ring-1 ring-[#dfe1e6]">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[#deebff] text-xs font-bold text-[#0c66e4]">{organization?.name?.slice(0, 2).toUpperCase() ?? "IX"}</div>
            <div className="min-w-0"><p className="text-[10px] text-[#626f86]">Workspace</p><p className="truncate text-xs font-semibold text-[#172b4d]" title={organization?.name}>{organization?.name ?? "Loading organization…"}</p></div>
          </div>
        </div>
      </aside>
    </>
  );
}
