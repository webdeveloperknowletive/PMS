"use client";

import { useMemo, useState } from "react";
import { Plus, MoreHorizontal, Pencil, Trash2, Users, Search, UsersRound } from "lucide-react";
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
import { TeamFormDialog } from "@/components/modules/teams/team-form-dialog";
import { TeamMembersDialog } from "@/components/modules/teams/team-members-dialog";
import { useDeleteTeam, useTeamLeads, useTeams } from "@/hooks/queries/use-teams";
import { useProjects } from "@/hooks/queries/use-projects";
import { useUsers } from "@/hooks/queries/use-users";
import { formatDate } from "@/lib/utils";
import { getApiErrorMessage } from "@/lib/api/client";
import { usePermissions } from "@/hooks/use-permissions";
import type { Team } from "@/types/team";

const ALL = "__all__";

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  INACTIVE: "bg-slate-100 text-slate-500",
  ARCHIVED: "bg-slate-100 text-slate-400",
};

function TeamRosterPreview({ team, users }: { team: Team; users: { user_id: string; name: string }[] }) {
  const userMap = new Map(users.map((user) => [user.user_id, user.name]));
  const names = (team.members ?? []).map((member) => userMap.get(member.user_id)).filter(Boolean);

  if (names.length === 0) return <span className="text-sm text-muted-foreground">No members</span>;

  const visibleNames = names.slice(0, 3);
  return (
    <span className="block max-w-56 truncate text-sm" title={names.join(", ")}>
      {visibleNames.join(", ")}{names.length > visibleNames.length ? ` +${names.length - visibleNames.length}` : ""}
    </span>
  );
}

export default function TeamsPage() {
  const { data: teams, isLoading } = useTeams();
  const { data: projects } = useProjects();
  const { data: users } = useUsers();
  const { data: teamLeads } = useTeamLeads();
  const deleteMutation = useDeleteTeam();
  const { canManageTeams, permissionCodes } = usePermissions();
  const canManageMembership = canManageTeams || permissionCodes.includes("teams.members.manage");

  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);

  const [formOpen, setFormOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [deletingTeam, setDeletingTeam] = useState<Team | null>(null);
  const [membersTeam, setMembersTeam] = useState<Team | null>(null);

  const projectMap = useMemo(() => new Map((projects ?? []).map((p) => [p.project_id, p])), [projects]);
  const userMap = useMemo(() => new Map((users ?? []).map((u) => [u.user_id, u])), [users]);
  const leadMap = useMemo(() => new Map((teamLeads ?? []).map((l) => [l.team_lead_id, l])), [teamLeads]);

  const filtered = (teams ?? []).filter((t) => {
    if (search && !t.team_name.toLowerCase().includes(search.toLowerCase())) return false;
    if (projectFilter !== ALL && t.project_id !== projectFilter) return false;
    if (statusFilter !== ALL && t.status !== statusFilter) return false;
    return true;
  });

  const total = teams?.length ?? 0;
  const active = teams?.filter((t) => t.status === "ACTIVE").length ?? 0;
  const totalCapacity = teams?.reduce((sum, t) => sum + t.max_members, 0) ?? 0;

  const openCreate = () => {
    setEditingTeam(null);
    setFormOpen(true);
  };
  const openEdit = (team: Team) => {
    setEditingTeam(team);
    setFormOpen(true);
  };
  const confirmDelete = async () => {
    if (!deletingTeam) return;
    try {
      await deleteMutation.mutateAsync(deletingTeam.team_id);
      toast.success("Team deleted");
      setDeletingTeam(null);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Teams"
        description="Manage your teams and collaborate effectively"
        actions={canManageTeams ? <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New Team
          </Button> : undefined}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Teams</p>
            <p className="mt-1 text-2xl font-semibold">{total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Active Teams</p>
            <p className="mt-1 text-2xl font-semibold text-green-600">{active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Capacity</p>
            <p className="mt-1 text-2xl font-semibold">{totalCapacity}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search teams..."
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
              icon={Users}
              title="No teams found"
              description="Try adjusting your filters, or create a new team."
              actionLabel={canManageTeams ? "New Team" : undefined}
              onAction={canManageTeams ? openCreate : undefined}
            />
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Team Lead</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((team) => {
                const lead = leadMap.get(team.team_lead_id);
                const leadUser = lead ? userMap.get(lead.user_id) : null;

                return (
                  <TableRow key={team.team_id}>
                    <TableCell>
                      <p className="font-medium text-foreground">{team.team_name}</p>
                      {team.description && (
                        <p className="line-clamp-1 max-w-xs text-xs text-muted-foreground">{team.description}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {projectMap.get(team.project_id)?.project_name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <UserAvatar user={leadUser} />
                    </TableCell>
                    <TableCell>
                      <TeamRosterPreview team={team} users={users ?? []} />
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => setMembersTeam(team)}
                        className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                      >
                        <UsersRound className="h-3.5 w-3.5" />
                        {canManageMembership ? "Manage" : "View"} (max {team.max_members})
                      </button>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`border-0 font-medium ${STATUS_COLOR[team.status] ?? "bg-slate-100 text-slate-600"}`}>
                        {team.status.charAt(0) + team.status.slice(1).toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(team.created_at)}</TableCell>
                    <TableCell>
                      {canManageTeams && <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setMembersTeam(team)}>
                            <UsersRound />
                            Manage Members
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(team)}>
                            <Pencil />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeletingTeam(team)}
                          >
                            <Trash2 />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <TeamFormDialog open={formOpen} onOpenChange={setFormOpen} team={editingTeam} />

      <TeamMembersDialog open={!!membersTeam} onOpenChange={(open) => !open && setMembersTeam(null)} team={membersTeam} canManage={canManageMembership} />

      <ConfirmDialog
        open={!!deletingTeam}
        onOpenChange={(open) => !open && setDeletingTeam(null)}
        title="Delete team?"
        description={`This will permanently delete "${deletingTeam?.team_name}" and all its member records. This action cannot be undone.`}
        onConfirm={confirmDelete}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
