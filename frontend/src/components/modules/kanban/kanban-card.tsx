import { useEffect, useState } from "react";
import { Draggable } from "@hello-pangea/dnd";
import { Calendar, Check, CheckSquare, GripHorizontal, MessageCircle, Pencil, Play, Timer, Trash2 } from "lucide-react";
import { PriorityBadge } from "@/components/shared/priority-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDate } from "@/lib/utils";
import type { Task } from "@/types/task";
import type { TaskWorkTime } from "@/types/task";

type AssigneeSummary = { user_id: string; name: string; profile_picture_url?: string | null; updated_at?: string };

export function KanbanCard({
  task,
  assignee,
  placementId,
  index,
  canEdit,
  canEditTask,
  canDeleteTask,
  canMove,
  showEdgeMoveHandles,
  onEdit,
  onDelete,
  onOpenDetails,
  onStartWork,
  onApproveReview,
  isApprovingReview = false,
  onToggleChecklist,
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
  canDeleteTask: boolean;
  canMove: boolean;
  showEdgeMoveHandles?: boolean;
  onEdit?: (task: Task) => void;
  onDelete?: (task: Task) => void;
  onOpenDetails?: (task: Task) => void;
  onStartWork?: (task: Task) => void;
  onApproveReview?: (task: Task) => void;
  isApprovingReview?: boolean;
  onToggleChecklist?: (task: Task, itemId: string) => void;
  isInWorkSession?: boolean;
  workTime?: TaskWorkTime;
  clockNow?: number;
}) {
  const [localClockNow, setLocalClockNow] = useState(() => Date.now());
  useEffect(() => {
    if (clockNow !== undefined || !workTime?.is_tracking) return;
    const interval = window.setInterval(() => setLocalClockNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [clockNow, workTime?.is_tracking]);
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== "DONE";
  const liveSeconds = workTime?.duration_seconds ?? 0;
  const elapsed = liveSeconds + (workTime?.is_tracking && workTime.active_since ? Math.max(0, Math.floor(((clockNow ?? localClockNow) - Date.parse(workTime.active_since)) / 1000)) : 0);
  const timerText = `${String(Math.floor(elapsed / 3600)).padStart(2, "0")}:${String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;

  return (
    <Draggable draggableId={placementId} index={index} isDragDisabled={!canMove}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...(canMove ? provided.dragHandleProps : {})}
          className={`mb-2 rounded-lg border border-border bg-card p-3 shadow-sm transition-shadow ${canMove ? "cursor-grab active:cursor-grabbing" : ""} ${
            snapshot.isDragging ? "shadow-md ring-2 ring-primary/30" : "hover:shadow-md"
          }`}
        >
          <div className="flex items-start justify-between gap-1">
            <p className="min-w-0 flex-1 text-sm font-medium leading-snug text-foreground">
              {task.task_name}
            </p>
          {(canEditTask || canDeleteTask || onOpenDetails || onStartWork || onApproveReview) && (
              <div className="flex shrink-0 items-center gap-0.5">
                {onStartWork && <Button type="button" variant={isInWorkSession ? "secondary" : "ghost"} size="icon" className="h-7 w-7" aria-label={isInWorkSession ? `Tracked in shared timer: ${task.task_name}` : `Start work on ${task.task_name}`} title={isInWorkSession ? "Included in shared timer" : "Start or add to shared timer"} onClick={(event) => { event.stopPropagation(); if (!isInWorkSession) onStartWork(task); }} onMouseDown={(event) => event.stopPropagation()}><span className="relative inline-flex">{isInWorkSession ? <Timer className="h-3.5 w-3.5 text-violet-700" /> : <Play className="h-3.5 w-3.5" />}</span></Button>}
                {onApproveReview && <Button type="button" variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs" disabled={isApprovingReview} aria-label={`Approve review for ${task.task_name}`} title="Approve review" onClick={(event) => { event.stopPropagation(); onApproveReview(task); }} onMouseDown={(event) => event.stopPropagation()}><Check className="h-3.5 w-3.5" />{isApprovingReview ? "Approving…" : "Approve"}</Button>}
                {onOpenDetails && <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label={`Open comments for ${task.task_name}`} title="Comments and activity" onClick={(event) => { event.stopPropagation(); onOpenDetails(task); }} onMouseDown={(event) => event.stopPropagation()}><MessageCircle className="h-3.5 w-3.5" /></Button>}
              {canEditTask && onEdit && <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label={`Edit task ${task.task_name}`} title="Edit task" onClick={(event) => { event.stopPropagation(); onEdit(task); }} onMouseDown={(event) => event.stopPropagation()}><Pencil className="h-3.5 w-3.5" /></Button>}
              {canDeleteTask && onDelete && <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" aria-label={`Delete task ${task.task_name}`} title="Delete task" onClick={(event) => { event.stopPropagation(); onDelete(task); }} onMouseDown={(event) => event.stopPropagation()}><Trash2 className="h-3.5 w-3.5" /></Button>}
              </div>
            )}
          </div>

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

          {!!task.checklist_items?.length && <div className="mt-3 space-y-1.5 border-t border-border pt-2">
            <p className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground"><CheckSquare className="h-3 w-3" />Checklist · {task.checklist_items.filter((item) => item.is_completed).length}/{task.checklist_items.length}</p>
            <div className="max-h-28 space-y-1 overflow-y-auto">
              {task.checklist_items.map((item) => <label key={item.item_id} className="flex items-start gap-2 text-xs text-foreground">
                <Checkbox checked={item.is_completed} disabled={!canEdit} onCheckedChange={() => onToggleChecklist?.(task, item.item_id)} onClick={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()} className="mt-0.5 h-3.5 w-3.5" />
                <span className={item.is_completed ? "text-muted-foreground line-through" : ""}>{item.text}</span>
              </label>)}
            </div>
          </div>}

          <div className={`mt-2 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold ${workTime?.is_tracking ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200" : elapsed > 0 ? "bg-slate-100 text-slate-700" : "bg-slate-50 text-slate-500"}`}>
            <Timer className="h-3.5 w-3.5 shrink-0" />
            <span className="font-mono tabular-nums">{timerText}</span>
            <span className="ml-auto">{workTime?.is_tracking ? "Running" : elapsed > 0 ? "Saved" : "Not started"}</span>
          </div>

          <div className="mt-3">
            <UserAvatar user={assignee} showName size="sm" />
          </div>
          {showEdgeMoveHandles && canMove && <div className="-mx-1 mt-1 flex h-3 items-center justify-center text-slate-400" aria-hidden="true"><GripHorizontal className="h-4 w-4" /></div>}
        </div>
      )}
    </Draggable>
  );
}
