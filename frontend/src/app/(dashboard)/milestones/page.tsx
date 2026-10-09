"use client";

import { useMemo, useState } from "react";
import { Plus, MoreHorizontal, Pencil, Trash2, Flag, Search } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MilestoneStatusBadge, getMilestoneStatus, type DerivedMilestoneStatus } from "@/components/modules/milestones/milestone-status-badge";
import { MilestoneFormDialog } from "@/components/modules/milestones/milestone-form-dialog";
import { useDeleteMilestone, useMilestones, useUpdateMilestone } from "@/hooks/queries/use-milestones";
import { useProjects } from "@/hooks/queries/use-projects";
import { formatDate } from "@/lib/utils";
import { getApiErrorMessage } from "@/lib/api/client";
import type { Milestone } from "@/types/milestone";
import { usePermissions } from "@/hooks/use-permissions";

const ALL = "__all__";

export default function MilestonesPage() {
  const { data: milestones, isLoading } = useMilestones();
  const { data: projects } = useProjects();
  const deleteMutation = useDeleteMilestone();
  const { canManageMilestones } = usePermissions();
  const updateMutation = useUpdateMilestone();

  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);

  const [formOpen, setFormOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [deletingMilestone, setDeletingMilestone] = useState<Milestone | null>(null);

  const projectMap = useMemo(() => new Map((projects ?? []).map((p) => [p.project_id, p])), [projects]);

  const filtered = (milestones ?? []).filter((m) => {
    if (search && !m.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (projectFilter !== ALL && m.project_id !== projectFilter) return false;
    if (statusFilter !== ALL && getMilestoneStatus(m) !== statusFilter) return false;
    return true;
  });

  const total = milestones?.length ?? 0;
  const completed = milestones?.filter((m) => getMilestoneStatus(m) === "Completed").length ?? 0;
  const overdue = milestones?.filter((m) => getMilestoneStatus(m) === "Overdue").length ?? 0;
  const upcoming = milestones?.filter((m) => getMilestoneStatus(m) === "Upcoming").length ?? 0;

  const openCreate = () => {
    setEditingMilestone(null);
    setFormOpen(true);
  };
  const openEdit = (m: Milestone) => {
    setEditingMilestone(m);
    setFormOpen(true);
  };
  const confirmDelete = async () => {
    if (!deletingMilestone) return;
    try {
      await deleteMutation.mutateAsync(deletingMilestone.milestone_id);
      toast.success("Milestone deleted");
      setDeletingMilestone(null);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };
  const toggleComplete = async (m: Milestone, checked: boolean) => {
    try {
      await updateMutation.mutateAsync({ id: m.milestone_id, payload: { is_completed: checked } });
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Milestones"
        description="Track important milestones across all projects"
        actions={canManageMilestones ? <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New Milestone
          </Button> : undefined}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Milestones</p>
            <p className="mt-1 text-2xl font-semibold">{total}</p>
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
            <p className="text-xs text-muted-foreground">Upcoming</p>
            <p className="mt-1 text-2xl font-semibold text-amber-600">{upcoming}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Overdue</p>
            <p className="mt-1 text-2xl font-semibold text-red-600">{overdue}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search milestones..."
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
            {(["Completed", "Upcoming", "Overdue"] satisfies DerivedMilestoneStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
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
              icon={Flag}
              title="No milestones found"
              description="Try adjusting your filters, or create a new milestone."
              actionLabel={canManageMilestones ? "New Milestone" : undefined}
              onAction={canManageMilestones ? openCreate : undefined}
            />
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Milestone</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((m) => (
                <TableRow key={m.milestone_id}>
                  <TableCell>
                    <Checkbox
                      checked={m.is_completed}
                      onCheckedChange={(checked) => toggleComplete(m, !!checked)}
                    />
                  </TableCell>
                  <TableCell>
                    <p className={`font-medium ${m.is_completed ? "text-muted-foreground line-through" : "text-foreground"}`}>
                      {m.title}
                    </p>
                    {m.description && (
                      <p className="line-clamp-1 max-w-xs text-xs text-muted-foreground">{m.description}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {projectMap.get(m.project_id)?.project_name ?? "—"}
                  </TableCell>
                  <TableCell>
                    <MilestoneStatusBadge milestone={m} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(m.due_date)}</TableCell>
                  <TableCell>
                    {canManageMilestones && <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(m)}>
                          <Pencil />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeletingMilestone(m)}
                        >
                          <Trash2 />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <MilestoneFormDialog open={formOpen} onOpenChange={setFormOpen} milestone={editingMilestone} />

      <ConfirmDialog
        open={!!deletingMilestone}
        onOpenChange={(open) => !open && setDeletingMilestone(null)}
        title="Delete milestone?"
        description={`This will permanently delete "${deletingMilestone?.title}". This action cannot be undone.`}
        onConfirm={confirmDelete}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
