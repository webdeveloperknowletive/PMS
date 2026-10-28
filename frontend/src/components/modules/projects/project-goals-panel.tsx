"use client";

import { useState, type FormEvent } from "react";
import { Target, Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateProjectGoal, useProjectGoals, useUpdateProjectGoal } from "@/hooks/queries/use-projects";
import { usePermissions } from "@/hooks/use-permissions";
import { useUsers } from "@/hooks/queries/use-users";
import { getApiErrorMessage } from "@/lib/api/client";

const goalStatuses = ["ACTIVE", "AT_RISK", "COMPLETED", "CANCELLED"] as const;
const NONE = "__none__";

export function ProjectGoalsPanel({ projectId }: { projectId: string }) {
  const { data: goals = [], isLoading } = useProjectGoals(projectId);
  const createGoal = useCreateProjectGoal();
  const updateGoal = useUpdateProjectGoal();
  const { data: users = [] } = useUsers();
  const { permissionCodes } = usePermissions();
  const canManageGoals = ["projects.create", "projects.update", "projects.delete", "projects.manage", "roles.manage"].some((code) => permissionCodes.includes(code));
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [successMeasure, setSuccessMeasure] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [ownerId, setOwnerId] = useState(NONE);
  const [parentGoalId, setParentGoalId] = useState(NONE);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await createGoal.mutateAsync({ projectId, payload: { name: name.trim(), description: description.trim() || null, success_measure: successMeasure.trim() || null, owner_id: ownerId === NONE ? null : ownerId, parent_goal_id: parentGoalId === NONE ? null : parentGoalId, target_date: targetDate || null } });
      setName(""); setDescription(""); setSuccessMeasure(""); setTargetDate(""); setOwnerId(NONE); setParentGoalId(NONE); setShowForm(false);
      toast.success("Goal created");
    } catch (error) { toast.error(getApiErrorMessage(error)); }
  };

  return <Card id="project-goals" className="scroll-mt-24 border-white/90">
    <CardHeader className="flex flex-row items-center gap-3 border-b border-slate-100 px-4 py-3.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-700"><Target className="h-4 w-4" /></span>
      <CardTitle className="min-w-0 flex-1 text-sm">Goals and initiatives</CardTitle>
      <Badge variant="secondary">{goals.length}</Badge>
      {canManageGoals && <Button size="sm" variant="outline" onClick={() => setShowForm((value) => !value)}><Plus className="h-4 w-4" /> Add goal</Button>}
    </CardHeader>
    <CardContent className="space-y-3 p-4">
      {showForm && <form onSubmit={(event) => void submit(event)} className="grid gap-3 rounded-xl border border-violet-100 bg-violet-50/40 p-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="goal-name">Goal name</Label><Input id="goal-name" value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={150} required /></div>
        <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="goal-description">Outcome</Label><Input id="goal-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={5000} placeholder="What outcome defines success?" /></div>
        <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="goal-success-measure">Success measure</Label><Input id="goal-success-measure" value={successMeasure} onChange={(event) => setSuccessMeasure(event.target.value)} maxLength={2000} placeholder="How will the outcome be measured?" /></div>
        <div className="space-y-1.5"><Label>Owner</Label><Select value={ownerId} onValueChange={setOwnerId}><SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger><SelectContent><SelectItem value={NONE}>Unassigned</SelectItem>{users.filter((user) => user.is_active).map((user) => <SelectItem key={user.user_id} value={user.user_id}>{user.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1.5"><Label>Parent initiative</Label><Select value={parentGoalId} onValueChange={setParentGoalId}><SelectTrigger><SelectValue placeholder="No parent" /></SelectTrigger><SelectContent><SelectItem value={NONE}>No parent</SelectItem>{goals.map((goal) => <SelectItem key={goal.goal_id} value={goal.goal_id}>{goal.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1.5"><Label htmlFor="goal-target-date">Target date</Label><Input id="goal-target-date" type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} /></div>
        <div className="flex items-end justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button><Button type="submit" disabled={createGoal.isPending}>Create goal</Button></div>
      </form>}
      {isLoading ? <p className="text-xs text-slate-500">Loading goals…</p> : goals.length === 0 ? <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">No goals are linked to this project yet.</p> : goals.map((goal) => <div key={goal.goal_id} className="rounded-xl border border-slate-100 p-3">
        <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{goal.name}</p>{goal.description && <p className="mt-1 text-xs text-slate-500">{goal.description}</p>}</div>
          {canManageGoals ? <Select value={goal.status} onValueChange={(status) => updateGoal.mutate({ projectId, goalId: goal.goal_id, payload: { status: status as typeof goal.status } }, { onError: (error) => toast.error(getApiErrorMessage(error)) })}><SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger><SelectContent>{goalStatuses.map((status) => <SelectItem key={status} value={status}>{status.replace("_", " ")}</SelectItem>)}</SelectContent></Select> : <Badge variant="outline">{goal.status.replace("_", " ")}</Badge>}
        </div>
        {goal.success_measure && <p className="mt-2 text-xs text-slate-600"><span className="font-medium">Success measure:</span> {goal.success_measure}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          {canManageGoals ? <><Select value={goal.owner_id ?? NONE} onValueChange={(value) => updateGoal.mutate({ projectId, goalId: goal.goal_id, payload: { owner_id: value === NONE ? null : value } }, { onError: (error) => toast.error(getApiErrorMessage(error)) })}><SelectTrigger className="h-8 w-40" aria-label={`Owner for ${goal.name}`}><SelectValue placeholder="Owner" /></SelectTrigger><SelectContent><SelectItem value={NONE}>Unassigned</SelectItem>{users.filter((user) => user.is_active).map((user) => <SelectItem key={user.user_id} value={user.user_id}>{user.name}</SelectItem>)}</SelectContent></Select>
          <Select value={goal.parent_goal_id ?? NONE} onValueChange={(value) => updateGoal.mutate({ projectId, goalId: goal.goal_id, payload: { parent_goal_id: value === NONE ? null : value } }, { onError: (error) => toast.error(getApiErrorMessage(error)) })}><SelectTrigger className="h-8 w-44" aria-label={`Parent initiative for ${goal.name}`}><SelectValue placeholder="Parent initiative" /></SelectTrigger><SelectContent><SelectItem value={NONE}>No parent</SelectItem>{goals.filter((parent) => parent.goal_id !== goal.goal_id).map((parent) => <SelectItem key={parent.goal_id} value={parent.goal_id}>{parent.name}</SelectItem>)}</SelectContent></Select></> : <span>{goal.owner_name ? `Owner: ${goal.owner_name}` : "Unassigned"}{goal.parent_goal_id ? ` · Parent: ${goals.find((parent) => parent.goal_id === goal.parent_goal_id)?.name ?? "initiative"}` : ""}</span>}
        </div>
        <div className="mt-3"><div className="mb-1 flex justify-between text-[11px] text-slate-500"><span>{goal.completed_task_count} of {goal.task_count} linked tasks complete{goal.target_date ? ` · target ${goal.target_date}` : ""}</span><span>{goal.progress_percent}%</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-violet-600 transition-all" style={{ width: `${goal.progress_percent}%` }} /></div></div>
      </div>)}
    </CardContent>
  </Card>;
}
