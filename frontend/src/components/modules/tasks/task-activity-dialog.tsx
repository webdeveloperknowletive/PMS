"use client";

import { useEffect, useState } from "react";
import { Link2, MessageCircle, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAddTaskComment, useCreateTaskLink, useDeleteTaskLink, useProjectBlockerOwners, useTaskActivity, useTaskComments, useTaskLinks, useTaskStatusHistory, useTasks, useUpdateTaskLinkOwner } from "@/hooks/queries/use-tasks";
import { usePermissions } from "@/hooks/use-permissions";
import { getApiErrorMessage } from "@/lib/api/client";
import type { Task, TaskLinkType } from "@/types/task";
import { TASK_STATUS_LABEL } from "@/lib/constants";

function formatMoment(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function TaskActivityDialog({ task, open, onOpenChange, canComment = false }: { task: Task | null; open: boolean; onOpenChange: (open: boolean) => void; canComment?: boolean }) {
  const taskId = task?.task_id;
  const { canManageTasks } = usePermissions();
  const { data: comments = [] } = useTaskComments(taskId);
  const { data: activity = [] } = useTaskActivity(taskId);
  const { data: statusHistory = [] } = useTaskStatusHistory(taskId);
  const { data: links = [] } = useTaskLinks(taskId, open);
  const { data: projectTasks = [] } = useTasks({ project_id: task?.project_id, limit: 500 }, !!task?.project_id && open);
  const { data: blockerOwners = [] } = useProjectBlockerOwners(task?.project_id, open && canManageTasks);
  const addComment = useAddTaskComment();
  const createLink = useCreateTaskLink();
  const deleteLink = useDeleteTaskLink();
  const updateLinkOwner = useUpdateTaskLinkOwner();
  const [content, setContent] = useState("");
  const [targetTaskId, setTargetTaskId] = useState("");
  const [linkType, setLinkType] = useState<TaskLinkType>("BLOCKS");
  const [linkOwnerId, setLinkOwnerId] = useState("");
  useEffect(() => { if (!open) setContent(""); }, [open]);

  const submit = async () => {
    if (!taskId || !content.trim()) return;
    try { await addComment.mutateAsync({ taskId, content: content.trim() }); setContent(""); }
    catch (error) { toast.error(getApiErrorMessage(error)); }
  };

  const submitLink = async () => {
    if (!taskId || !targetTaskId) return;
    try { await createLink.mutateAsync({ taskId, payload: { target_task_id: targetTaskId, link_type: linkType, owner_id: linkType === "BLOCKS" ? linkOwnerId || null : null } }); setTargetTaskId(""); setLinkOwnerId(""); toast.success("Task link added"); }
    catch (error) { toast.error(getApiErrorMessage(error)); }
  };
  const changeBlockerOwner = (linkId: string, value: string) => {
    if (!taskId) return;
    updateLinkOwner.mutate(
      { taskId, linkId, ownerId: value === "__none__" ? null : value },
      { onSuccess: () => toast.success("Blocker owner updated"), onError: (error) => toast.error(getApiErrorMessage(error)) },
    );
  };
  const linkLabel = (link: (typeof links)[number]) => {
    const isSource = link.source_task_id === taskId;
    if (link.link_type === "BLOCKS") return isSource ? `blocks ${link.target_task_name}` : `is blocked by ${link.source_task_name}`;
    const otherName = isSource ? link.target_task_name : link.source_task_name;
    return `${link.link_type === "DUPLICATES" ? "duplicates" : "relates to"} ${otherName}`;
  };

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader><DialogTitle>{task?.task_name ?? "Task details"}</DialogTitle><DialogDescription>Comments and changes for this task.</DialogDescription></DialogHeader>
      <section className="space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><MessageCircle className="h-4 w-4" />Comments</h3>
        <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg bg-slate-50 p-3">
          {comments.length ? comments.map((comment) => <article key={comment.comment_id} className="rounded-lg border bg-white p-3"><div className="flex justify-between gap-2"><span className="text-xs font-semibold text-slate-800">{comment.author_name ?? "Workspace member"}</span><time className="text-[10px] text-slate-500">{formatMoment(comment.created_at)}</time></div><p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{comment.content}</p></article>) : <p className="py-4 text-center text-xs text-slate-500">No comments yet. Add the first update.</p>}
        </div>
        {canComment ? <div className="flex items-end gap-2"><Textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="Write a comment for your team…" rows={2} /><Button onClick={() => void submit()} disabled={!content.trim() || addComment.isPending} aria-label="Send comment"><Send className="h-4 w-4" /></Button></div> : <p className="text-xs text-slate-500">You can view comments. Only task managers or the assigned teammate can add one.</p>}
      </section>
      <section className="space-y-3 border-t pt-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><Link2 className="h-4 w-4" />Linked work and blockers</h3>
        {links.length ? <ul className="space-y-2">{links.map((link) => <li key={link.link_id} className="flex flex-wrap items-center gap-2 rounded-lg border bg-white p-2 text-xs"><span className="min-w-0 flex-1">{linkLabel(link)}</span>{link.link_type === "BLOCKS" && canManageTasks ? <Select value={link.owner_id ?? "__none__"} onValueChange={(value) => changeBlockerOwner(link.link_id, value)}><SelectTrigger className="h-8 w-40" aria-label={`Owner for blocker to ${link.target_task_name}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__none__">No owner</SelectItem>{link.owner_id && !blockerOwners.some((owner) => owner.user_id === link.owner_id) && <SelectItem value={link.owner_id}>{link.owner_name ?? "Current owner"}</SelectItem>}{blockerOwners.map((owner) => <SelectItem key={owner.user_id} value={owner.user_id}>{owner.name}</SelectItem>)}</SelectContent></Select> : link.owner_name ? <span className="text-muted-foreground">Owner: {link.owner_name}</span> : null}{canManageTasks && <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Remove task link" onClick={() => deleteLink.mutate({ taskId: taskId!, linkId: link.link_id }, { onError: (error) => toast.error(getApiErrorMessage(error)) })}><Trash2 className="h-3.5 w-3.5" /></Button>}</li>)}</ul> : <p className="text-xs text-slate-500">No linked tasks yet.</p>}
        {canManageTasks && <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_140px_160px_auto]">
          <Select value={targetTaskId} onValueChange={setTargetTaskId}><SelectTrigger><SelectValue placeholder="Choose a task in this project" /></SelectTrigger><SelectContent>{projectTasks.filter((item) => item.task_id !== taskId).map((item) => <SelectItem key={item.task_id} value={item.task_id}>{item.task_name}</SelectItem>)}</SelectContent></Select>
          <Select value={linkType} onValueChange={(value) => { setLinkType(value as TaskLinkType); if (value !== "BLOCKS") setLinkOwnerId(""); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="BLOCKS">Blocks</SelectItem><SelectItem value="RELATES_TO">Relates to</SelectItem><SelectItem value="DUPLICATES">Duplicates</SelectItem></SelectContent></Select>
          {linkType === "BLOCKS" ? <Select value={linkOwnerId || "__none__"} onValueChange={(value) => setLinkOwnerId(value === "__none__" ? "" : value)}><SelectTrigger aria-label="Optional blocker owner"><SelectValue placeholder="No owner" /></SelectTrigger><SelectContent><SelectItem value="__none__">No owner</SelectItem>{blockerOwners.map((owner) => <SelectItem key={owner.user_id} value={owner.user_id}>{owner.name}</SelectItem>)}</SelectContent></Select> : <span />}
          <Button type="button" variant="outline" onClick={() => void submitLink()} disabled={!targetTaskId || createLink.isPending}>Add link</Button>
        </div>}
      </section>
      <section className="space-y-3 border-t pt-4">
        <h3 className="text-sm font-semibold">Status transitions</h3>
        {statusHistory.length ? <ol className="space-y-2">{statusHistory.map((entry) => <li key={entry.history_id} className="flex gap-3 text-xs"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" /><div><p className="text-slate-700"><span className="font-semibold">{entry.from_status ? TASK_STATUS_LABEL[entry.from_status] : "Created"}</span> → <span className="font-semibold">{TASK_STATUS_LABEL[entry.to_status]}</span></p><time className="text-[10px] text-slate-500">{formatMoment(entry.created_at)}</time></div></li>)}</ol> : <p className="text-xs text-slate-500">No status transitions have been recorded.</p>}
      </section>
      <section className="space-y-3 border-t pt-4">
        <h3 className="text-sm font-semibold">Activity history</h3>
        {activity.length ? <ol className="space-y-2">{activity.map((entry) => <li key={entry.activity_id} className="flex gap-3 text-xs"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-violet-500" /><div><p className="text-slate-700"><span className="font-semibold">{entry.actor_name ?? "Workspace member"}</span> {entry.details}</p><time className="text-[10px] text-slate-500">{formatMoment(entry.created_at)}</time></div></li>)}</ol> : <p className="text-xs text-slate-500">No history has been recorded yet.</p>}
      </section>
    </DialogContent>
  </Dialog>;
}
