import { useEffect, useState } from "react";
import { Draggable } from "@hello-pangea/dnd";
import { Archive, Calendar, CalendarDays, Check, CheckSquare, GripHorizontal, MessageCircle, Paperclip, Pencil, Play, Plus, Tag, Timer, Trash2, UserPlus } from "lucide-react";
import { PriorityBadge } from "@/components/shared/priority-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDate } from "@/lib/utils";
import type { Task } from "@/types/task";
import { labelTextColor, normalizeKanbanLabelKey } from "@/lib/kanban-labels";
import type { TaskWorkTime } from "@/types/task";
import type { KanbanCardFeature } from "./kanban-card-feature-dialog";

type AssigneeSummary = { user_id: string; name: string; profile_picture_url?: string | null; updated_at?: string };

const localDateKey = (value = new Date()) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;

export function KanbanCard({
  task,
  assignee,
  placementId,
  index,
  canEdit,
  canEditTask,
  canArchiveTask,
  canDeleteTask = false,
  canMove,
  showEdgeMoveHandles,
  onEdit,
  onArchive,
  onDelete,
  onOpenDetails,
  onViewDetails,
  canManageMembers = false,
  onManageMembers,
  onStartWork,
  onApproveReview,
  onCancelReview,
  isApprovingReview = false,
  isCancellingReview = false,
  onToggleChecklist,
  canUseCardFeature,
  labelColors,
  labelNames,
  onCardFeature,
  isInWorkSession = false,
  workTime,
  clockNow,
}: {
  task: Task;
  assignee: AssigneeSummary | null | undefined;
  placementId: string;
  index: number;
  canEdit: boolean;
  canEditTask: boolean;
  canArchiveTask: boolean;
  canDeleteTask?: boolean;
  canMove: boolean;
  showEdgeMoveHandles?: boolean;
  onEdit?: (task: Task) => void;
  onArchive?: (task: Task) => void;
  onDelete?: (task: Task) => void;
  onOpenDetails?: (task: Task) => void;
  onViewDetails?: (task: Task) => void;
  canManageMembers?: boolean;
  onManageMembers?: (task: Task) => void;
  onStartWork?: (task: Task) => void;
  onApproveReview?: (task: Task) => void;
  onCancelReview?: (task: Task, comment: string) => Promise<void>;
  isApprovingReview?: boolean;
  isCancellingReview?: boolean;
  onToggleChecklist?: (task: Task, itemId: string) => void;
  canUseCardFeature?: (feature: KanbanCardFeature, task: Task) => boolean;
  labelColors?: Record<string, string>;
  labelNames?: Record<string, string>;
  onCardFeature?: (task: Task, feature: KanbanCardFeature) => void;
  isInWorkSession?: boolean;
  workTime?: TaskWorkTime;
  clockNow?: number;
}) {
  const [localClockNow, setLocalClockNow] = useState(() => Date.now());
  const [reviewCommentOpen, setReviewCommentOpen] = useState(false);
  const [reviewComment, setReviewComment] = useState("");
  useEffect(() => {
    if (clockNow !== undefined || !workTime?.is_tracking) return;
    const interval = window.setInterval(() => setLocalClockNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [clockNow, workTime?.is_tracking]);
  const isOverdue = task.due_date && task.due_date < localDateKey() && !["DONE", "CANCELLED"].includes(task.status);
  const liveSeconds = workTime?.duration_seconds ?? 0;
  const elapsed = liveSeconds + (workTime?.is_tracking && workTime.active_since ? Math.max(0, Math.floor(((clockNow ?? localClockNow) - Date.parse(workTime.active_since)) / 1000)) : 0);
  const timerText = `${String(Math.floor(elapsed / 3600)).padStart(2, "0")}:${String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;
  const additionalMembers = (task.card_members ?? []).filter((member) => !member.is_primary && member.user_id !== assignee?.user_id);
  const primaryLabel = task.labels?.[0];
  const cardColor = primaryLabel ? (/^#[0-9a-f]{6}$/i.test(primaryLabel) ? primaryLabel : labelColors?.[normalizeKanbanLabelKey(primaryLabel)]) : undefined;
  const cardTextColor = cardColor ? labelTextColor(cardColor) : undefined;
  const submitReviewComment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const comment = reviewComment.trim();
    if (!comment || !onCancelReview) return;
    try {
      await onCancelReview(task, comment);
      setReviewComment("");
      setReviewCommentOpen(false);
    } catch {
      // The caller displays the API error; keep the draft available for retry.
    }
  };

  return (
    <Draggable draggableId={placementId} index={index} isDragDisabled={!canMove}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...(canMove ? provided.dragHandleProps : {})}
          // Keep the task color on the card surface only. Setting `color` here
          // leaked the calculated contrast color into outline/ghost buttons,
          // making their labels white on white backgrounds.
          style={{ backgroundColor: cardColor }}
          className={`mb-2 rounded-lg border border-border bg-card p-3 shadow-sm transition-shadow ${canMove ? "cursor-grab active:cursor-grabbing" : ""} ${
            snapshot.isDragging ? "shadow-md ring-2 ring-primary/30" : "hover:shadow-md"
          }`}
        >
          <div className="flex items-start justify-between gap-1">
            <button type="button" style={{ color: cardTextColor }} className="min-w-0 flex-1 text-left text-sm font-medium leading-snug text-foreground hover:underline" onClick={(event) => { event.stopPropagation(); onViewDetails?.(task); }} onMouseDown={(event) => event.stopPropagation()}>
              {task.task_name}
            </button>
          {(canEditTask || canArchiveTask || onOpenDetails || onStartWork || onApproveReview || onCancelReview || canManageMembers && onManageMembers) && (
              <div className="flex max-w-[190px] shrink-0 flex-wrap items-center justify-end gap-0.5">
                {onStartWork && <Button type="button" variant={isInWorkSession ? "secondary" : "ghost"} size="icon" className="h-7 w-7" aria-label={isInWorkSession ? `Tracked in shared timer: ${task.task_name}` : `Start work on ${task.task_name}`} title={isInWorkSession ? "Included in shared timer" : "Start or add to shared timer"} onClick={(event) => { event.stopPropagation(); if (!isInWorkSession) onStartWork(task); }} onMouseDown={(event) => event.stopPropagation()}><span className="relative inline-flex">{isInWorkSession ? <Timer className="h-3.5 w-3.5 text-violet-700" /> : <Play className="h-3.5 w-3.5" />}</span></Button>}
                {onApproveReview && <Button type="button" variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs" disabled={isApprovingReview} aria-label={`Approve review for ${task.task_name}`} title="Approve review" onClick={(event) => { event.stopPropagation(); onApproveReview(task); }} onMouseDown={(event) => event.stopPropagation()}><Check className="h-3.5 w-3.5" />{isApprovingReview ? "Approving…" : "Approve"}</Button>}
                {onCancelReview && <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={isCancellingReview} aria-label={`Cancel approval and request changes for ${task.task_name}`} title="Cancel approval and request changes" onClick={(event) => { event.stopPropagation(); setReviewCommentOpen((open) => !open); }} onMouseDown={(event) => event.stopPropagation()}>Cancel</Button>}
                {onOpenDetails && <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label={`Open comments for ${task.task_name}`} title="Comments and activity" onClick={(event) => { event.stopPropagation(); onOpenDetails(task); }} onMouseDown={(event) => event.stopPropagation()}><MessageCircle className="h-3.5 w-3.5" /></Button>}
              {canManageMembers && onManageMembers && <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label={`Assign members to ${task.task_name}`} title="Assign members" onClick={(event) => { event.stopPropagation(); onManageMembers(task); }} onMouseDown={(event) => event.stopPropagation()}><UserPlus className="h-3.5 w-3.5" /></Button>}
              {canEditTask && onEdit && <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label={`Edit task ${task.task_name}`} title="Edit task" onClick={(event) => { event.stopPropagation(); onEdit(task); }} onMouseDown={(event) => event.stopPropagation()}><Pencil className="h-3.5 w-3.5" /></Button>}
              {canArchiveTask && onArchive && <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label={`Archive task ${task.task_name}`} title="Archive card" onClick={(event) => { event.stopPropagation(); onArchive(task); }} onMouseDown={(event) => event.stopPropagation()}><Archive className="h-3.5 w-3.5" /></Button>}
              {canDeleteTask && onDelete && <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" aria-label={`Delete task ${task.task_name}`} title="Delete task" onClick={(event) => { event.stopPropagation(); onDelete(task); }} onMouseDown={(event) => event.stopPropagation()}><Trash2 className="h-3.5 w-3.5" /></Button>}
              </div>
            )}
          </div>

          {(canEditTask && onEdit || onCardFeature && (["labels", "dates", "checklist", "attachments"] as KanbanCardFeature[]).some((feature) => canUseCardFeature?.(feature, task))) && <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Kanban card quick actions">
            {canEditTask && onEdit && <Button type="button" variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={(event) => { event.stopPropagation(); onEdit(task); }} onMouseDown={(event) => event.stopPropagation()}><Plus className="h-3.5 w-3.5" />Add</Button>}
            {onCardFeature && canUseCardFeature?.("labels", task) && <Button type="button" variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={(event) => { event.stopPropagation(); onCardFeature(task, "labels"); }} onMouseDown={(event) => event.stopPropagation()}><Tag className="h-3.5 w-3.5" />Labels</Button>}
            {onCardFeature && canUseCardFeature?.("dates", task) && <Button type="button" variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={(event) => { event.stopPropagation(); onCardFeature(task, "dates"); }} onMouseDown={(event) => event.stopPropagation()}><CalendarDays className="h-3.5 w-3.5" />Dates</Button>}
            {onCardFeature && canUseCardFeature?.("checklist", task) && <Button type="button" variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={(event) => { event.stopPropagation(); onCardFeature(task, "checklist"); }} onMouseDown={(event) => event.stopPropagation()}><CheckSquare className="h-3.5 w-3.5" />Checklist</Button>}
            {onCardFeature && canUseCardFeature?.("attachments", task) && <Button type="button" variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={(event) => { event.stopPropagation(); onCardFeature(task, "attachments"); }} onMouseDown={(event) => event.stopPropagation()}><Paperclip className="h-3.5 w-3.5" />Attachment</Button>}
          </div>}

          {onCancelReview && reviewCommentOpen && <form onSubmit={(event) => void submitReviewComment(event)} className="mt-2 space-y-2 rounded-md border border-amber-200 bg-amber-50 p-2" onClick={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()}>
            <label htmlFor={`review-comment-${task.task_id}`} className="text-xs font-semibold text-amber-900">Comment for the developer</label>
            <textarea id={`review-comment-${task.task_id}`} className="min-h-20 w-full resize-y rounded-md border border-amber-200 bg-white p-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-violet-500" value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} minLength={1} maxLength={10000} required placeholder="Explain what needs to change…" aria-label="Review change comment" />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" disabled={isCancellingReview} onClick={() => setReviewCommentOpen(false)}>Close</Button>
              <Button type="submit" size="sm" disabled={!reviewComment.trim() || isCancellingReview}>{isCancellingReview ? "Sending…" : "Send back to To Do"}</Button>
            </div>
          </form>}

          {showEdgeMoveHandles && canMove && <div className="-mx-1 mb-1 flex h-3 items-center justify-center text-slate-400" aria-hidden="true"><GripHorizontal className="h-4 w-4" /></div>}

          <div className="mt-3 flex items-center justify-between">
            <span className="flex items-center gap-1.5"><span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">{task.task_type ?? "TASK"}</span><PriorityBadge priority={task.priority} /></span>
            {task.due_date && (
              <span
                className={`flex items-center gap-1 text-xs ${
                  isOverdue ? "font-medium text-destructive" : "text-muted-foreground"
                }`}
              >
                <Calendar className="h-3 w-3" />
                {formatDate(task.due_date)}
              </span>
            )}
          </div>

          {!!task.labels?.filter((label) => !/^#[0-9a-f]{6}$/i.test(label)).length && <div className="mt-2 flex flex-wrap gap-1" aria-label="Task labels">
            {task.labels.filter((label) => !/^#[0-9a-f]{6}$/i.test(label)).map((label) => {
              const key = normalizeKanbanLabelKey(label);
              const color = labelColors?.[key] ?? "#64748B";
              const name = labelNames?.[key] ?? label;
              return <span key={label} className="rounded-full border px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: color, borderColor: color, color: labelTextColor(color) }}>{name}</span>;
            })}
          </div>}

          {!!task.review_feedback && <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-950" aria-label="Project Manager review feedback">
            <p className="font-semibold">PM requested changes</p>
            <p className="mt-0.5 whitespace-pre-wrap break-words">{task.review_feedback}</p>
          </div>}

          {!!task.checklist_items?.length && <div className="mt-3 space-y-1.5 border-t border-border pt-2">
            <p className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground"><CheckSquare className="h-3 w-3" />Checklist · {task.checklist_items.filter((item) => item.is_completed).length}/{task.checklist_items.length}</p>
            <div className="max-h-28 space-y-1 overflow-y-auto">
              {task.checklist_items.map((item) => {
                const overdue = !!item.due_date && !item.is_completed && new Date(`${item.due_date}T00:00:00`) < new Date(new Date().setHours(0, 0, 0, 0));
                return <label key={item.item_id} className="flex items-start gap-2 text-xs text-foreground">
                  <Checkbox checked={item.is_completed} disabled={!canEdit} onCheckedChange={() => onToggleChecklist?.(task, item.item_id)} onClick={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()} className="mt-0.5 h-3.5 w-3.5" />
                  <span className="min-w-0"><span className={item.is_completed ? "text-muted-foreground line-through" : ""}>{item.text}</span>
                    {(item.assignee_name || item.due_date) && <span className={`mt-0.5 block text-[10px] ${overdue ? "font-medium text-destructive" : "text-muted-foreground"}`}>{[item.assignee_name, item.due_date ? `${overdue ? "Overdue" : "Due"} ${new Date(`${item.due_date}T00:00:00`).toLocaleDateString()}` : ""].filter(Boolean).join(" · ")}</span>}
                  </span>
                </label>;
              })}
            </div>
          </div>}

          <div className={`mt-2 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold ${workTime?.is_tracking ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200" : elapsed > 0 ? "bg-slate-100 text-slate-700" : "bg-slate-50 text-slate-500"}`}>
            <Timer className="h-3.5 w-3.5 shrink-0" />
            <span className="font-mono tabular-nums">{timerText}</span>
            <span className="ml-auto">{workTime?.is_tracking ? "Running" : workTime?.pending_review_seconds ? "Pending PM approval" : elapsed > 0 ? "Saved" : "Not started"}</span>
          </div>

          <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2" aria-label="Assigned card members">
            <UserAvatar user={assignee} showName size="sm" />
            {additionalMembers.map((member) => <span key={member.user_id} title={member.name} aria-label={member.name}>
              <UserAvatar user={{ user_id: member.user_id, name: member.name, profile_picture_url: member.profile_picture_url }} showName={false} size="sm" />
            </span>)}
          </div>
          {showEdgeMoveHandles && canMove && <div className="-mx-1 mt-1 flex h-3 items-center justify-center text-slate-400" aria-hidden="true"><GripHorizontal className="h-4 w-4" /></div>}
        </div>
      )}
    </Draggable>
  );
}
