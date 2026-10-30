"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Check, CheckSquare, Download, Loader2, Paperclip, Pencil, Plus, Tag, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { tasksApi } from "@/lib/api/tasks";
import { getApiErrorMessage } from "@/lib/api/client";
import { labelTextColor, normalizeKanbanLabelKey } from "@/lib/kanban-labels";
import { useCreateKanbanLabel, useKanbanLabels, useUpdateKanbanLabel } from "@/hooks/queries/use-kanban";
import { READY_KANBAN_COLORS } from "@/components/modules/kanban/kanban-color-palette";
import type { KanbanLabel } from "@/types/kanban";
import type { Task, TaskAttachment, TaskChecklistItem } from "@/types/task";

export type KanbanCardFeature = "labels" | "dates" | "checklist" | "attachments";

const FEATURE_TITLE: Record<KanbanCardFeature, string> = {
  labels: "Labels",
  dates: "Dates",
  checklist: "Checklist",
  attachments: "Attachments",
};

const MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024;
const ALLOWED_FILE = /\.(csv|doc|docx|gif|jpeg|jpg|pdf|png|ppt|pptx|txt|webp|xls|xlsx|zip)$/i;

export function KanbanCardFeatureDialog({
  open,
  onOpenChange,
  task,
  feature,
  canViewAttachments = false,
  canUploadAttachments = false,
  canDeleteAttachments = false,
  canManageLabels = false,
  canManageChecklistItemDetails = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  feature: KanbanCardFeature | null;
  canViewAttachments?: boolean;
  canUploadAttachments?: boolean;
  canDeleteAttachments?: boolean;
  canManageLabels?: boolean;
  canManageChecklistItemDetails?: boolean;
}) {
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [labels, setLabels] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [reminderDaysBefore, setReminderDaysBefore] = useState("none");
  const [items, setItems] = useState<TaskChecklistItem[]>([]);
  const [hideCompleted, setHideCompleted] = useState(false);
  const [formError, setFormError] = useState("");
  const [labelSearch, setLabelSearch] = useState("");
  const [newLabelName, setNewLabelName] = useState("");
  const [editingLabel, setEditingLabel] = useState<KanbanLabel | null>(null);
  const [editingLabelName, setEditingLabelName] = useState("");
  const taskId = task?.task_id;
  const labelsQuery = useKanbanLabels(open && feature === "labels");
  const createLabel = useCreateKanbanLabel();
  const updateLabel = useUpdateKanbanLabel();

  useEffect(() => {
    if (!open || !task) return;
    setLabels((task.labels ?? []).join(", "));
    setStartDate(task.start_date ?? "");
    setDueDate(task.due_date ?? "");
    setReminderDaysBefore(task.reminder_days_before == null ? "none" : String(task.reminder_days_before));
    setItems((task.checklist_items ?? []).map((item) => ({ ...item })));
    setHideCompleted(false);
    setFormError("");
    setLabelSearch("");
    setNewLabelName("");
    setEditingLabel(null);
  }, [open, task]);

  const attachments = useQuery({
    queryKey: ["tasks", taskId, "attachments"],
    queryFn: () => tasksApi.getCardAttachments(taskId!),
    enabled: open && feature === "attachments" && !!taskId && canViewAttachments,
  });

  const checklistMemberOptions = useQuery({
    queryKey: ["tasks", taskId, "checklist-member-options"],
    queryFn: () => tasksApi.getChecklistMemberOptions(taskId!),
    enabled: open && feature === "checklist" && !!taskId && canManageChecklistItemDetails,
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!taskId || !feature) throw new Error("Choose a task and card feature.");
      if (feature === "labels") {
        const nextLabels = [...new Set(labels.split(",").map((label) => label.trim().toLocaleLowerCase()).filter(Boolean))];
        if (nextLabels.length > 20 || nextLabels.some((label) => label.length > 40)) throw new Error("Use up to 20 labels, each 40 characters or fewer.");
        return tasksApi.updateCardLabels(taskId, nextLabels);
      }
      if (feature === "dates") {
        if (startDate && dueDate && dueDate < startDate) throw new Error("Due date must be on or after the start date.");
        const reminder = dueDate && reminderDaysBefore !== "none" ? Number(reminderDaysBefore) as 0 | 1 | 2 | 7 : null;
        return tasksApi.updateCardDates(taskId, startDate || null, dueDate || null, reminder);
      }
      const checklist = items.map((item) => ({ ...item, text: item.text.trim() }));
      if (checklist.some((item) => !item.text)) throw new Error("Enter text for each checklist item or remove the empty item.");
      if (checklist.length > 100) throw new Error("A checklist can have up to 100 items.");
      return tasksApi.updateCardChecklist(taskId, checklist);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["kanban-tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
        queryClient.invalidateQueries({ queryKey: ["calendar-events"] }),
        queryClient.invalidateQueries({ queryKey: ["tasks", taskId, "activity"] }),
      ]);
      toast.success(`${FEATURE_TITLE[feature!]} updated`);
      onOpenChange(false);
    },
    onError: (error) => setFormError(error instanceof Error ? error.message : getApiErrorMessage(error)),
  });

  const uploadMutation = useMutation({
    mutationFn: ({ file }: { file: File }) => tasksApi.uploadCardAttachment(taskId!, file),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tasks", taskId, "attachments"] });
      await queryClient.invalidateQueries({ queryKey: ["tasks", taskId, "activity"] });
      toast.success("Attachment added to card");
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (attachment: TaskAttachment) => tasksApi.deleteCardAttachment(taskId!, attachment.attachment_id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tasks", taskId, "attachments"] });
      await queryClient.invalidateQueries({ queryKey: ["tasks", taskId, "activity"] });
      toast.success("Attachment removed");
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const selectedLabelKeys = labels.split(",").map(normalizeKanbanLabelKey).filter(Boolean);
  const completedChecklistCount = items.filter((item) => item.is_completed).length;
  const visibleChecklistItems = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => !hideCompleted || !item.is_completed);
  const isChecklistItemOverdue = (item: TaskChecklistItem) => {
    if (!item.due_date || item.is_completed) return false;
    const due = new Date(`${item.due_date}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return due < today;
  };
  const labelRows = [...(labelsQuery.data ?? [])];
  const knownLabelKeys = new Set(labelRows.map((label) => label.label_key));
  for (const key of selectedLabelKeys) {
    if (!knownLabelKeys.has(key)) labelRows.push({ label_id: "", label_key: key, name: key, color: "#64748B", created_at: "" });
  }
  const filteredLabelRows = labelRows.filter((label) => label.name.toLocaleLowerCase().includes(labelSearch.trim().toLocaleLowerCase()));

  const toggleLabel = (labelKey: string, checked: boolean) => {
    const next = new Set(selectedLabelKeys);
    if (checked && !next.has(labelKey) && next.size >= 20) {
      setFormError("A card can have up to 20 labels.");
      return;
    }
    if (checked) next.add(labelKey);
    else next.delete(labelKey);
    setFormError("");
    setLabels([...next].join(", "));
  };

  const createLabelDefinition = async () => {
    const name = newLabelName.trim();
    const key = normalizeKanbanLabelKey(name);
    if (!name || name.length > 40 || name.includes(",")) {
      setFormError("Enter a label name of up to 40 characters without commas.");
      return;
    }
    if (labelRows.some((label) => label.label_key === key)) {
      setFormError("A label with this name already exists.");
      return;
    }
    if (selectedLabelKeys.length >= 20) {
      setFormError("This card already has the maximum of 20 labels. Remove a label before adding another.");
      return;
    }
    try {
      const created = await createLabel.mutateAsync({ name, color: READY_KANBAN_COLORS[5] });
      toggleLabel(created.label_key, true);
      setNewLabelName("");
      setFormError("");
      toast.success("Label created and selected");
    } catch (error) {
      setFormError(getApiErrorMessage(error));
    }
  };

  const beginEditLabel = (label: KanbanLabel) => {
    setEditingLabel(label);
    setEditingLabelName(label.name);
  };

  const saveLabelDefinition = async () => {
    if (!editingLabel) return;
    const name = editingLabelName.trim();
    if (!name || name.length > 40 || name.includes(",")) {
      setFormError("Enter a label name of up to 40 characters without commas.");
      return;
    }
    try {
      const updated = await updateLabel.mutateAsync({
        labelId: editingLabel.label_id,
        payload: { name, color: editingLabel.color },
      });
      if (updated.label_key !== editingLabel.label_key) {
        setLabels((current) => current.split(",").map((key) => normalizeKanbanLabelKey(key) === editingLabel.label_key ? updated.label_key : normalizeKanbanLabelKey(key)).filter(Boolean).join(", "));
      }
      setEditingLabel(null);
      setFormError("");
      toast.success("Label updated");
    } catch (error) {
      setFormError(getApiErrorMessage(error));
    }
  };

  const download = async (attachment: TaskAttachment) => {
    try {
      const blob = await tasksApi.downloadCardAttachment(taskId!, attachment.attachment_id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = attachment.original_filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  const handleFile = (file?: File) => {
    if (!file || !taskId) return;
    if (!ALLOWED_FILE.test(file.name)) {
      toast.error("Choose a supported document, image, CSV, or ZIP file.");
      return;
    }
    if (file.size > MAX_ATTACHMENT_SIZE) {
      toast.error("Attachments must be 20 MB or smaller.");
      return;
    }
    uploadMutation.mutate({ file });
  };

  if (!feature) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{FEATURE_TITLE[feature]} · {task?.task_name}</DialogTitle>
          <DialogDescription>Update this feature for the Kanban card. Changes are saved to the task and activity history.</DialogDescription>
        </DialogHeader>

        {feature === "labels" && <div className="space-y-4">
          <label htmlFor="kanban-label-search" className="sr-only">Search labels</label>
          <Input id="kanban-label-search" value={labelSearch} onChange={(event) => setLabelSearch(event.target.value)} placeholder="Search labels…" />
          <section className="space-y-2" aria-label="Available labels">
            <p className="text-sm font-medium"><Tag className="mr-1 inline h-4 w-4" />Labels</p>
            {labelsQuery.isLoading && <p className="text-sm text-muted-foreground">Loading labels…</p>}
            {labelsQuery.isError && <p role="alert" className="text-sm text-destructive">{getApiErrorMessage(labelsQuery.error)}</p>}
            {!labelsQuery.isLoading && filteredLabelRows.length === 0 && <p className="rounded-md border border-dashed p-3 text-center text-sm text-muted-foreground">No matching labels.</p>}
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {filteredLabelRows.map((label) => {
                const checked = selectedLabelKeys.includes(label.label_key);
                const isEditing = editingLabel?.label_id === label.label_id;
                return <div key={label.label_key} className="flex items-center gap-2">
                  <Checkbox checked={checked} aria-label={`${checked ? "Remove" : "Add"} ${label.name}`} onCheckedChange={(value) => toggleLabel(label.label_key, value === true)} />
                  {isEditing ? <>
                    <Input value={editingLabelName} maxLength={40} aria-label="Edit label name" onChange={(event) => setEditingLabelName(event.target.value)} />
                    <Button type="button" variant="ghost" size="icon" aria-label="Save label changes" disabled={updateLabel.isPending} onClick={() => void saveLabelDefinition()}><Check className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="icon" aria-label="Cancel label changes" onClick={() => setEditingLabel(null)}><X className="h-4 w-4" /></Button>
                  </> : <>
                    <span className="min-w-0 flex-1 truncate rounded-md px-3 py-2 text-sm font-medium" style={{ backgroundColor: label.color, color: labelTextColor(label.color) }}>{label.name}</span>
                    {canManageLabels && label.label_id && <Button type="button" variant="ghost" size="icon" aria-label={`Edit ${label.name}`} onClick={() => beginEditLabel(label as KanbanLabel)}><Pencil className="h-4 w-4" /></Button>}
                  </>}
                </div>;
              })}
            </div>
          </section>
          {canManageLabels && <section className="space-y-2 border-t pt-3">
            <p className="text-sm font-medium">Create a new label</p>
            <div className="flex items-center gap-2">
              <Input value={newLabelName} maxLength={40} placeholder="e.g. Bug, Feature, Backend" aria-label="New label name" onChange={(event) => setNewLabelName(event.target.value)} />
              <Button type="button" variant="outline" disabled={!newLabelName.trim() || createLabel.isPending} onClick={() => void createLabelDefinition()}><Plus className="mr-1 h-4 w-4" />Create</Button>
            </div>
          </section>}
          <p className="text-xs text-muted-foreground">Selected label names are shared across your organization. New labels use the standard color.</p>
        </div>}

        {feature === "dates" && <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm font-medium"><span><CalendarDays className="mr-1 inline h-4 w-4" />Start date</span><Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
          <label className="space-y-1.5 text-sm font-medium"><span><CalendarDays className="mr-1 inline h-4 w-4" />Due date</span><Input type="date" min={startDate || undefined} value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
          <label className="space-y-1.5 text-sm font-medium sm:col-span-2"><span>In-app reminder for the assignee and card members</span>
            <Select value={reminderDaysBefore} onValueChange={setReminderDaysBefore}>
              <SelectTrigger disabled={!dueDate}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No reminder</SelectItem>
                <SelectItem value="0">On the due date</SelectItem>
                <SelectItem value="1">1 day before</SelectItem>
                <SelectItem value="2">2 days before</SelectItem>
                <SelectItem value="7">1 week before</SelectItem>
              </SelectContent>
            </Select>
            <span className="block text-xs font-normal text-muted-foreground">Delivered in the app on the selected calendar day. Choose a due date first.</span>
          </label>
        </div>}

        {feature === "checklist" && <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium"><CheckSquare className="mr-1 inline h-4 w-4" />Checklist items</p>
            <Button type="button" variant="outline" size="sm" disabled={items.length >= 100} onClick={() => setItems((current) => [...current, { item_id: crypto.randomUUID(), text: "", is_completed: false }])}><Plus className="mr-1 h-4 w-4" />Add item</Button>
          </div>
          <div aria-label={`${completedChecklistCount} of ${items.length} checklist items complete`}>
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground"><span>{completedChecklistCount} of {items.length} complete</span><Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => setHideCompleted((current) => !current)}>{hideCompleted ? "Show completed items" : "Hide completed items"}</Button></div>
            <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${items.length ? completedChecklistCount / items.length * 100 : 0}%` }} /></div>
          </div>
          {items.length === 0 && <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">No checklist items yet.</p>}
          <div className="max-h-80 space-y-2 overflow-y-auto">{visibleChecklistItems.map(({ item, index }) => <div key={item.item_id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md border p-2">
            <Checkbox checked={item.is_completed} onCheckedChange={(checked) => setItems((current) => current.map((row) => row.item_id === item.item_id ? { ...row, is_completed: checked === true } : row))} aria-label={`Mark item ${index + 1} complete`} />
            <Input value={item.text} maxLength={255} placeholder={`Checklist item ${index + 1}`} onChange={(event) => setItems((current) => current.map((row) => row.item_id === item.item_id ? { ...row, text: event.target.value } : row))} />
            <Button type="button" variant="ghost" size="icon" aria-label={`Remove item ${index + 1}`} onClick={() => setItems((current) => current.filter((row) => row.item_id !== item.item_id))}><Trash2 className="h-4 w-4" /></Button>
            {canManageChecklistItemDetails ? <div className="col-span-3 grid gap-2 sm:grid-cols-2">
              <label className="space-y-1 text-xs font-medium text-muted-foreground"><span>Responsible member</span>
                <select className="h-10 w-full rounded-md border bg-background px-3 text-sm font-normal text-foreground" value={item.assignee_user_id ?? ""} onChange={(event) => {
                  const member = checklistMemberOptions.data?.find((option) => option.user_id === event.target.value);
                  setItems((current) => current.map((row) => row.item_id === item.item_id ? { ...row, assignee_user_id: member?.user_id ?? null, assignee_name: member?.name ?? null } : row));
                }}>
                  <option value="">Unassigned</option>
                  {item.assignee_user_id && !checklistMemberOptions.data?.some((option) => option.user_id === item.assignee_user_id) && <option value={item.assignee_user_id}>{item.assignee_name || "Current member (no longer eligible)"}</option>}
                  {checklistMemberOptions.data?.map((member) => <option key={member.user_id} value={member.user_id}>{member.name}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-xs font-medium text-muted-foreground"><span>Item due date</span><Input type="date" value={item.due_date ?? ""} onChange={(event) => setItems((current) => current.map((row) => row.item_id === item.item_id ? { ...row, due_date: event.target.value || null } : row))} />
                {item.due_date && <span className={`block ${isChecklistItemOverdue(item) ? "font-medium text-destructive" : ""}`}>{isChecklistItemOverdue(item) ? "Overdue · " : "Due · "}{new Date(`${item.due_date}T00:00:00`).toLocaleDateString()}</span>}
              </label>
              {checklistMemberOptions.isLoading && <p className="text-xs text-muted-foreground sm:col-span-2">Loading project team members…</p>}
              {checklistMemberOptions.isError && <p role="alert" className="text-xs text-destructive sm:col-span-2">{getApiErrorMessage(checklistMemberOptions.error)}</p>}
              {!checklistMemberOptions.isLoading && !checklistMemberOptions.isError && !checklistMemberOptions.data?.length && <p className="text-xs text-muted-foreground sm:col-span-2">No active members are available in this project’s teams.</p>}
            </div> : (item.assignee_name || item.due_date) && <div className="col-span-3 flex flex-wrap gap-x-3 gap-y-1 pl-7 text-xs">
              {item.assignee_name && <span className="text-muted-foreground">Responsible: {item.assignee_name}</span>}
              {item.due_date && <span className={isChecklistItemOverdue(item) ? "font-medium text-destructive" : "text-muted-foreground"}>{isChecklistItemOverdue(item) ? "Overdue · " : "Due · "}{new Date(`${item.due_date}T00:00:00`).toLocaleDateString()}</span>}
            </div>}
          </div>)}</div>
        </div>}

        {feature === "attachments" && <div className="space-y-3">
          <input ref={fileInput} type="file" className="hidden" accept=".csv,.doc,.docx,.gif,.jpeg,.jpg,.pdf,.png,.ppt,.pptx,.txt,.webp,.xls,.xlsx,.zip" onChange={(event) => { handleFile(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} />
          {canUploadAttachments && <div className="flex items-center justify-between rounded-lg border border-dashed p-3"><div><p className="text-sm font-medium"><Paperclip className="mr-1 inline h-4 w-4" />Attach a file</p><p className="text-xs text-muted-foreground">Supported documents and images, up to 20 MB.</p></div><Button type="button" variant="outline" disabled={uploadMutation.isPending} onClick={() => fileInput.current?.click()}>{uploadMutation.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}Add</Button></div>}
          {canViewAttachments && attachments.isLoading && <p className="text-sm text-muted-foreground">Loading attachments…</p>}
          {canViewAttachments && attachments.isError && <p className="text-sm text-destructive">{getApiErrorMessage(attachments.error)}</p>}
          {canViewAttachments && !attachments.isLoading && !attachments.data?.length && <p className="text-sm text-muted-foreground">No attachments on this card.</p>}
          {canViewAttachments && <ul className="space-y-2">{attachments.data?.map((attachment) => <li key={attachment.attachment_id} className="flex items-center gap-2 rounded-md border p-2">
            <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1 truncate text-sm" title={attachment.original_filename}>{attachment.original_filename}</span><span className="shrink-0 text-xs text-muted-foreground">{(attachment.file_size / (1024 * 1024)).toFixed(1)} MB</span>
            <Button type="button" variant="ghost" size="icon" aria-label={`Download ${attachment.original_filename}`} onClick={() => void download(attachment)}><Download className="h-4 w-4" /></Button>
            {canDeleteAttachments && <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${attachment.original_filename}`} disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(attachment)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
          </li>)}</ul>}
        </div>}

        {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
        {feature !== "attachments" && <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Close</Button><Button type="button" disabled={updateMutation.isPending} onClick={() => { setFormError(""); updateMutation.mutate(); }}>{updateMutation.isPending ? "Saving…" : "Save changes"}</Button></div>}
      </DialogContent>
    </Dialog>
  );
}
