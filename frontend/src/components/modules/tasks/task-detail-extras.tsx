"use client";
import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { InlineDetailField } from "@/components/shared/inline-detail-field";
import { Button } from "@/components/ui/button";
import { tasksApi } from "@/lib/api/tasks";
import { getApiErrorMessage } from "@/lib/api/client";
import { useUpdateCardChecklist } from "@/hooks/queries/use-tasks";
import type { Task, TaskAttachment } from "@/types/task";

export function TaskChecklistDetails({ task, canEdit }: { task: Task; canEdit: boolean }) {
  const update = useUpdateCardChecklist();
  const { data: members = [] } = useQuery({ queryKey: ["tasks", task.task_id, "checklist-member-options"], queryFn: () => tasksApi.getChecklistMemberOptions(task.task_id), enabled: canEdit });
  if (!task.checklist_items?.length) return null;
  return <section className="rounded-md border border-[#dfe1e6] bg-white p-5 shadow-sm"><h2 className="mb-3 font-semibold text-[#172b4d]">Checklist assignments and dates</h2><div className="space-y-3">{task.checklist_items.map((item) => <div key={item.item_id} className="rounded border p-3"><p className="mb-2 text-sm font-medium">{item.text}</p><div className="grid gap-3 sm:grid-cols-2"><InlineDetailField label="Assignee" value={item.assignee_user_id} display={item.assignee_name} canEdit={canEdit} type="select" options={[{ value: "", label: "Unassigned" }, ...members.map((member) => ({ value: member.user_id, label: member.name }))]} onSave={async (value) => { await update.mutateAsync({ taskId: task.task_id, items: (task.checklist_items ?? []).map((entry) => entry.item_id === item.item_id ? { ...entry, assignee_user_id: value || null } : entry) }); toast.success("Checklist assignee updated"); }} /><InlineDetailField label="Due date" value={item.due_date} canEdit={canEdit} type="date" onSave={async (value) => { await update.mutateAsync({ taskId: task.task_id, items: (task.checklist_items ?? []).map((entry) => entry.item_id === item.item_id ? { ...entry, due_date: value || null } : entry) }); toast.success("Checklist due date updated"); }} /></div></div>)}</div></section>;
}

export function TaskAttachments({ taskId, canView, canUpload, canDelete }: { taskId: string; canView: boolean; canUpload: boolean; canDelete: boolean }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { data: attachments = [], isLoading } = useQuery({ queryKey: ["tasks", taskId, "attachments"], queryFn: () => tasksApi.getCardAttachments(taskId), enabled: canView });
  const upload = useMutation({ mutationFn: (file: File) => tasksApi.uploadCardAttachment(taskId, file), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks", taskId, "attachments"] }) });
  const remove = useMutation({ mutationFn: (id: string) => tasksApi.deleteCardAttachment(taskId, id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks", taskId, "attachments"] }) });
  const download = async (attachment: TaskAttachment) => {
    try { const blob = await tasksApi.downloadCardAttachment(taskId, attachment.attachment_id); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = attachment.original_filename; anchor.click(); URL.revokeObjectURL(url); }
    catch (error) { toast.error(getApiErrorMessage(error)); }
  };
  if (!canView) return null;
  return <section className="rounded-md border border-[#dfe1e6] bg-white p-5 shadow-sm"><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold text-[#172b4d]">Attachments</h2>{canUpload && <><input ref={fileInput} type="file" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload.mutateAsync(file).then(() => toast.success("Attachment uploaded")).catch((error) => toast.error(getApiErrorMessage(error))); event.target.value = ""; }} /><Button size="sm" variant="outline" onClick={() => fileInput.current?.click()} disabled={upload.isPending}>Add file</Button></>}</div>{isLoading ? <p className="text-sm text-[#626f86]">Loading attachments…</p> : attachments.length ? <ul className="space-y-2">{attachments.map((attachment) => <li key={attachment.attachment_id} className="flex items-center gap-2 rounded border p-2 text-sm"><span className="min-w-0 flex-1 truncate">{attachment.original_filename}</span><Button size="sm" variant="ghost" onClick={() => void download(attachment)}>Download</Button>{canDelete && <Button size="sm" variant="ghost" disabled={remove.isPending} onClick={() => void remove.mutateAsync(attachment.attachment_id).then(() => toast.success("Attachment removed")).catch((error) => toast.error(getApiErrorMessage(error)))}>Remove</Button>}</li>)}</ul> : <p className="text-sm text-[#626f86]">No attachments.</p>}</section>;
}
