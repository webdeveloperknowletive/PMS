export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 px-4 py-10">
      <div className="w-full max-w-5xl">
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-white p-1 shadow-lg shadow-violet-950/20 ring-1 ring-white/50">
            <img src="/sprintix-logo-hd.png?v=3" alt="SprintIX logo" className="h-full w-full rounded-xl object-contain" />
          </div>
          <div className="leading-tight">
            <p className="text-lg font-bold text-foreground">SprintIX</p>
            <p className="text-[11px] text-muted-foreground">Project Management System</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
