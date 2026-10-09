"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard, FolderKanban, CheckSquare, Users, Flag, Calendar, FileText,
  KanbanSquare, GanttChartSquare, BarChart3, Sparkles, ListChecks, ShieldAlert,
  FileStack, MessageSquareText, Bell, ShieldCheck, UserCog, Settings, Workflow,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsAdmin } from "@/hooks/use-is-admin";

const CORE_MODULES = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Projects", href: "/projects", icon: FolderKanban },
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
  { label: "Sprint Planning", href: "/ai/sprint-planning", icon: Sparkles },
  { label: "Task Estimation", href: "/ai/task-estimation", icon: ListChecks },
  { label: "Risk Prediction", href: "/ai/risk-prediction", icon: ShieldAlert },
  { label: "AI Documentation", href: "/ai/doc-generator", icon: FileStack },
  { label: "Meeting Summary", href: "/ai/meeting-summary", icon: MessageSquareText },
];

const ADMIN_MODULES = [
  { label: "Roles & Permissions", href: "/roles", icon: ShieldCheck },
  { label: "Users", href: "/users", icon: UserCog },
];

function NavLink({ href, label, icon: Icon, onClick }: {
  href: string; label: string; icon: LucideIcon; onClick?: () => void;
}) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link href={href} onClick={onClick} aria-current={isActive ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200",
        isActive
          ? "bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-lg shadow-indigo-950/20"
          : "text-slate-300 hover:bg-white/[0.07] hover:text-white"
      )}>
      <Icon className={cn("h-[17px] w-[17px] shrink-0 transition-colors", isActive ? "text-white" : "text-slate-400 group-hover:text-violet-200")} />
      <span className="truncate">{label}</span>
      {isActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white/80" />}
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="px-3 pb-2 pt-6 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{children}</p>;
}

export function Sidebar({ open = false, onClose }: { open?: boolean; onClose?: () => void }) {
  const { isAdmin } = useIsAdmin();
  const close = () => onClose?.();

  return (
    <>
      {open && <button aria-label="Close navigation" onClick={close} className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm lg:hidden" />}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 flex h-screen w-[276px] shrink-0 flex-col border-r border-white/[0.06] bg-[linear-gradient(165deg,#1d2141_0%,#171b36_48%,#14182f_100%)] shadow-2xl shadow-slate-950/20 transition-transform duration-300 lg:static lg:z-auto lg:translate-x-0 lg:shadow-none",
        open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="flex h-[76px] shrink-0 items-center justify-between border-b border-white/[0.07] px-5">
          <Link href="/dashboard" onClick={close} className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-2xl bg-white p-0.5 shadow-lg shadow-violet-950/40 ring-1 ring-white/20">
              <img src="/sprintix-logo-hd.png" alt="SprintIX logo" className="h-full w-full rounded-[14px] object-contain" />
            </div>
            <div className="leading-tight">
              <p className="text-[15px] font-bold tracking-wide text-white">SprintIX</p>
              <p className="mt-1 text-[10px] font-medium tracking-wide text-slate-400">PROJECT WORKSPACE</p>
            </div>
          </Link>
          <button aria-label="Close navigation" onClick={close} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden"><X className="h-4 w-4" /></button>
        </div>

        <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 pb-5 pt-3">
          <div className="space-y-1"><NavLink {...CORE_MODULES[0]} onClick={close} /></div>
          <SectionLabel>Workspace</SectionLabel>
          <div className="space-y-1">{CORE_MODULES.slice(1).map((item) => <NavLink key={item.href} {...item} onClick={close} />)}</div>
          <SectionLabel>AI Studio</SectionLabel>
          <div className="space-y-1">{AI_MODULES.map((item) => <NavLink key={item.href} {...item} onClick={close} />)}</div>
          <SectionLabel>Updates</SectionLabel>
          <div className="space-y-1"><NavLink href="/notifications" label="Notifications" icon={Bell} onClick={close} /></div>
          {isAdmin && <>
            <SectionLabel>Administration</SectionLabel>
            <div className="space-y-1">{ADMIN_MODULES.map((item) => <NavLink key={item.href} {...item} onClick={close} />)}</div>
          </>}
        </nav>

        <div className="shrink-0 border-t border-white/[0.07] p-3">
          <NavLink href="/settings" label="Settings" icon={Settings} onClick={close} />
          <div className="mt-3 flex items-center gap-3 rounded-xl bg-white/[0.045] px-3 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-indigo-500 text-xs font-bold text-white">IX</div>
            <div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-200">Your team, in sync</p><p className="mt-0.5 text-[10px] text-slate-500">Plan · Track · Deliver</p></div>
          </div>
        </div>
      </aside>
    </>
  );
}
