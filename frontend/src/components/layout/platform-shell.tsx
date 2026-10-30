"use client";

import Link from "next/link";
import { Building2, LogOut, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";

export function PlatformShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, logout } = useAuth();
  return <div className="flex min-h-screen bg-slate-50"><aside className="hidden w-72 shrink-0 flex-col bg-slate-950 text-white md:flex"><div className="flex h-20 items-center gap-3 border-b border-white/10 px-6"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600"><ShieldCheck className="h-5 w-5" /></div><div><p className="font-bold">SprintIX Platform</p><p className="text-[10px] uppercase tracking-wider text-slate-400">Developer company</p></div></div><nav className="flex-1 space-y-1 p-4"><Link className="flex items-center gap-3 rounded-xl bg-white/10 px-3 py-2.5 text-sm font-medium" href="/platform"><Building2 className="h-4 w-4" /> Registered organizations</Link></nav><div className="border-t border-white/10 p-4"><p className="truncate text-sm font-medium">{user?.name ?? "Super Admin"}</p><p className="truncate text-xs text-slate-400">{user?.email}</p><button className="mt-3 flex items-center gap-2 text-xs text-slate-300 hover:text-white" onClick={() => { void logout(); router.push("/platform/login"); }}><LogOut className="h-4 w-4" /> Sign out</button></div></aside><main className="min-w-0 flex-1"><div className="border-b bg-white px-5 py-4 md:hidden"><Link href="/platform" className="font-semibold">SprintIX Platform</Link></div><div className="mx-auto max-w-7xl p-5 sm:p-8">{children}</div></main></div>;
}
