"use client";

import { useState } from "react";
import { Plus, MoreHorizontal, Pencil, Trash2, FolderKanban, Search } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDeleteProject, useProjects } from "@/hooks/queries/use-projects";
import { formatDate } from "@/lib/utils";
import { getApiErrorMessage } from "@/lib/api/client";
import type { Project } from "@/types/project";

export default function ProjectsPage() {
  const { data: projects, isLoading } = useProjects();
  const deleteMutation = useDeleteProject();

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);

  const filtered = (projects ?? []).filter((p) =>
    p.project_name.toLowerCase().includes(search.toLowerCase())
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Manage all projects in your organization"
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Projects</p>
            <p className="mt-1 text-2xl font-semibold">{total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Active Projects</p>
            <p className="mt-1 text-2xl font-semibold text-blue-600">{active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Completed</p>
            <p className="mt-1 text-2xl font-semibold text-green-600">{completed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">On Hold</p>
            <p className="mt-1 text-2xl font-semibold text-amber-600">{onHold}</p>
          </CardContent>
        </Card>
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

      <Card>
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
              actionLabel={search ? undefined : "New Project"}
              onAction={search ? undefined : openCreate}
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
                <TableHead className="w-10" />
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
                        <p className="font-medium text-foreground">{project.project_name}</p>
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
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(project)}>
                          <Pencil />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeletingProject(project)}
                        >
                          <Trash2 />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <ProjectFormDialog open={formOpen} onOpenChange={setFormOpen} project={editingProject} />

      <ConfirmDialog
        open={!!deletingProject}
        onOpenChange={(open) => !open && setDeletingProject(null)}
        title="Delete project?"
        description={`This will permanently delete "${deletingProject?.project_name}". This action cannot be undone.`}
        onConfirm={confirmDelete}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
