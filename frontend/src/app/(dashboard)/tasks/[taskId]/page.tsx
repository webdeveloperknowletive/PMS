"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { InlineDetailField, type InlineDetailOption } from "@/components/shared/inline-detail-field";
import { InlineMultiSelectField } from "@/components/shared/inline-multi-select-field";
import { TaskActivityDialog } from "@/components/modules/tasks/task-activity-dialog";
import { TaskAttachments, TaskChecklistDetails } from "@/components/modules/tasks/task-detail-extras";
import { Button } from "@/components/ui/button";
import { TaskStatusBadge } from "@/components/shared/status-badge";
import { PriorityBadge } from "@/components/shared/priority-badge";
import { useProjectAssigneeCandidates, useSprints, useTask, useTasks, useUpdateCardChecklist, useUpdateTask } from "@/hooks/queries/use-tasks";
import { useProjectComponents, useProjectCustomFields, useProjectGoals, useProjectReleases } from "@/hooks/queries/use-projects";
import { useKanbanCardMemberOptions, useUpdateKanbanCardMembers } from "@/hooks/queries/use-kanban";
import { usePermissions } from "@/hooks/use-permissions";
import { useAuthStore } from "@/store/auth-store";
import { canUpdateTask } from "@/lib/permissions";
import { PRIORITY_LABEL, TASK_PRIORITIES, TASK_STATUS_LABEL, TASK_STATUSES } from "@/lib/constants";
import type { Task, TaskChecklistItem, TaskUpdate } from "@/types/task";

const option = (value: string, label = value): InlineDetailOption => ({ value, label });
const choices = (items: { id: string; name: string }[], current?: string | null) => [
  option("", "None"), ...items.map((item) => option(item.id, item.name)),
  ...(current && !items.some((item) => item.id === current) ? [option(current, "Current selection")] : []),
];

