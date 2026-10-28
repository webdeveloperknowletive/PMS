import { Fragment } from "react";
import { Droppable } from "@hello-pangea/dnd";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KanbanCard } from "./kanban-card";
import type { KanbanCardFeature } from "./kanban-card-feature-dialog";
import type { KanbanColumn as KanbanColumnType } from "@/types/kanban";
import type { Task } from "@/types/task";
import type { TaskWorkTime } from "@/types/task";
import type { User } from "@/types/user";
import { PRIORITY_LABEL } from "@/lib/constants";

export interface KanbanCardData {
  placementId: string;
  task: Task;
}

export function KanbanColumn({
  column,
  cards,
  userMap,
  onAddTask,
  canAddTask,
  canEditColumn,
  onEditColumn,
  canMoveTask,
  canEditTask,
  canEditChecklist,
  canEditCard,
  canArchiveTask,
  canDeleteTask,
  showEdgeMoveHandles,
  onOpenTaskDetails,
  onViewTaskDetails,
  canManageCardMembers,
  onManageCardMembers,
  onStartWork,
  onApproveReview,
  onCancelReview,
  approvingReviewTaskId,
  cancellingReviewTaskId,
  approvedReviewTaskIds,
  onEditTask,
  onArchiveTask,
  onDeleteTask,
  onToggleChecklist,
  canUseCardFeature,
  onCardFeature,
  canStartWork,
  canApproveReview,
  canCancelReview,
  activeTaskIds,
  taskWorkTimes,
  clockNow,
  groupBy,
  labelColors,
  labelNames,
}: {
  column: KanbanColumnType;
  cards: KanbanCardData[];
  userMap: Map<string, User>;
  onAddTask: (columnId: string) => void;
  canAddTask: boolean;
  canEditColumn?: boolean;
  onEditColumn?: (column: KanbanColumnType) => void;
  canMoveTask: boolean;
  canEditTask: (task: Task) => boolean;
  canEditChecklist?: (task: Task) => boolean;
  canEditCard?: (task: Task) => boolean;
  canArchiveTask?: (task: Task) => boolean;
  canDeleteTask?: (task: Task) => boolean;
  showEdgeMoveHandles?: boolean;
  onOpenTaskDetails?: (task: Task) => void;
  onViewTaskDetails?: (task: Task) => void;
  canManageCardMembers?: (task: Task) => boolean;
  onManageCardMembers?: (task: Task) => void;
  onStartWork?: (task: Task) => void;
  onApproveReview?: (task: Task) => void;
  onCancelReview?: (task: Task, comment: string) => Promise<void>;
  approvingReviewTaskId?: string | null;
  cancellingReviewTaskId?: string | null;
  approvedReviewTaskIds?: Set<string>;
  onEditTask?: (task: Task) => void;
  onArchiveTask?: (task: Task) => void;
  onDeleteTask?: (task: Task) => void;
  onToggleChecklist?: (task: Task, itemId: string) => void;
  canUseCardFeature?: (feature: KanbanCardFeature, task: Task) => boolean;
  onCardFeature?: (task: Task, feature: KanbanCardFeature) => void;
  canStartWork?: (task: Task) => boolean;
  canApproveReview?: (task: Task) => boolean;
  canCancelReview?: (task: Task) => boolean;
  activeTaskIds?: Set<string>;
  taskWorkTimes?: Map<string, TaskWorkTime>;
  clockNow?: number;
  groupBy?: "assignee" | "priority";
  labelColors?: Record<string, string>;
  labelNames?: Record<string, string>;
}) {
  const isDoneColumn = ["done", "complete", "completed"].includes(column.column_name.trim().toLowerCase());
  const isReviewColumn = ["in review", "in-review", "review"].includes(column.column_name.trim().toLowerCase());
  const activeCardCount = cards.filter(({ task }) => !["DONE", "CANCELLED"].includes(task.status)).length;
  const isAtWipLimit = column.wip_limit != null && activeCardCount >= column.wip_limit;
  const groupLabel = (card: KanbanCardData) => groupBy === "priority"
    ? PRIORITY_LABEL[card.task.priority]
    : groupBy === "assignee"
      ? card.task.user_id ? userMap.get(card.task.user_id)?.name ?? card.task.assignee_name ?? "Assigned" : "Unassigned"
      : "";

  return (
    <div className="flex h-full min-h-[22rem] w-72 shrink-0 flex-col rounded-xl bg-secondary/50">
      <div className="flex items-center justify-between px-3 py-3">
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: column.color ?? "#94A3B8" }}
          />
          <span className="text-sm font-semibold text-foreground">{column.column_name}</span>
          <span className="rounded-full bg-background px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
            {cards.length}
          </span>
          {column.wip_limit != null && (
            <span className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${isAtWipLimit ? "bg-destructive/10 text-destructive" : "bg-background text-muted-foreground"}`} title="Active tasks / WIP limit">
              {activeCardCount}/{column.wip_limit}
            </span>
          )}
        </div>
        {(canAddTask || (canEditColumn && onEditColumn)) && <div className="flex items-center gap-0.5">
          {canEditColumn && onEditColumn && <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEditColumn(column)} aria-label={`Edit ${column.column_name} settings`} title="Edit column">
            <Pencil className="h-3 w-3" />
          </Button>}
          {canAddTask && <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onAddTask(column.column_id)} aria-label={`Add task to ${column.column_name}`} title="Add task">
            <Plus className="h-3.5 w-3.5" />
          </Button>}
        </div>}
      </div>

      <Droppable droppableId={column.column_id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 overflow-y-auto scrollbar-thin px-2 pb-2 ${
              snapshot.isDraggingOver ? "bg-accent/40" : ""
            }`}
            style={{ minHeight: 80 }}
          >
            {cards.map((card, index) => (
              <Fragment key={card.placementId}>
              {groupBy && (index === 0 || groupLabel(card) !== groupLabel(cards[index - 1])) && <h4 className="mb-2 mt-3 rounded-md border border-slate-200 bg-white/90 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">{groupBy === "priority" ? `${groupLabel(card)} priority` : groupLabel(card)}</h4>}
              <KanbanCard
                task={card.task}
                assignee={card.task.user_id
                  ? userMap.get(card.task.user_id) ?? (card.task.assignee_name ? { user_id: card.task.user_id, name: card.task.assignee_name } : null)
                  : null}
                placementId={card.placementId}
                index={index}
                canEdit={canEditChecklist?.(card.task) ?? canEditTask(card.task)}
                canEditTask={canEditCard?.(card.task) ?? false}
                canArchiveTask={canArchiveTask?.(card.task) ?? false}
                canDeleteTask={canDeleteTask?.(card.task) ?? false}
                canMove={canMoveTask}
                showEdgeMoveHandles={showEdgeMoveHandles}
                onEdit={onEditTask}
                onArchive={onArchiveTask}
                onDelete={onDeleteTask}
                onOpenDetails={onOpenTaskDetails}
                onViewDetails={onViewTaskDetails}
                canManageMembers={canManageCardMembers?.(card.task) ?? false}
                onManageMembers={onManageCardMembers}
                onStartWork={!isDoneColumn && canStartWork?.(card.task) ? onStartWork : undefined}
                onApproveReview={onApproveReview && card.task.status !== "DONE" && !isDoneColumn && !approvedReviewTaskIds?.has(card.task.task_id) && (card.task.status === "IN_REVIEW" || isReviewColumn) && canApproveReview?.(card.task) ? onApproveReview : undefined}
                onCancelReview={onCancelReview && card.task.status !== "DONE" && !isDoneColumn && (card.task.status === "IN_REVIEW" || isReviewColumn) && canCancelReview?.(card.task) ? onCancelReview : undefined}
                isApprovingReview={approvingReviewTaskId === card.task.task_id}
                isCancellingReview={cancellingReviewTaskId === card.task.task_id}
                onToggleChecklist={onToggleChecklist}
                canUseCardFeature={canUseCardFeature}
                labelColors={labelColors}
                labelNames={labelNames}
                onCardFeature={onCardFeature}
                isInWorkSession={activeTaskIds?.has(card.task.task_id)}
                workTime={taskWorkTimes?.get(card.task.task_id)}
                clockNow={clockNow}
              />
              </Fragment>
            ))}
            {provided.placeholder}

            {canAddTask && <button
              onClick={() => onAddTask(column.column_id)}
              className="flex w-full items-center gap-1.5 rounded-lg px-2 py-2 text-sm text-muted-foreground hover:bg-background hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Task
            </button>}
          </div>
        )}
      </Droppable>
    </div>
  );
}
