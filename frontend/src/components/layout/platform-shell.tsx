"use client";

import Link from "next/link";
import { Activity, Building2, CreditCard, LogOut, Menu, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { authApi } from "@/lib/api/auth";
import { tokenStorage } from "@/lib/api/client";
import { useAuthStore } from "@/store/auth-store";

export function PlatformShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const clearStore = useAuthStore((state) => state.logout);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const signOut = async () => {
    try {
      await authApi.platformLogout();
    } catch {
      // Clear the separate platform session even if it has already expired.
    } finally {
      tokenStorage.clear();
      clearStore();
      router.replace("/platform/login");
    }
  };
  const navItems = [
    { href: "/platform", label: "Overview & organizations", icon: Building2, exact: true },
    { href: "/platform/subscriptions", label: "Plans & subscriptions", icon: CreditCard },
    { href: "/platform/health", label: "Platform health", icon: Activity },
  ];
  return <div className="flex h-screen overflow-hidden bg-background">
    {mobileNavOpen && <button aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm lg:hidden" />}
    <aside className={`fixed inset-y-0 left-0 z-50 flex h-screen w-[276px] shrink-0 flex-col border-r border-white/[0.06] bg-[linear-gradient(165deg,#1d2141_0%,#171b36_48%,#14182f_100%)] shadow-2xl shadow-slate-950/20 transition-transform duration-300 lg:static lg:z-auto lg:translate-x-0 lg:shadow-none ${mobileNavOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
      <div className="flex h-[76px] shrink-0 items-center justify-between border-b border-white/[0.07] px-5">
        <Link href="/platform" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white p-1 shadow-lg ring-1 ring-white/20"><img src="/sprintix-logo-hd.png" alt="SprintIX logo" className="h-full w-full rounded-xl object-contain" /></div><div className="leading-tight"><p className="text-[15px] font-bold tracking-wide text-white">SprintIX</p><p className="mt-1 text-[10px] font-medium tracking-wide text-slate-400">PLATFORM ADMIN</p></div></Link>
        <button aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden"><X className="h-4 w-4" /></button>
      </div>
      <nav className="scrollbar-thin flex-1 space-y-1 overflow-y-auto px-3 pb-5 pt-5">{navItems.map(({ href, label, icon: Icon, exact }) => { const active = exact ? pathname === href || pathname.startsWith(`${href}/organizations`) : pathname.startsWith(href); return <Link key={href} onClick={() => setMobileNavOpen(false)} aria-current={active ? "page" : undefined} className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200 ${active ? "bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-lg shadow-indigo-950/20" : "text-slate-300 hover:bg-white/[0.07] hover:text-white"}`} href={href}><Icon className={`h-[17px] w-[17px] shrink-0 ${active ? "text-white" : "text-slate-400 group-hover:text-violet-200"}`} />{label}{active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white/80" />}</Link>; })}</nav>
      <div className="shrink-0 border-t border-white/[0.07] p-3"><div className="mt-1 flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.06] px-3 py-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-indigo-500 text-xs font-bold text-white">IX</div><div className="min-w-0"><p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-400">Developer company</p><p className="truncate text-sm font-semibold text-white">{user?.name ?? "Platform admin"}</p></div></div></div>
    </aside>
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <header className="z-30 flex h-[72px] shrink-0 items-center justify-between gap-3 border-b border-slate-200/70 bg-white/85 px-4 backdrop-blur-xl sm:px-6">
        <div className="flex min-w-0 items-center gap-3"><button aria-label="Open navigation" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-600 hover:bg-violet-50 lg:hidden" onClick={() => setMobileNavOpen(true)}><Menu className="h-5 w-5" /></button><div><p className="text-sm font-semibold text-slate-800">Platform administration</p><p className="text-xs text-slate-500">Developer company console</p></div></div>
        <div className="flex items-center gap-3"><div className="hidden text-right sm:block"><p className="max-w-48 truncate text-sm font-semibold text-slate-800">{user?.name ?? "Super Admin"}</p><p className="max-w-48 truncate text-[11px] text-slate-500">{user?.email}</p></div><button className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-violet-200 hover:text-violet-700" onClick={() => { void signOut(); }}><LogOut className="h-4 w-4" /><span className="hidden sm:inline">Sign out</span></button></div>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto scrollbar-thin [scrollbar-gutter:stable] px-4 py-5 sm:px-6 sm:py-7 xl:px-9"><div className="mx-auto min-h-full w-full max-w-[1600px]">{children}</div></main>
    </div>
  </div>;
}