function WorkItemDetails({ task, canEdit }: { task: Task; canEdit: boolean }) {
  const update = useUpdateTask();
  const checklist = useUpdateCardChecklist();
  const cardMembers = useUpdateKanbanCardMembers();
  const { permissionCodes } = usePermissions();
  const canManageCardMembers = permissionCodes.includes("kanban.cards.members.manage") || permissionCodes.includes("roles.manage");
  const { data: memberOptions = [] } = useKanbanCardMemberOptions(task.task_id, canManageCardMembers);
  const { data: assignees = [] } = useProjectAssigneeCandidates(task.project_id, canEdit);
  const { data: goals = [] } = useProjectGoals(task.project_id);
  const { data: releases = [] } = useProjectReleases(task.project_id);
  const { data: components = [] } = useProjectComponents(task.project_id);
  const { data: customFields = [] } = useProjectCustomFields(task.project_id);
  const { data: sprints = [] } = useSprints(task.project_id);
  const { data: projectTasks = [] } = useTasks({ project_id: task.project_id, limit: 500 });
  const save = async (payload: TaskUpdate) => { await update.mutateAsync({ id: task.task_id, payload }); toast.success("Work item updated"); };
  const saveChecklist = async (items: TaskChecklistItem[]) => { await checklist.mutateAsync({ taskId: task.task_id, items }); toast.success("Checklist updated"); };

  return <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
    <div className="space-y-5">
      <section className="rounded-md border border-[#dfe1e6] bg-white p-5 shadow-sm">
        <InlineDetailField label="Summary" value={task.task_name} canEdit={canEdit} required validate={(value) => value.length < 2 ? "Use at least 2 characters" : value.length > 255 ? "Use 255 characters or fewer" : undefined} onSave={(value) => save({ task_name: value })} />
        <div className="mt-5"><InlineDetailField label="Description" value={task.description} canEdit={canEdit} type="textarea" placeholder="Add a description" onSave={(value) => save({ description: value || null })} /></div>
      </section>
      <section className="rounded-md border border-[#dfe1e6] bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-semibold text-[#172b4d]">Details</h2>
        <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <InlineDetailField label="Type" value={task.task_type ?? "TASK"} canEdit={canEdit} type="select" options={["EPIC","STORY","TASK","BUG","SPIKE","SUBTASK"].map((value) => option(value))} onSave={(value) => save({ task_type: value as TaskUpdate["task_type"] })} />
          <InlineDetailField label="Priority" value={task.priority} canEdit={canEdit} type="select" options={TASK_PRIORITIES.map((value) => option(value, PRIORITY_LABEL[value]))} display={<PriorityBadge priority={task.priority} />} onSave={(value) => save({ priority: value as TaskUpdate["priority"] })} />
          <InlineDetailField label="Story points" value={task.story_points} canEdit={canEdit} type="number" validate={(value) => value && (Number.isNaN(Number(value)) || Number(value) < 0) ? "Enter a nonnegative number" : undefined} onSave={(value) => save({ story_points: value ? Number(value) : null })} />
          <InlineDetailField label="Labels" value={task.labels?.join(", ")} canEdit={canEdit} placeholder="Add labels" validate={(value) => value.split(",").filter((label) => label.trim()).length > 20 ? "Use 20 labels or fewer" : undefined} onSave={(value) => save({ labels: [...new Set(value.split(",").map((label) => label.trim()).filter(Boolean))] })} />
          <InlineDetailField label="Start date" value={task.start_date} canEdit={canEdit} type="date" onSave={(value) => save({ start_date: value || null })} />
          <InlineDetailField label="Due date" value={task.due_date} canEdit={canEdit} type="date" onSave={(value) => save({ due_date: value || null })} />
          <InlineDetailField label="Reminder" value={task.reminder_days_before == null ? "" : String(task.reminder_days_before)} canEdit={canEdit} type="select" options={[option("", "None"), option("0", "On due date"), option("1", "1 day before"), option("2", "2 days before"), option("7", "7 days before")]} display={task.reminder_days_before == null ? "None" : task.reminder_days_before === 0 ? "On due date" : task.reminder_days_before + " days before"} onSave={(value) => save({ reminder_days_before: value ? Number(value) as 0 | 1 | 2 | 7 : null })} />
          <InlineDetailField label="Parent work item" value={task.parent_task_id} canEdit={canEdit} type="select" options={choices(projectTasks.filter((item) => item.task_id !== task.task_id).map((item) => ({ id: item.task_id, name: item.task_name })), task.parent_task_id)} display={projectTasks.find((item) => item.task_id === task.parent_task_id)?.task_name} onSave={(value) => save({ parent_task_id: value || null })} />
          <InlineDetailField label="Goal" value={task.goal_id} canEdit={canEdit} type="select" options={choices(goals.map((item) => ({ id: item.goal_id, name: item.name })), task.goal_id)} display={goals.find((item) => item.goal_id === task.goal_id)?.name} onSave={(value) => save({ goal_id: value || null })} />
          <InlineDetailField label="Release" value={task.release_id} canEdit={canEdit} type="select" options={choices(releases.map((item) => ({ id: item.release_id, name: item.name })), task.release_id)} display={releases.find((item) => item.release_id === task.release_id)?.name} onSave={(value) => save({ release_id: value || null })} />
          <InlineDetailField label="Component" value={task.component_id} canEdit={canEdit} type="select" options={choices(components.map((item) => ({ id: item.component_id, name: item.name })), task.component_id)} display={components.find((item) => item.component_id === task.component_id)?.name} onSave={(value) => save({ component_id: value || null })} />
          <InlineDetailField label="Sprint" value={task.sprint_id} canEdit={canEdit} type="select" options={choices(sprints.map((item) => ({ id: item.sprint_id, name: item.sprint_name })), task.sprint_id)} display={sprints.find((item) => item.sprint_id === task.sprint_id)?.sprint_name} onSave={(value) => save({ sprint_id: value || null })} />
        </div>
      </section>
      {customFields.length > 0 && <section className="rounded-md border border-[#dfe1e6] bg-white p-5 shadow-sm"><h2 className="mb-4 font-semibold text-[#172b4d]">Custom fields</h2><div className="grid gap-4 sm:grid-cols-2">{customFields.map((field) => <InlineDetailField key={field.field_id} label={field.name} value={String(task.custom_fields?.[field.field_id] ?? "")} canEdit={canEdit} type={field.field_type === "DATE" ? "date" : field.field_type === "NUMBER" ? "number" : field.field_type === "SINGLE_SELECT" || field.field_type === "CHECKBOX" ? "select" : "text"} options={field.field_type === "CHECKBOX" ? [option("false", "No"), option("true", "Yes")] : [option("", "None"), ...field.options.map((value) => option(value))]} onSave={(value) => save({ custom_fields: { ...task.custom_fields, [field.field_id]: field.field_type === "NUMBER" ? value ? Number(value) : null : field.field_type === "CHECKBOX" ? value === "true" : value || null } })} />)}</div></section>}
      <section className="rounded-md border border-[#dfe1e6] bg-white p-5 shadow-sm"><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold text-[#172b4d]">Checklist</h2>{canEdit && <Button size="sm" variant="outline" onClick={() => void saveChecklist([...(task.checklist_items ?? []), { item_id: crypto.randomUUID(), text: "New item", is_completed: false }])}>Add item</Button>}</div>{task.checklist_items?.length ? <div className="space-y-2">{task.checklist_items.map((item, index) => <div key={item.item_id} className="group/checklist flex items-start gap-2 border-b pb-2 last:border-0"><input type="checkbox" aria-label={"Complete " + item.text} checked={item.is_completed} disabled={!canEdit || checklist.isPending} onChange={(event) => void saveChecklist((task.checklist_items ?? []).map((entry, itemIndex) => itemIndex === index ? { ...entry, is_completed: event.target.checked } : entry))} className="mt-7" />{canEdit && <Pencil className="mt-7 h-3 w-3 text-[#626f86] opacity-0 group-hover/checklist:opacity-100" />}<InlineDetailField label={"Item " + (index + 1)} value={item.text} canEdit={canEdit} required onSave={(value) => saveChecklist((task.checklist_items ?? []).map((entry, itemIndex) => itemIndex === index ? { ...entry, text: value } : entry))} className="flex-1" />{canEdit && <button type="button" className="mt-6 text-xs text-[#626f86] hover:text-red-600" onClick={() => void saveChecklist((task.checklist_items ?? []).filter((_, itemIndex) => itemIndex !== index))}>Remove</button>}</div>)}</div> : <p className="text-sm text-[#626f86]">No checklist items.</p>}</section>
      <TaskChecklistDetails task={task} canEdit={permissionCodes.includes("kanban.card_checklists.items.manage") || permissionCodes.includes("roles.manage")} />
      <TaskAttachments taskId={task.task_id} canView={permissionCodes.includes("kanban.card_attachments.view") || permissionCodes.includes("roles.manage")} canUpload={permissionCodes.includes("kanban.card_attachments.upload") || permissionCodes.includes("roles.manage")} canDelete={permissionCodes.includes("kanban.card_attachments.delete") || permissionCodes.includes("roles.manage")} />
    </div>
    <aside className="space-y-5">
      <section className="rounded-md border border-[#dfe1e6] bg-white p-5 shadow-sm"><h2 className="mb-4 font-semibold text-[#172b4d]">People and status</h2><div className="space-y-4">
        <InlineDetailField label="Status" value={task.status} canEdit={canEdit} type="select" options={TASK_STATUSES.map((value) => option(value, TASK_STATUS_LABEL[value]))} display={<TaskStatusBadge status={task.status} />} onSave={(value) => save({ status: value as TaskUpdate["status"] })} />
        <InlineDetailField label="Assignee" value={task.user_id} canEdit={canEdit} type="select" options={choices(assignees.map((item) => ({ id: item.user_id, name: item.name })), task.user_id)} display={task.assignee_name} onSave={(value) => save({ user_id: value || null })} />
        <InlineMultiSelectField label="Additional members" values={(task.card_members ?? []).filter((member) => !member.is_primary && member.user_id !== task.user_id).map((member) => member.user_id)} options={[...new Map([...memberOptions.filter((member) => member.is_eligible && member.user_id !== task.user_id).map((member) => ({ value: member.user_id, label: member.name })), ...(task.card_members ?? []).filter((member) => !member.is_primary).map((member) => ({ value: member.user_id, label: member.name }))].map((member) => [member.value, member])).values()]} canEdit={canManageCardMembers} onSave={async (values) => { await cardMembers.mutateAsync({ taskId: task.task_id, memberIds: values }); toast.success("Members updated"); }} />
        <div><p className="mb-1 text-xs font-medium text-[#626f86]">Project</p><Link href={"/projects/" + task.project_id} className="px-2 text-sm text-[#0c66e4] hover:underline">Open project</Link></div>
      </div></section>
      <section className="rounded-md border border-[#dfe1e6] bg-white p-5 text-xs text-[#626f86] shadow-sm"><p>Created {new Date(task.created_at).toLocaleString()}</p><p className="mt-2">Updated {new Date(task.updated_at).toLocaleString()}</p></section>
    </aside>
  </div>;
}

export default function WorkItemPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const [tab, setTab] = useState<"details" | "activity">("details");
  const { data: task, isLoading, isError } = useTask(taskId);
  const { permissionCodes } = usePermissions();
  const currentUser = useAuthStore((state) => state.user);
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading work item…</p>;
  if (isError || !task) return <p className="text-sm text-destructive">This work item is unavailable.</p>;
  const canEdit = !!currentUser && canUpdateTask(task.user_id, currentUser.user_id, permissionCodes);
  return <div className="space-y-5">
    <PageHeader title={task.task_name} description={task.task_type + " · " + task.task_id} showHome={false} actions={<Button asChild variant="outline" size="sm"><Link href={"/projects/" + task.project_id}>Project</Link></Button>} />
    <div role="tablist" aria-label="Work item sections" className="flex gap-2 border-b">
      <button role="tab" aria-selected={tab === "details"} onClick={() => setTab("details")} className={"border-b-2 px-3 py-2 text-sm " + (tab === "details" ? "border-[#0c66e4] font-semibold text-[#0c66e4]" : "border-transparent text-[#44546f]")}>Details</button>
      <button role="tab" aria-selected={tab === "activity"} onClick={() => setTab("activity")} className={"border-b-2 px-3 py-2 text-sm " + (tab === "activity" ? "border-[#0c66e4] font-semibold text-[#0c66e4]" : "border-transparent text-[#44546f]")}>Activity &amp; links</button>
    </div>
    {tab === "details" && <WorkItemDetails task={task} canEdit={canEdit} />}
    {tab === "activity" && <TaskActivityDialog page task={task} open onOpenChange={() => setTab("details")} canComment={canEdit} />}
  </div>;
}
