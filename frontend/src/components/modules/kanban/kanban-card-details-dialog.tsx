"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Download, Paperclip, Plus, Tag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KanbanLabelColorPicker } from "@/components/modules/kanban/kanban-label-color-picker";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useAddTaskComment, useTaskComments } from "@/hooks/queries/use-tasks";
import { useUpdateKanbanCardDetails } from "@/hooks/queries/use-kanban";
import { tasksApi } from "@/lib/api/tasks";
import { getApiErrorMessage } from "@/lib/api/client";
import type { Task, TaskChecklistItem } from "@/types/task";

const ATTACHMENT_EXTENSIONS = new Set(["csv", "doc", "docx", "gif", "jpeg", "jpg", "pdf", "png", "ppt", "pptx", "txt", "webp", "xls", "xlsx", "zip"]);

export function KanbanCardDetailsDialog({
  task,
  open,
  onOpenChange,
  canEdit,
  canManageMembers,
  onManageMembers,
  canViewComments = false,
  canPostComments = false,
  canViewAttachments = false,
  canUploadAttachments = false,
  canDeleteAttachments = false,
  canManageLabels = false,
  canEditLabels = false,
  canEditDates = false,
  canEditChecklist = false,
  canManageChecklistItemDetails = false,
}: {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit: boolean;
  canManageMembers?: boolean;
  onManageMembers?: (task: Task) => void;
  canViewComments?: boolean;
  canPostComments?: boolean;
  canViewAttachments?: boolean;
  canUploadAttachments?: boolean;
  canDeleteAttachments?: boolean;
  canManageLabels?: boolean;
  canEditLabels?: boolean;
  canEditDates?: boolean;
  canEditChecklist?: boolean;
  canManageChecklistItemDetails?: boolean;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [labels, setLabels] = useState<string[]>([]);
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [reminder, setReminder] = useState("none");
  const [checklist, setChecklist] = useState<TaskChecklistItem[]>([]);
  const [hideCompleted, setHideCompleted] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [removedAttachmentIds, setRemovedAttachmentIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const updateDetails = useUpdateKanbanCardDetails();
  const queryClient = useQueryClient();
  const attachmentInput = useRef<HTMLInputElement>(null);
  const [commentText, setCommentText] = useState("");
  const comments = useTaskComments(canViewComments ? task?.task_id : undefined);
  const addComment = useAddTaskComment();
  const checklistMembers = useQuery({
    queryKey: ["tasks", task?.task_id, "checklist-member-options"],
    queryFn: () => tasksApi.getChecklistMemberOptions(task!.task_id),
    enabled: !!task && open && canManageChecklistItemDetails,
  });
  const attachments = useQuery({
    queryKey: ["tasks", task?.task_id, "attachments"],
    queryFn: () => tasksApi.getCardAttachments(task!.task_id),
    enabled: !!task && open && canViewAttachments,
  });
  const cardMembers = task?.card_members ?? [];
  const canEditAny = canEdit || canEditLabels || canManageLabels || canEditDates || canEditChecklist || canUploadAttachments || canDeleteAttachments;
  const membersSection = <section className="space-y-2 rounded-lg border p-3" aria-label="Card members">
    <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">Members</h3>
      {task && canManageMembers && onManageMembers && <Button type="button" variant="outline" size="sm" onClick={() => onManageMembers(task)}>Assign</Button>}
    </div>
    {cardMembers.length > 0 ? <div className="flex flex-wrap items-center gap-3">
      {cardMembers.map((member) => <div key={member.user_id} className="flex items-center gap-2" title={member.is_primary ? `${member.name} · Primary assignee` : member.name}>
        <UserAvatar user={{ user_id: member.user_id, name: member.name, profile_picture_url: member.profile_picture_url }} showName size="sm" />
        {member.is_primary && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">Primary</span>}
      </div>)}
    </div> : <p className="text-sm text-muted-foreground">No members assigned.</p>}
  </section>;

  useEffect(() => {
    setTitle(task?.task_name ?? "");
    setDescription(task?.description ?? "");
    setLabels(task?.labels ?? []);
    setStartDate(task?.start_date ?? "");
    setDueDate(task?.due_date ?? "");
    setReminder(task?.reminder_days_before == null ? "none" : String(task.reminder_days_before));
    setChecklist((task?.checklist_items ?? []).map((item) => ({ ...item })));
    setStagedFiles([]);
    setRemovedAttachmentIds([]);
  }, [task, open]);

  const save = async () => {
    if (!task) return;
    setSaving(true);
    try {
      if (canEdit) await updateDetails.mutateAsync({ taskId: task.task_id, payload: { task_name: title.trim(), description: description.trim() || null } });
      if (canEditLabels && JSON.stringify(labels) !== JSON.stringify(task.labels ?? [])) await tasksApi.updateCardLabels(task.task_id, labels);
      if (canEditDates && (startDate !== (task.start_date ?? "") || dueDate !== (task.due_date ?? "") || reminder !== (task.reminder_days_before == null ? "none" : String(task.reminder_days_before)))) {
        if (startDate && dueDate && dueDate < startDate) throw new Error("Due date must be on or after the start date.");
        const selectedReminder = dueDate && reminder !== "none" ? Number(reminder) as 0 | 1 | 2 | 7 : null;
        await tasksApi.updateCardDates(task.task_id, startDate || null, dueDate || null, selectedReminder);
      }
      if (canEditChecklist && JSON.stringify(checklist) !== JSON.stringify(task.checklist_items ?? [])) {
        if (checklist.length > 100 || checklist.some((item) => !item.text.trim())) throw new Error("Checklist items must have text and be limited to 100.");
        await tasksApi.updateCardChecklist(task.task_id, checklist.map((item) => ({ ...item, text: item.text.trim() })));
      }
      for (const file of stagedFiles) await tasksApi.uploadCardAttachment(task.task_id, file);
      for (const id of removedAttachmentIds) await tasksApi.deleteCardAttachment(task.task_id, id);
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["tasks"] }), queryClient.invalidateQueries({ queryKey: ["kanban-tasks"] }), queryClient.invalidateQueries({ queryKey: ["calendar-events"] }), queryClient.invalidateQueries({ queryKey: ["tasks", task.task_id, "attachments"] }), queryClient.invalidateQueries({ queryKey: ["tasks", task.task_id, "activity"] })]);
      toast.success("Card changes saved");
      onOpenChange(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const postComment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = commentText.trim();
    if (!task || !content || content.length > 10000 || !canPostComments) return;
    try {
      await addComment.mutateAsync({ taskId: task.task_id, content });
      setCommentText("");
      toast.success("Comment added");
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  const uploadSelectedFile = (file?: File) => {
    if (!file) return;
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !ATTACHMENT_EXTENSIONS.has(extension)) {
      toast.error("This file type is not supported.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Attachments must be 20 MB or smaller.");
      return;
    }
    setStagedFiles((current) => [...current, file]);
  };

  const downloadAttachment = async (attachmentId: string, filename: string) => {
    if (!task) return;
    try {
      const blob = await tasksApi.downloadCardAttachment(task.task_id, attachmentId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  const collaborationSection = <div className="space-y-4 border-t pt-4">
    {canViewAttachments && <section className="space-y-2" aria-label="Card attachments">
      <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold"><Paperclip className="mr-1 inline h-4 w-4" />Attachments</h3>
        {canUploadAttachments && <><input ref={attachmentInput} type="file" multiple accept=".csv,.doc,.docx,.gif,.jpeg,.jpg,.pdf,.png,.ppt,.pptx,.txt,.webp,.xls,.xlsx,.zip" className="hidden" onChange={(event) => { for (const file of Array.from(event.currentTarget.files ?? [])) uploadSelectedFile(file); event.currentTarget.value = ""; }} /><Button type="button" size="sm" variant="outline" onClick={() => attachmentInput.current?.click()}>Add file</Button></>}
      </div>
      {stagedFiles.map((file, index) => <div key={`${file.name}-${index}`} className="text-xs text-muted-foreground">Will attach: {file.name} <button type="button" className="ml-2 underline" onClick={() => setStagedFiles((items) => items.filter((_, itemIndex) => itemIndex !== index))}>Remove</button></div>)}
      {attachments.isLoading ? <p className="text-sm text-muted-foreground">Loading attachments…</p> : attachments.isError ? <p role="alert" className="text-sm text-destructive">{getApiErrorMessage(attachments.error)}</p> : !attachments.data?.length ? <p className="text-sm text-muted-foreground">No files attached.</p> : <ul className="space-y-2">{attachments.data.filter((item) => !removedAttachmentIds.includes(item.attachment_id)).map((attachment) => <li key={attachment.attachment_id} className="flex min-w-0 items-center gap-2 rounded-md border p-2"><Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium" title={attachment.original_filename}>{attachment.original_filename}</p><p className="text-xs text-muted-foreground">{attachment.mime_type} · {(attachment.file_size / 1048576).toFixed(1)} MB · {attachment.uploader_name || "Workspace member"} · {new Date(attachment.created_at).toLocaleString()}</p></div><Button type="button" variant="ghost" size="icon" aria-label={`Download ${attachment.original_filename}`} onClick={() => void downloadAttachment(attachment.attachment_id, attachment.original_filename)}><Download className="h-4 w-4" /></Button>{canDeleteAttachments && <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${attachment.original_filename}`} onClick={() => setRemovedAttachmentIds((ids) => [...ids, attachment.attachment_id])}><Trash2 className="h-4 w-4 text-destructive" /></Button>}</li>)}</ul>}
    </section>}
    {canViewComments && <section className="space-y-3" aria-label="Card discussion">
      <h3 className="text-sm font-semibold">Discussion</h3>
      {comments.isLoading ? <p className="text-sm text-muted-foreground">Loading comments…</p> : comments.isError ? <p role="alert" className="text-sm text-destructive">{getApiErrorMessage(comments.error)}</p> : <ol className="max-h-56 space-y-3 overflow-y-auto">{comments.data?.map((comment) => <li key={comment.comment_id} className="flex gap-2"><UserAvatar user={{ user_id: comment.author_id ?? comment.comment_id, name: comment.author_name || "Former member", profile_picture_url: comment.author_profile_picture_url ?? null }} size="sm" /><div className="min-w-0 flex-1 rounded-md bg-muted/50 px-3 py-2"><div className="flex flex-wrap items-baseline justify-between gap-x-2"><span className="text-xs font-semibold">{comment.author_name || "Former member"}</span><time className="text-[10px] text-muted-foreground">{new Date(comment.created_at).toLocaleString()}</time></div><p className="mt-1 whitespace-pre-wrap break-words text-sm">{comment.content}</p></div></li>)}</ol>}
      {canPostComments && <form onSubmit={(event) => void postComment(event)} className="space-y-2"><Textarea value={commentText} onChange={(event) => setCommentText(event.target.value)} maxLength={10000} rows={3} placeholder="Write a comment…" aria-label="Write a comment" required /><div className="flex justify-end"><Button type="submit" size="sm" disabled={!commentText.trim() || addComment.isPending}>{addComment.isPending ? "Posting…" : "Comment"}</Button></div></form>}
      {!comments.data?.length && !canPostComments && <p className="text-sm text-muted-foreground">No comments yet.</p>}
    </section>}
  </div>;

  const editableSections = <div className="space-y-4">
    {canEditLabels && <section className="space-y-2 rounded-lg border p-3">
      <h3 className="text-sm font-semibold"><Tag className="mr-1 inline h-4 w-4" />Labels</h3>
      {canEditLabels && <KanbanLabelColorPicker value={labels[0] ?? ""} onChange={(color) => setLabels(color ? [color] : [])} />}
    </section>}
    {canEditDates && <section className="space-y-3 rounded-lg border p-3"><h3 className="text-sm font-semibold"><CalendarDays className="mr-1 inline h-4 w-4" />Dates and reminder</h3><div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-sm">Start date<Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label><label className="space-y-1 text-sm">Due date<Input type="date" min={startDate || undefined} value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label><label className="space-y-1 text-sm sm:col-span-2">Due date reminder<Select value={reminder} onValueChange={setReminder}><SelectTrigger disabled={!dueDate}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">No reminder</SelectItem><SelectItem value="0">On due date</SelectItem><SelectItem value="1">1 day before</SelectItem><SelectItem value="2">2 days before</SelectItem><SelectItem value="7">1 week before</SelectItem></SelectContent></Select></label></div></section>}
    {canEditChecklist && <section className="space-y-2 rounded-lg border p-3"><div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Checklist</h3><Button type="button" variant="outline" size="sm" onClick={() => setChecklist((items) => [...items, { item_id: crypto.randomUUID(), text: "", is_completed: false }])}><Plus className="mr-1 h-4 w-4" />Add item</Button></div><div className="text-xs text-muted-foreground">{checklist.filter((item) => item.is_completed).length} of {checklist.length} complete <button type="button" className="ml-2 underline" onClick={() => setHideCompleted((value) => !value)}>{hideCompleted ? "Show completed" : "Hide completed"}</button></div><div className="h-2 overflow-hidden rounded bg-muted"><div className="h-full bg-primary" style={{ width: `${checklist.length ? checklist.filter((item) => item.is_completed).length / checklist.length * 100 : 0}%` }} /></div>{checklist.map((item, index) => (!hideCompleted || !item.is_completed) && <div key={item.item_id} className="flex flex-wrap items-center gap-2"><Checkbox checked={item.is_completed} onCheckedChange={(checked) => setChecklist((items) => items.map((row) => row.item_id === item.item_id ? { ...row, is_completed: checked === true } : row))} aria-label={`Complete checklist item ${index + 1}`} /><Input className="min-w-32 flex-1" value={item.text} maxLength={255} placeholder="Checklist item" onChange={(event) => setChecklist((items) => items.map((row) => row.item_id === item.item_id ? { ...row, text: event.target.value } : row))} /><Button type="button" size="icon" variant="ghost" aria-label="Remove checklist item" onClick={() => setChecklist((items) => items.filter((row) => row.item_id !== item.item_id))}><Trash2 className="h-4 w-4" /></Button>{canManageChecklistItemDetails && <><select className="h-9 max-w-48 rounded-md border bg-background px-2 text-sm" aria-label="Checklist item assignee" value={item.assignee_user_id ?? ""} onChange={(event) => { const member = checklistMembers.data?.find((option) => option.user_id === event.target.value); setChecklist((items) => items.map((row) => row.item_id === item.item_id ? { ...row, assignee_user_id: member?.user_id ?? null, assignee_name: member?.name ?? null } : row)); }}><option value="">Unassigned</option>{item.assignee_user_id && !checklistMembers.data?.some((member) => member.user_id === item.assignee_user_id) && <option value={item.assignee_user_id}>{item.assignee_name || "Current member"}</option>}{checklistMembers.data?.map((member) => <option key={member.user_id} value={member.user_id}>{member.name}</option>)}</select><Input className="w-auto" type="date" aria-label="Checklist item due date" value={item.due_date ?? ""} onChange={(event) => setChecklist((items) => items.map((row) => row.item_id === item.item_id ? { ...row, due_date: event.target.value || null } : row))} /></>}</div>)}</section>}
  </div>;

  return (
    <Dialog open={open && !!task} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Card details</DialogTitle>
        <DialogDescription>Edit the card and its permitted details in one place. Save applies your changes; Cancel discards unsaved edits.</DialogDescription>
        </DialogHeader>
        {canEditAny ? (
          <div className="space-y-4">
            {canEdit ? <><div className="space-y-1.5"><Label htmlFor="kanban-card-title">Title</Label><Input id="kanban-card-title" value={title} onChange={(event) => setTitle(event.target.value)} required minLength={1} maxLength={255} /></div><div className="space-y-1.5"><Label htmlFor="kanban-card-description">Description</Label><Textarea id="kanban-card-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={10000} rows={7} placeholder="Add a description…" /></div></> : <><h3 className="text-base font-semibold">{task?.task_name}</h3><p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{task?.description || "No description yet."}</p></>}
            {editableSections}
            {membersSection}
            {collaborationSection}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="button" onClick={() => void save()} disabled={saving || updateDetails.isPending || (canEdit && !title.trim())}>{saving || updateDetails.isPending ? "Saving…" : "Save"}</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            <h3 className="text-base font-semibold">{task?.task_name}</h3>
            <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{task?.description || "No description yet."}</p>
            {membersSection}
            {collaborationSection}
            <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Close</Button></DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
