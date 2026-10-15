"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, FolderKanban, Search } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ProjectStatusBadge } from "@/components/shared/status-badge";
import { ProjectFormDialog } from "@/components/modules/projects/project-form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDeleteProject, useProjects } from "@/hooks/queries/use-projects";
import { usePermissions } from "@/hooks/use-permissions";
import { formatDate } from "@/lib/utils";
import { getApiErrorMessage } from "@/lib/api/client";
import type { Project } from "@/types/project";

export default function ProjectsPage() {
  const { data: projects, isLoading } = useProjects();
  const deleteMutation = useDeleteProject();
  const { canManageProjects } = usePermissions();

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "COMPLETED" | "ON_HOLD">("ALL");

  const filtered = (projects ?? []).filter((p) =>
    p.project_name.toLowerCase().includes(search.toLowerCase()) && (statusFilter === "ALL" || p.status === statusFilter)
  );

  const total = projects?.length ?? 0;
  const active = projects?.filter((p) => p.status === "ACTIVE").length ?? 0;
  const completed = projects?.filter((p) => p.status === "COMPLETED").length ?? 0;
  const onHold = projects?.filter((p) => p.status === "ON_HOLD").length ?? 0;

  const openCreate = () => {
    setEditingProject(null);
    setFormOpen(true);
  };

  const openEdit = (project: Project) => {
    setEditingProject(project);
    setFormOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingProject) return;
    try {
      await deleteMutation.mutateAsync(deletingProject.project_id);
      toast.success("Project deleted");
      setDeletingProject(null);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const showProjectResults = (status: typeof statusFilter) => {
    setSearch("");
    setStatusFilter(status);
    requestAnimationFrame(() => document.getElementById("project-results")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Manage all projects in your organization"
        actions={
          canManageProjects ? (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              New Project
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[{ key: "ALL" as const, label: "Total Projects", count: total, color: "text-slate-900" }, { key: "ACTIVE" as const, label: "Active Projects", count: active, color: "text-blue-600" }, { key: "COMPLETED" as const, label: "Completed", count: completed, color: "text-green-600" }, { key: "ON_HOLD" as const, label: "On Hold", count: onHold, color: "text-amber-600" }].map((stat) => (
        <Card key={stat.key} className={`transition hover:border-violet-300 hover:shadow-sm ${statusFilter === stat.key ? "border-violet-400 ring-1 ring-violet-200" : ""}`}>
          <button type="button" onClick={() => showProjectResults(stat.key)} className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className={`mt-1 text-2xl font-semibold ${stat.color}`}>{stat.count}</p>
          </CardContent>
          </button>
        </Card>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search projects..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card id="project-results" className="scroll-mt-6">
        {isLoading ? (
          <CardContent className="space-y-3 p-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        ) : filtered.length === 0 ? (
          <CardContent className="p-5">
            <EmptyState
              icon={FolderKanban}
              title={search ? "No projects match your search" : "No projects yet"}
              description={search ? "Try a different search term." : "Create your first project to get started."}
              actionLabel={search || !canManageProjects ? undefined : "New Project"}
              onAction={search || !canManageProjects ? undefined : openCreate}
            />
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Updated</TableHead>
                {canManageProjects && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((project) => (
                <TableRow key={project.project_id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
                        <FolderKanban className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <Link href={`/projects/${project.project_id}`} className="font-medium text-foreground hover:text-violet-700 hover:underline">{project.project_name}</Link>
                        {project.description && (
                          <p className="line-clamp-1 max-w-xs text-xs text-muted-foreground">
                            {project.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <ProjectStatusBadge status={project.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(project.created_at)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(project.updated_at)}</TableCell>
                  {canManageProjects && (
                    <TableCell>
                      <div className="flex flex-nowrap items-center gap-1">
                          <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Edit project" title="Edit project" onClick={() => openEdit(project)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="outline" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" aria-label="Delete project" title="Delete project" onClick={() => setDeletingProject(project)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {canManageProjects && (
        <>
          <ProjectFormDialog open={formOpen} onOpenChange={setFormOpen} project={editingProject} />

          <ConfirmDialog
            open={!!deletingProject}
            onOpenChange={(open) => !open && setDeletingProject(null)}
            title="Delete project?"
            description={`This will permanently delete "${deletingProject?.project_name}". This action cannot be undone.`}
            onConfirm={confirmDelete}
            isLoading={deleteMutation.isPending}
          />
        </>
      )}
    </div>
  );
}
