"use client";

import { FolderKanban, CheckSquare, CheckCircle2, Users, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/store/auth-store";
import { useProjects } from "@/hooks/queries/use-projects";
import { useQuery } from "@tanstack/react-query";
import { tasksApi } from "@/lib/api/tasks";
import { ProjectStatusBadge } from "@/components/shared/status-badge";
import { formatDate } from "@/lib/utils";
import Link from "next/link";

function StatCard({
  icon: Icon,
  label,
  value,
  isLoading,
}: {
  icon: typeof FolderKanban;
  label: string;
  value: number;
  isLoading: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          {isLoading ? <Skeleton className="mt-1 h-6 w-10" /> : <p className="text-xl font-semibold">{value}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { data: projects, isLoading: projectsLoading } = useProjects();
  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ["tasks", "dashboard"],
    queryFn: () => tasksApi.list({ limit: 200 }),
  });

  const totalProjects = projects?.length ?? 0;
  const totalTasks = tasks?.length ?? 0;
  const completedTasks = tasks?.filter((t) => t.status === "DONE").length ?? 0;
  const overdueTasks =
    tasks?.filter((t) => t.due_date && new Date(t.due_date) < new Date() && t.status !== "DONE").length ?? 0;

  const recentProjects = [...(projects ?? [])]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""} 👋
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Here&apos;s what&apos;s happening with your projects today.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={FolderKanban} label="Total Projects" value={totalProjects} isLoading={projectsLoading} />
        <StatCard icon={CheckSquare} label="Total Tasks" value={totalTasks} isLoading={tasksLoading} />
        <StatCard icon={CheckCircle2} label="Completed Tasks" value={completedTasks} isLoading={tasksLoading} />
        <StatCard icon={Clock} label="Overdue Tasks" value={overdueTasks} isLoading={tasksLoading} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Projects</CardTitle>
          <Link href="/projects" className="text-sm font-medium text-primary hover:underline">
            View All
          </Link>
        </CardHeader>
        <CardContent className="space-y-3">
          {projectsLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
          ) : recentProjects.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No projects yet.</p>
          ) : (
            recentProjects.map((project) => (
              <Link
                key={project.project_id}
                href="/projects"
                className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-muted/40"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
                    <FolderKanban className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{project.project_name}</p>
                    <p className="text-xs text-muted-foreground">Updated {formatDate(project.updated_at)}</p>
                  </div>
                </div>
                <ProjectStatusBadge status={project.status} />
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
