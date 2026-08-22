"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Users,
  Flag,
  Calendar,
  FileText,
  KanbanSquare,
  GanttChartSquare,
  BarChart3,
  Sparkles,
  ListChecks,
  ShieldAlert,
  FileStack,
  MessageSquareText,
  Bell,
  ShieldCheck,
  UserCog,
  Settings,
  Workflow,
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
  { label: "AI Sprint Planning", href: "/ai/sprint-planning", icon: Sparkles },
  { label: "AI Task Estimation", href: "/ai/task-estimation", icon: ListChecks },
  { label: "AI Risk Prediction", href: "/ai/risk-prediction", icon: ShieldAlert },
  { label: "AI Documentation", href: "/ai/doc-generator", icon: FileStack },
  { label: "AI Meeting Summary", href: "/ai/meeting-summary", icon: MessageSquareText },
];

// These are only shown to admins (see useIsAdmin — heuristic based on role name containing "admin").
const ADMIN_ONLY_MODULES = [
  { label: "Roles & Permissions", href: "/roles", icon: ShieldCheck },
  { label: "Users", href: "/users", icon: UserCog },
];

function NavLink({ href, label, icon: Icon }: { href: string; label: string; icon: typeof LayoutDashboard }) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-sidebar-active text-sidebar-active-foreground"
          : "text-sidebar-foreground hover:bg-muted"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{children}</p>;
}

export function Sidebar() {
  const { isAdmin } = useIsAdmin();

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-purple-500">
          <FolderKanban className="h-4 w-4 text-white" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-bold text-foreground">PMS</p>
          <p className="text-[10px] text-muted-foreground">Project Management System</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 pb-4">
        <div className="space-y-0.5">
          {CORE_MODULES.slice(0, 1).map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </div>

        <SectionLabel>Core Modules</SectionLabel>
        <div className="space-y-0.5">
          {CORE_MODULES.slice(1).map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </div>

        <SectionLabel>AI Modules</SectionLabel>
        <div className="space-y-0.5">
          {AI_MODULES.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </div>

        <SectionLabel>Notifications</SectionLabel>
        <div className="space-y-0.5">
          <NavLink href="/notifications" label="Notifications" icon={Bell} />
        </div>

        {isAdmin && (
          <>
            <SectionLabel>System</SectionLabel>
            <div className="space-y-0.5">
              {ADMIN_ONLY_MODULES.map((item) => (
                <NavLink key={item.href} {...item} />
              ))}
            </div>
          </>
        )}
      </nav>

      <div className="border-t border-border p-3">
        <NavLink href="/settings" label="Settings" icon={Settings} />
      </div>
    </aside>
  );
}