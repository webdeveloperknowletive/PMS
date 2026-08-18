"use client";

import { Bell, Search, LogOut, User as UserIcon, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { getInitials, stringToColor } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { notificationsApi } from "@/lib/api/notifications";
import { NOTIFICATIONS_KEY } from "@/hooks/queries/use-notifications";
import Link from "next/link";

export function Header() {
  const { user, logout } = useAuth();

  // Same key + queryFn as useNotifications() in hooks/queries/use-notifications.ts —
  // React Query dedupes this into one shared fetch instead of two separate calls.
  const { data: notifications } = useQuery({
    queryKey: [NOTIFICATIONS_KEY, user?.user_id],
    queryFn: () => notificationsApi.list({ limit: 500 }),
    enabled: !!user,
    select: (data) => data.filter((n) => !n.is_read && n.user_id === user?.user_id),
  });

  const unreadCount = notifications?.length ?? 0;

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-background px-6">
      <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search (Ctrl + K)" className="pl-9" />
      </div>

      <div className="flex items-center gap-4">
        <Link
          href="/notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg px-2 py-1.5 outline-none hover:bg-muted">
            <Avatar className="h-8 w-8">
              <AvatarFallback style={{ backgroundColor: stringToColor(user?.name ?? "?") }}>
                {getInitials(user?.name)}
              </AvatarFallback>
            </Avatar>
            <div className="hidden text-left leading-tight sm:block">
              <p className="text-sm font-medium text-foreground">{user?.name ?? "Loading..."}</p>
              <p className="text-xs text-muted-foreground">{user?.email ?? ""}</p>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <UserIcon />
                Profile Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => logout()} className="text-destructive focus:text-destructive">
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
} 