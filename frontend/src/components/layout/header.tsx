"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Search, LogOut, UserRound, ChevronDown, Menu, ArrowUpRight, Command, Home } from "lucide-react";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { useQuery } from "@tanstack/react-query";
import { notificationSettingsApi, notificationsApi } from "@/lib/api/notifications";
import { NOTIFICATIONS_KEY } from "@/hooks/queries/use-notifications";
import Link from "next/link";
import { toast } from "sonner";
import { enableNotificationSound, playNotificationSound } from "@/lib/notification-sound";
import { chatApi } from "@/lib/api/chat";
import { canAccessModule } from "@/lib/permissions";

const DESTINATIONS = [
  { label: "Dashboard", description: "Your project overview", href: "/dashboard", group: "Workspace" },
  { label: "Projects", description: "Manage project spaces", href: "/projects", group: "Workspace" },
  { label: "Tasks", description: "Track assignments and delivery", href: "/tasks", group: "Workspace" },
  { label: "Teams", description: "People and responsibilities", href: "/teams", group: "Workspace" },
  { label: "Milestones", description: "Key dates and outcomes", href: "/milestones", group: "Planning" },
  { label: "Calendar", description: "Events and due dates", href: "/calendar", group: "Planning" },
  { label: "Workflow", description: "Project workflow templates", href: "/workflow", group: "Planning" },
  { label: "Kanban Board", description: "Move work across stages", href: "/kanban", group: "Planning" },
  { label: "Gantt Chart", description: "Plan task timelines", href: "/gantt", group: "Planning" },
  { label: "Documentation", description: "Project documents", href: "/documentation", group: "Collaboration" },
  { label: "Reports", description: "Project reporting", href: "/reports", group: "Collaboration" },
  { label: "Notifications", description: "Recent updates", href: "/notifications", group: "Collaboration" },
  { label: "AI Sprint Planning", description: "Sprint plans and history", href: "/ai/sprint-planning", group: "AI Studio" },
  { label: "AI Task Estimation", description: "Effort estimates and history", href: "/ai/task-estimation", group: "AI Studio" },
  { label: "AI Risk Prediction", description: "Project risk register", href: "/ai/risk-prediction", group: "AI Studio" },
  { label: "AI Documentation", description: "Draft project documents", href: "/ai/doc-generator", group: "AI Studio" },
  { label: "AI Meeting Summary", description: "Meeting notes and actions", href: "/ai/meeting-summary", group: "AI Studio" },
  { label: "Roles & Permissions", description: "Access management", href: "/roles", group: "Administration" },
  { label: "Users", description: "People directory", href: "/users", group: "Administration" },
  { label: "Organization", description: "Workspace and trial settings", href: "/organization", group: "Administration" },
  { label: "Settings", description: "Your profile and preferences", href: "/settings", group: "Account" },
];

