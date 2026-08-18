import { FolderKanban } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-purple-500">
            <FolderKanban className="h-4 w-4 text-white" />
          </div>
          <div className="leading-tight">
            <p className="text-base font-bold text-foreground">SprintIX</p>
            <p className="text-[11px] text-muted-foreground">Project Management System</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
