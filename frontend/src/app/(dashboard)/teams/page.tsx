"use client";

import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Users, Search, UsersRound } from "lucide-react";
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
import { TeamFormDialog } from "@/components/modules/teams/team-form-dialog";
import { TeamMembersDialog } from "@/components/modules/teams/team-members-dialog";
import { useDeleteTeam, useTeamLeads, useTeams, useTeamMemberCandidates } from "@/hooks/queries/use-teams";
import { useProjects } from "@/hooks/queries/use-projects";
import { useUsers } from "@/hooks/queries/use-users";
import { useTasks } from "@/hooks/queries/use-tasks";
import { formatDate } from "@/lib/utils";
import { getApiErrorMessage } from "@/lib/api/client";
import { usePermissions } from "@/hooks/use-permissions";
import { useAuthStore } from "@/store/auth-store";
import type { Team } from "@/types/team";
import { isDeveloperOrTester, isTeamLeadOnly, visibleMemberPost } from "@/lib/member-visibility";

const ALL = "__all__";

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  INACTIVE: "bg-slate-100 text-slate-500",
  ARCHIVED: "bg-slate-100 text-slate-400",
};

type TeamRosterUser = { user_id: string; name: string; role_names?: string[] };

function TeamRosterPreview({ team, users, assignedMembers = [] }: { team: Team; users: TeamRosterUser[]; assignedMembers?: string[] }) {
  const userMap = new Map(users.map((user) => [user.user_id, user]));
  const names = (team.members ?? []).map((member) => {
    const user = userMap.get(member.user_id);
    return user && isDeveloperOrTester(user) ? `${user.name} (${visibleMemberPost(user)})` : null;
  }).filter((name): name is string => !!name);

  const assignedTaskMembers = assignedMembers.filter((name) => !names.some((rosterName) => rosterName.startsWith(name)));
  if (names.length === 0 && assignedTaskMembers.length === 0) return <span className="text-sm text-muted-foreground">No members</span>;

  const visibleNames = names.slice(0, 3);
  return (
    <div className="max-w-56 space-y-1 text-sm" title={[...names, ...assignedTaskMembers.map((name) => `${name} (assigned to task)`)].join(", ")}>
      {visibleNames.length > 0 && <span className="block truncate">{visibleNames.join(", ")}{names.length > visibleNames.length ? ` +${names.length - visibleNames.length}` : ""}</span>}
      {assignedTaskMembers.length > 0 && <span className="block truncate text-[11px] text-indigo-700">Tasks: {assignedTaskMembers.join(", ")}</span>}
    </div>
  );
}