export function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { roleNames, permissionCodes, isLoading: rolesLoading } = usePermissions();
  const displayedRole = roleNames.length ? roleNames.join(", ") : rolesLoading ? "Loading role..." : "No role assigned";
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [chatWindowOpen, setChatWindowOpen] = useState(false);
  const seenNotifications = useRef<{ userId: string; ids: Set<string> } | null>(null);

  useEffect(() => {
    const onChatWindowState = (event: Event) => setChatWindowOpen((event as CustomEvent<boolean>).detail);
    window.addEventListener("chat-window-state", onChatWindowState);
    return () => window.removeEventListener("chat-window-state", onChatWindowState);
  }, []);

  const { data: notifications } = useQuery({
    queryKey: [NOTIFICATIONS_KEY, user?.user_id],
    queryFn: () => notificationsApi.list({ limit: 500 }),
    // The API returns only the signed-in user's personal notification feed.
    enabled: !!user,
    refetchInterval: 1_500,
    select: (data) => data.filter((n) => !n.is_read && n.user_id === user?.user_id),
  });
  const { data: toastDurationSetting } = useQuery({
    queryKey: ["notification-toast-duration"],
    queryFn: notificationSettingsApi.getToastDuration,
    enabled: !!user && permissionCodes.includes("notifications.settings.view"),
  });
  const { data: notificationSoundSetting } = useQuery({
    queryKey: ["notification-sound-setting"],
    queryFn: notificationSettingsApi.getSound,
    enabled: !!user && permissionCodes.includes("notifications.settings.view"),
    refetchInterval: 30_000,
  });
  const { data: notificationVolumeSetting } = useQuery({
    queryKey: ["notification-volume-setting", user?.user_id],
    queryFn: notificationSettingsApi.getVolume,
    enabled: !!user && permissionCodes.includes("notifications.personal_settings.view"),
    refetchInterval: 30_000,
  });
  const { data: chatSettings } = useQuery({
    queryKey: ["chat-settings", user?.user_id],
    queryFn: chatApi.settings,
    enabled: !!user && permissionCodes.includes("chat.settings.view"),
    refetchInterval: 30_000,
  });
  const { data: chatOrganizationSettings } = useQuery({
    queryKey: ["chat-organization-settings"],
    queryFn: chatApi.organizationSettings,
    enabled: !!user && permissionCodes.includes("chat.organization_settings.view"),
    refetchInterval: 30_000,
  });
  const unreadCount = notifications?.length ?? 0;

  useEffect(() => {
    if (!user || !notifications || !toastDurationSetting) return;
    if (seenNotifications.current?.userId !== user.user_id) {
      seenNotifications.current = { userId: user.user_id, ids: new Set(notifications.map((n) => n.notification_id)) };
      return;
    }
    const seen = seenNotifications.current.ids;
    const arrived = notifications.filter((notification) => !seen.has(notification.notification_id));
    if (arrived.length > 0) {
      if (arrived.some((notification) => notification.notification_type.startsWith("Chat ")) && chatSettings && chatOrganizationSettings) {
        const chatCount = arrived.filter((notification) => notification.notification_type.startsWith("Chat ")).length;
        playNotificationSound(
          chatOrganizationSettings.sound_key as Parameters<typeof playNotificationSound>[0],
          Math.min(chatOrganizationSettings.master_volume_percent, 150) * chatSettings.volume_percent / 100,
        );
        if (chatCount < arrived.length && notificationSoundSetting && notificationVolumeSetting) {
          playNotificationSound(notificationSoundSetting.sound_key as Parameters<typeof playNotificationSound>[0], notificationVolumeSetting.volume_percent);
        }
      } else if (notificationSoundSetting && notificationVolumeSetting) {
        playNotificationSound(
          notificationSoundSetting.sound_key as Parameters<typeof playNotificationSound>[0],
          notificationVolumeSetting.volume_percent,
        );
      }
      arrived.forEach((notification) => {
        toast(notification.title, {
          description: notification.message,
          duration: toastDurationSetting.duration_seconds * 1000,
          position: chatWindowOpen ? "top-left" : "top-right",
        });
        seen.add(notification.notification_id);
      });
    }
  }, [notifications, notificationSoundSetting, notificationVolumeSetting, chatSettings, chatOrganizationSettings, toastDurationSetting, user, chatWindowOpen]);
  const destinations = useMemo(() => {
    const query = search.trim().toLowerCase();
    return DESTINATIONS.filter((item) => canAccessModule(item.href, permissionCodes) && (!query || `${item.label} ${item.description} ${item.group}`.toLowerCase().includes(query)));
  }, [search, permissionCodes]);

  useEffect(() => {
    window.addEventListener("pointerdown", enableNotificationSound, { once: true });
    window.addEventListener("keydown", enableNotificationSound, { once: true });
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", enableNotificationSound);
      window.removeEventListener("keydown", enableNotificationSound);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const goTo = (href: string) => {
    setSearchOpen(false);
    setSearch("");
    router.push(href);
  };

  return (
    <>
      <header className="z-30 flex h-[72px] shrink-0 items-center justify-between gap-3 border-b border-slate-200/70 bg-white/85 px-4 backdrop-blur-xl sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Button variant="ghost" size="icon" aria-label="Open navigation" className="shrink-0 lg:hidden" onClick={onMenuClick}>
            <Menu className="h-5 w-5" />
          </Button>
          <Link href="/dashboard" aria-label="Go to home dashboard" title="Home" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400">
            <Home className="h-[18px] w-[18px]" />
          </Link>
          <button type="button" onClick={() => setSearchOpen(true)} className="group flex h-10 w-full max-w-[540px] items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 text-left text-sm text-slate-500 shadow-inner shadow-white transition hover:border-violet-200 hover:bg-white hover:shadow-sm">
            <Search className="h-4 w-4 text-slate-400 group-hover:text-violet-500" />
            <span className="flex-1 truncate">Search anything in SprintIX...</span>
            <kbd className="hidden items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-500 sm:inline-flex"><Command className="h-3 w-3" /> K</kbd>
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 rounded-xl p-1.5 outline-none transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-violet-300">
              <UserAvatar user={user} showName={false} size="md" />
              <div className="hidden max-w-40 text-left leading-tight md:block">
                <p className="truncate text-[13px] font-semibold text-slate-800">{user?.name ?? "Loading..."}</p>
                <p className="mt-1 truncate text-[11px] font-bold text-violet-700" title={displayedRole}>{displayedRole}</p>
              </div>
              <ChevronDown className="hidden h-4 w-4 text-slate-400 md:block" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2">
              <DropdownMenuLabel className="px-3 py-2"><span className="block text-sm font-semibold">{user?.name}</span><span className="mt-1 block truncate text-xs font-bold text-violet-700">{displayedRole}</span><span className="mt-1 block truncate text-xs font-normal text-muted-foreground">{user?.email}</span></DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild><Link href="/settings"><UserRound /> Profile & settings <ArrowUpRight className="ml-auto h-3.5 w-3.5" /></Link></DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => logout()} className="text-destructive focus:text-destructive"><LogOut /> Log out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Link href="/notifications" aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"} title="Notifications" className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400">
            <Bell className="h-[18px] w-[18px]" />
            {unreadCount > 0 && <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-rose-500 px-1 text-[9px] font-bold leading-none text-white">{unreadCount > 99 ? "99+" : unreadCount}</span>}
          </Link>
        </div>
      </header>

      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="top-[14%] max-w-xl translate-y-0 overflow-hidden rounded-2xl border-slate-200 p-0 shadow-2xl">
          <DialogTitle className="sr-only">Search workspace</DialogTitle>
          <DialogDescription className="sr-only">Find a page or module in your workspace.</DialogDescription>
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
            <Search className="h-5 w-5 text-violet-500" />
            <Input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search projects, tasks, modules..." className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:border-0 focus-visible:ring-0" />
            <kbd className="rounded-md border bg-slate-50 px-1.5 py-1 text-[10px] text-slate-500">ESC</kbd>
          </div>
          <div className="max-h-[55vh] overflow-y-auto p-2">
            {destinations.length ? destinations.map((item) => (
              <button key={item.href} type="button" onClick={() => goTo(item.href)} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-violet-50 focus:bg-violet-50 focus:outline-none">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-violet-700"><ArrowUpRight className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-800">{item.label}</span><span className="mt-0.5 block truncate text-xs text-slate-500">{item.description}</span></span>
                <span className="hidden text-[10px] font-semibold uppercase tracking-wide text-slate-400 sm:block">{item.group}</span>
              </button>
            )) : <p className="px-4 py-10 text-center text-sm text-muted-foreground">No pages match “{search}”.</p>}
          </div>
          <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50/80 px-5 py-3 text-[11px] text-slate-500"><Search className="h-3.5 w-3.5" /> Search all workspace modules</div>
        </DialogContent>
      </Dialog>
    </>
  );
}
