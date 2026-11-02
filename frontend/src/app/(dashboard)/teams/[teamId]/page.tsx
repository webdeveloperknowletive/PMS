"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { InlineDetailField } from "@/components/shared/inline-detail-field";
import { Button } from "@/components/ui/button";
import { TEAM_STATUSES } from "@/lib/constants";
import { getApiErrorMessage } from "@/lib/api/client";
import { useAddTeamMember, useRemoveTeamMember, useTeamLeads, useTeamMemberCandidates, useTeamMembers, useTeams, useUpdateTeam, useUpdateTeamMember } from "@/hooks/queries/use-teams";
import { usePermissions } from "@/hooks/use-permissions";
import type { TeamUpdate } from "@/types/team";

export default function TeamPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const { permissionCodes } = usePermissions();
  const { data: teams, isLoading } = useTeams();
  const { data: members = [] } = useTeamMembers(teamId);
  const { data: candidates = [] } = useTeamMemberCandidates();
  const { data: leads = [] } = useTeamLeads();
  const update = useUpdateTeam();
  const addMember = useAddTeamMember();
  const removeMember = useRemoveTeamMember();
  const updateMember = useUpdateTeamMember();
  const [newMemberId, setNewMemberId] = useState("");
  const team = teams?.find((item) => item.team_id === teamId);
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading team…</p>;
  if (!team) return <p className="text-sm text-destructive">This team is unavailable.</p>;
  const canEdit = permissionCodes.includes("teams.update");
  const canManageMembers = permissionCodes.includes("teams.members.manage") || permissionCodes.includes("roles.manage");
  const lead = leads.find((item) => item.team_lead_id === team.team_lead_id);
  const availableMembers = candidates.filter((item) => !members.some((member) => member.user_id === item.user_id) && item.user_id !== lead?.user_id);
  const save = async (payload: TeamUpdate) => { await update.mutateAsync({ id: teamId, payload }); toast.success("Team updated"); };
  const add = async () => {
    if (!newMemberId) return;
    try { await addMember.mutateAsync({ teamId, userId: newMemberId }); setNewMemberId(""); toast.success("Member added"); }
    catch (error) { toast.error(getApiErrorMessage(error)); }
  };
  return <div className="space-y-6">
    <PageHeader title={team.team_name} description="Team details" showHome={false} actions={<Button asChild variant="outline" size="sm"><Link href="/teams">All teams</Link></Button>} />
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-5">
        <section className="rounded-md border border-[#dfe1e6] bg-white p-5 shadow-sm"><h2 className="mb-4 font-semibold text-[#172b4d]">Overview</h2><div className="grid gap-4 sm:grid-cols-2">
          <InlineDetailField label="Team name" value={team.team_name} canEdit={canEdit} required validate={(value) => value.length > 150 ? "Use 150 characters or fewer" : undefined} onSave={(value) => save({ team_name: value })} />
          <InlineDetailField label="Status" value={team.status} canEdit={canEdit} type="select" options={TEAM_STATUSES.map((value) => ({ value, label: value }))} onSave={(value) => save({ status: value as TeamUpdate["status"] })} />
          <InlineDetailField label="Capacity" value={team.max_members} canEdit={canEdit} type="number" required validate={(value) => !Number.isInteger(Number(value)) || Number(value) < 1 ? "Enter a positive whole number" : undefined} onSave={(value) => save({ max_members: Number(value) })} />
          <div><p className="mb-1 text-xs font-medium text-[#626f86]">Project</p><Link href={"/projects/" + team.project_id} className="px-2 text-sm text-[#0c66e4] hover:underline">Open project</Link></div>
          <InlineDetailField label="Description" value={team.description} canEdit={canEdit} type="textarea" placeholder="Add a description" onSave={(value) => save({ description: value || null })} className="sm:col-span-2" />
        </div></section>
        <section className="rounded-md border border-[#dfe1e6] bg-white p-5 shadow-sm"><h2 className="mb-4 font-semibold text-[#172b4d]">Members ({members.length})</h2>
          <div className="space-y-3">{members.map((member) => <div key={member.member_id} className="flex flex-wrap items-center gap-3 rounded border border-[#dfe1e6] p-3"><Link href={"/users/" + member.user_id} className="min-w-32 flex-1 text-sm font-medium text-[#0c66e4] hover:underline">{candidates.find((item) => item.user_id === member.user_id)?.name ?? member.user_id}</Link><InlineDetailField label="Responsibility" value={member.responsibility} canEdit={canManageMembers} onSave={async (value) => { await updateMember.mutateAsync({ teamId, memberId: member.member_id, payload: { responsibility: value || null } }); toast.success("Member updated"); }} className="min-w-44 flex-1" />{canManageMembers && <Button variant="ghost" size="sm" onClick={() => void removeMember.mutateAsync({ teamId, memberId: member.member_id }).then(() => toast.success("Member removed")).catch((error) => toast.error(getApiErrorMessage(error)))}>Remove</Button>}</div>)}</div>
          {canManageMembers && <div className="mt-4 flex gap-2"><select aria-label="Add team member" value={newMemberId} onChange={(event) => setNewMemberId(event.target.value)} className="min-w-0 flex-1 rounded border px-2 py-1.5 text-sm"><option value="">Choose a member</option>{availableMembers.map((candidate) => <option key={candidate.user_id} value={candidate.user_id}>{candidate.name}</option>)}</select><Button size="sm" onClick={() => void add()} disabled={!newMemberId || addMember.isPending}>Add member</Button></div>}
        </section>
      </div>
      <aside className="space-y-5"><section className="rounded-md border border-[#dfe1e6] bg-white p-5 shadow-sm"><h2 className="mb-4 font-semibold text-[#172b4d]">Team lead</h2><InlineDetailField label="Lead" value={team.team_lead_id} canEdit={canEdit} type="select" options={leads.map((item) => ({ value: item.team_lead_id, label: candidates.find((candidate) => candidate.user_id === item.user_id)?.name ?? item.user_id }))} display={candidates.find((item) => item.user_id === lead?.user_id)?.name ?? lead?.user_id} onSave={(value) => save({ team_lead_id: value })} /></section><section className="rounded-md border border-[#dfe1e6] bg-white p-5 text-xs text-[#626f86] shadow-sm"><p>Created {new Date(team.created_at).toLocaleString()}</p><p className="mt-2">Updated {new Date(team.updated_at).toLocaleString()}</p></section></aside>
    </div>
  </div>;
}
