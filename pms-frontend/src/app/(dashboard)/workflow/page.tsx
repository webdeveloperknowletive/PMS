"use client";

import { useMemo, useState } from "react";
import { Plus, MoreHorizontal, Pencil, Trash2, Workflow as WorkflowIcon, Search, Star } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WorkflowFormDialog } from "@/components/modules/workflow/workflow-form-dialog";
import { useDeleteWorkflow, useWorkflows } from "@/hooks/queries/use-workflows";
import { useProjects } from "@/hooks/queries/use-projects";
import { useTeamLeads } from "@/hooks/queries/use-teams";
import { useUsers } from "@/hooks/queries/use-users";
import { formatDate } from "@/lib/utils";
import { getApiErrorMessage } from "@/lib/api/client";
import type { Workflow } from "@/types/workflow";

const ALL = "__all__";

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  INACTIVE: "bg-slate-100 text-slate-500",
  ARCHIVED: "bg-slate-100 text-slate-400",
};

export default function WorkflowPage() {
  const { data: workflows, isLoading } = useWorkflows();
  const { data: projects } = useProjects();
  const { data: teamLeads } = useTeamLeads();
  const { data: users } = useUsers();
  const deleteMutation = useDeleteWorkflow();

  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);

  const [formOpen, setFormOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [deletingWorkflow, setDeletingWorkflow] = useState<Workflow | null>(null);

  const projectMap = useMemo(() => new Map((projects ?? []).map((p) => [p.project_id, p])), [projects]);
  const userMap = useMemo(() => new Map((users ?? []).map((u) => [u.user_id, u])), [users]);
  const leadMap = useMemo(() => new Map((teamLeads ?? []).map((l) => [l.team_lead_id, l])), [teamLeads]);

  const filtered = (workflows ?? []).filter((w) => {
    if (search && !w.workflow_name.toLowerCase().includes(search.toLowerCase())) return false;
    if (projectFilter !== ALL && w.project_id !== projectFilter) return false;
    if (statusFilter !== ALL && w.status !== statusFilter) return false;
    return true;
  });

  const total = workflows?.length ?? 0;
  const active = workflows?.filter((w) => w.status === "ACTIVE").length ?? 0;
  const inactive = workflows?.filter((w) => w.status === "INACTIVE").length ?? 0;
  const archived = workflows?.filter((w) => w.status === "ARCHIVED").length ?? 0;

  const openCreate = () => {
    setEditingWorkflow(null);
    setFormOpen(true);
  };
  const openEdit = (w: Workflow) => {
    setEditingWorkflow(w);
    setFormOpen(true);
  };
  const confirmDelete = async () => {
    if (!deletingWorkflow) return;
    try {
      await deleteMutation.mutateAsync(deletingWorkflow.workflow_id);
      toast.success("Workflow deleted");
      setDeletingWorkflow(null);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workflow"
        description="Design and manage your project workflows"
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New Workflow
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Workflows</p>
            <p className="mt-1 text-2xl font-semibold">{total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Active</p>
            <p className="mt-1 text-2xl font-semibold text-green-600">{active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Inactive</p>
            <p className="mt-1 text-2xl font-semibold text-slate-600">{inactive}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Archived</p>
            <p className="mt-1 text-2xl font-semibold text-slate-400">{archived}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search workflows..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Project" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All Projects</SelectItem>
            {(projects ?? []).map((p) => (
              <SelectItem key={p.project_id} value={p.project_id}>
                {p.project_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All Statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="INACTIVE">Inactive</SelectItem>
            <SelectItem value="ARCHIVED">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        {isLoading ? (
          <CardContent className="space-y-3 p-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </CardContent>
        ) : filtered.length === 0 ? (
          <CardContent className="p-5">
            <EmptyState
              icon={WorkflowIcon}
              title="No workflows found"
              description="Try adjusting your filters, or create a new workflow."
              actionLabel="New Workflow"
              onAction={openCreate}
            />
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Workflow</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((w) => {
                const lead = leadMap.get(w.team_lead_id);
                const leadUser = lead ? userMap.get(lead.user_id) : null;

                return (
                  <TableRow key={w.workflow_id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground">{w.workflow_name}</p>
                        {w.is_default && (
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-label="Default workflow" />
                        )}
                      </div>
                      {w.description && (
                        <p className="line-clamp-1 max-w-xs text-xs text-muted-foreground">{w.description}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {projectMap.get(w.project_id)?.project_name ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{w.workflow_type}</TableCell>
                    <TableCell>
                      <UserAvatar user={leadUser} />
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`border-0 font-medium ${STATUS_COLOR[w.status] ?? "bg-slate-100 text-slate-600"}`}>
                        {w.status.charAt(0) + w.status.slice(1).toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(w.updated_at)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(w)}>
                            <Pencil />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeletingWorkflow(w)}
                          >
                            <Trash2 />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <WorkflowFormDialog open={formOpen} onOpenChange={setFormOpen} workflow={editingWorkflow} />

      <ConfirmDialog
        open={!!deletingWorkflow}
        onOpenChange={(open) => !open && setDeletingWorkflow(null)}
        title="Delete workflow?"
        description={`This will permanently delete "${deletingWorkflow?.workflow_name}". This action cannot be undone.`}
        onConfirm={confirmDelete}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}