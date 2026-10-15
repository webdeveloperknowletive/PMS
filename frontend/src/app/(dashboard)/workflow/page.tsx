"use client";

import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Workflow as WorkflowIcon, Search, Star, CircleCheck, CirclePause, Archive, Layers3 } from "lucide-react";
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
import { WorkflowFormDialog } from "@/components/modules/workflow/workflow-form-dialog";
import { useDeleteWorkflow, useWorkflows } from "@/hooks/queries/use-workflows";
import { useProjects } from "@/hooks/queries/use-projects";
import { useTeamLeads } from "@/hooks/queries/use-teams";
import { useUsers } from "@/hooks/queries/use-users";
import { isTeamLeadOnly } from "@/lib/member-visibility";
import { formatDate } from "@/lib/utils";
import { getApiErrorMessage } from "@/lib/api/client";
import type { Workflow } from "@/types/workflow";
import { usePermissions } from "@/hooks/use-permissions";

const ALL = "__all__";

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  INACTIVE: "border-slate-200 bg-slate-100 text-slate-600",
  ARCHIVED: "border-amber-200 bg-amber-50 text-amber-700",
};

const METRICS = [
  { label: "Total workflows", value: "total", hint: "Across all projects", icon: Layers3, color: "bg-violet-100 text-violet-700", glow: "from-violet-300/30" },
  { label: "Active", value: "active", hint: "Ready for your team", icon: CircleCheck, color: "bg-emerald-100 text-emerald-700", glow: "from-emerald-300/25" },
  { label: "Inactive", value: "inactive", hint: "Paused for now", icon: CirclePause, color: "bg-sky-100 text-sky-700", glow: "from-sky-300/25" },
  { label: "Archived", value: "archived", hint: "Saved for reference", icon: Archive, color: "bg-amber-100 text-amber-700", glow: "from-amber-300/25" },
] as const;

export default function WorkflowPage() {
  const { data: workflows, isLoading } = useWorkflows();
  const { data: projects } = useProjects();
  const { data: teamLeads } = useTeamLeads();
  const { data: users } = useUsers();
  const deleteMutation = useDeleteWorkflow();
  const { canManageWorkflow } = usePermissions();

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

  const showWorkflowResults = (status: string) => {
    setSearch("");
    setProjectFilter(ALL);
    setStatusFilter(status);
    requestAnimationFrame(() => document.getElementById("workflow-results")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

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
        actions={canManageWorkflow ? <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New Workflow
          </Button> : undefined}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {METRICS.map((metric) => {
          const Icon = metric.icon;
          const value = metric.value === "total" ? total : metric.value === "active" ? active : metric.value === "inactive" ? inactive : archived;
          const status = metric.value === "total" ? ALL : metric.value.toUpperCase();
          return <button type="button" key={metric.value} onClick={() => showWorkflowResults(status)} className="metric-card rounded-2xl border border-white/90 bg-card text-left transition hover:border-violet-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
            <div className="relative flex items-center justify-between gap-4 overflow-hidden p-5">
              <div className={`pointer-events-none absolute -right-8 -top-12 h-32 w-32 rounded-full bg-gradient-to-br ${metric.glow} to-transparent blur-2xl`} />
              <div className="relative">
                <p className="text-xs font-semibold text-slate-500">{metric.label}</p>
                <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
                <p className="mt-1 text-[11px] text-slate-500">{metric.hint}</p>
              </div>
              <div className={`relative flex h-12 w-12 items-center justify-center rounded-2xl ${metric.color}`}><Icon className="h-5 w-5" /></div>
            </div>
          </button>;
        })}
      </div>

      <div className="filter-bar">
        <div className="relative w-full flex-1 sm:min-w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search workflows..."
            className="border-transparent bg-slate-50 pl-9 shadow-none focus-visible:border-violet-300"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-full border-transparent bg-slate-50 shadow-none sm:w-52">
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
          <SelectTrigger className="w-full border-transparent bg-slate-50 shadow-none sm:w-44">
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

      <Card id="workflow-results" className="scroll-mt-6 overflow-hidden border-white/90">
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
              actionLabel={canManageWorkflow ? "New Workflow" : undefined}
              onAction={canManageWorkflow ? openCreate : undefined}
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
                const candidateLead = lead ? userMap.get(lead.user_id) : null;
                const leadUser = candidateLead && isTeamLeadOnly(candidateLead) ? candidateLead : null;

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
                      <Badge variant="outline" className={`rounded-full px-2.5 py-1 font-semibold ${STATUS_COLOR[w.status] ?? "bg-slate-100 text-slate-600"}`}>
                        {w.status.charAt(0) + w.status.slice(1).toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(w.updated_at)}</TableCell>
                    <TableCell>
                      {canManageWorkflow && <div className="flex flex-nowrap items-center gap-1">
                        <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Edit workflow" title="Edit workflow" onClick={() => openEdit(w)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="outline" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" aria-label="Delete workflow" title="Delete workflow" onClick={() => setDeletingWorkflow(w)}><Trash2 className="h-4 w-4" /></Button>
                      </div>}
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