export default function TeamsPage() {
  const currentUser = useAuthStore((state) => state.user);
  const { permissionCodes, canManageTeams } = usePermissions();
  const canCreateTeam = permissionCodes.includes("teams.create") || ["teams.members.create", "teams.members.update", "teams.members.delete"].some((code) => permissionCodes.includes(code));
  const canEditTeam = permissionCodes.includes("teams.update");
  const canDeleteTeam = permissionCodes.includes("teams.delete");
  const { data: teams, isLoading } = useTeams(permissionCodes.includes("teams.view"));
  const { data: projects } = useProjects(undefined, permissionCodes.includes("projects.view"));
  const { data: users } = useUsers(undefined, permissionCodes.includes("users.view"));
  const { data: tasks = [] } = useTasks({ limit: 500 }, permissionCodes.includes("tasks.view"));
  const canViewTeamMembers = ["teams.view", "teams.manage", "teams.members.view", "teams.members.manage", "teams.leads.view"].some((code) => permissionCodes.includes(code));
  const { data: teamMemberCandidates = [] } = useTeamMemberCandidates(canViewTeamMembers);
  // The API returns a user's own TeamLead record even without the global
  // team-leads view permission, so the assigned lead can see their name here.
  const { data: teamLeads } = useTeamLeads(!!currentUser || permissionCodes.includes("teams.leads.view"));
  const deleteMutation = useDeleteTeam();
  const canManageMembership = canManageTeams || ["teams.members.create", "teams.members.update", "teams.members.delete"].some((code) => permissionCodes.includes(code));

  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);

  const [formOpen, setFormOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [deletingTeam, setDeletingTeam] = useState<Team | null>(null);
  const [membersTeam, setMembersTeam] = useState<Team | null>(null);

  const projectMap = useMemo(() => new Map((projects ?? []).map((p) => [p.project_id, p])), [projects]);
  const userMap = useMemo(() => {
    const entries: [string, TeamRosterUser][] = [
      ...teamMemberCandidates.map((member): [string, TeamRosterUser] => [member.user_id, {
        user_id: member.user_id,
        name: member.name,
        role_names: member.role_names,
      }]),
      ...(users ?? []).map((user): [string, TeamRosterUser] => [user.user_id, {
        user_id: user.user_id,
        name: user.name,
        role_names: user.role_names,
      }]),
    ];
    return new Map(entries);
  }, [teamMemberCandidates, users]);
  const taskAssigneesByTeam = useMemo(() => {
    const nameByUserId = new Map(userMap);
    const teamsByProject = new Map<string, Team[]>();
    for (const team of teams ?? []) {
      const projectTeams = teamsByProject.get(team.project_id) ?? [];
      teamsByProject.set(team.project_id, [...projectTeams, team]);
    }
    const result = new Map<string, string[]>();
    for (const task of tasks) {
      if (!task.user_id) continue;
      const taskTeam = task.team_id
        ? (teams ?? []).find((team) => team.team_id === task.team_id)
        : (teamsByProject.get(task.project_id) ?? []).length === 1
          ? teamsByProject.get(task.project_id)?.[0]
          : undefined;
      if (!taskTeam) continue;
      const name = task.assignee_name || nameByUserId.get(task.user_id)?.name;
      if (!name) continue;
      const assigned = result.get(taskTeam.team_id) ?? [];
      if (!assigned.includes(name)) result.set(taskTeam.team_id, [...assigned, name]);
    }
    return result;
  }, [tasks, teams, userMap]);
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

  const showTeamResults = (status: string = ALL) => {
    setSearch("");
    setProjectFilter(ALL);
    setStatusFilter(status);
    requestAnimationFrame(() => document.getElementById("team-results")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

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
        actions={canCreateTeam ? <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New Team
          </Button> : undefined}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <button type="button" onClick={() => showTeamResults()} className="metric-card rounded-2xl border border-border bg-card text-left transition hover:border-violet-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
          <div className="p-4">
            <p className="text-xs text-muted-foreground">Total Teams</p>
            <p className="mt-1 text-2xl font-semibold">{total}</p>
          </div>
        </button>
        <button type="button" onClick={() => showTeamResults("ACTIVE")} className="metric-card rounded-2xl border border-border bg-card text-left transition hover:border-violet-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
          <div className="p-4">
            <p className="text-xs text-muted-foreground">Active Teams</p>
            <p className="mt-1 text-2xl font-semibold text-green-600">{active}</p>
          </div>
        </button>
        <button type="button" onClick={() => showTeamResults()} className="metric-card rounded-2xl border border-border bg-card text-left transition hover:border-violet-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
          <div className="p-4">
            <p className="text-xs text-muted-foreground">Total Capacity</p>
            <p className="mt-1 text-2xl font-semibold">{totalCapacity}</p>
          </div>
        </button>
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

      <Card id="team-results" className="scroll-mt-6">
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
              actionLabel={canCreateTeam ? "New Team" : undefined}
              onAction={canCreateTeam ? openCreate : undefined}
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
                const candidateLead = lead ? userMap.get(lead.user_id) : null;
                const leadUser = lead?.user_id === currentUser?.user_id
                  ? currentUser
                  : candidateLead && isTeamLeadOnly(candidateLead) ? candidateLead : null;

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
                      <TeamRosterPreview team={team} users={Array.from(userMap.values())} assignedMembers={taskAssigneesByTeam.get(team.team_id)} />
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
                      {(canManageMembership || canEditTeam || canDeleteTeam) && <div className="flex flex-nowrap items-center gap-1">
                        {canManageMembership && <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Manage team members" title="Manage team members" onClick={() => setMembersTeam(team)}><UsersRound className="h-4 w-4" /></Button>}
                        {canEditTeam && <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Edit team" title="Edit team" onClick={() => openEdit(team)}><Pencil className="h-4 w-4" /></Button>}
                        {canDeleteTeam && <Button variant="outline" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" aria-label="Delete team" title="Delete team" onClick={() => setDeletingTeam(team)}><Trash2 className="h-4 w-4" /></Button>}
                      </div>}
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
