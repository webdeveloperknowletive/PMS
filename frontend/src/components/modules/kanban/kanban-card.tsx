import { Draggable } from "@hello-pangea/dnd";
import { Calendar, Pencil, Trash2 } from "lucide-react";
import { PriorityBadge } from "@/components/shared/priority-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import type { Task } from "@/types/task";
import type { User } from "@/types/user";

export function KanbanCard({
  task,
  assignee,
  placementId,
  index,
  canEdit,
  canMove,
  canDelete,
  onEdit,
  onDelete,
}: {
  task: Task;
  assignee: User | null | undefined;
  placementId: string;
  index: number;
  canEdit: boolean;
  canMove: boolean;
  canDelete: boolean;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}) {
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== "DONE";

  return (
    <Draggable draggableId={placementId} index={index} isDragDisabled={!canMove}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`mb-2 rounded-lg border border-border bg-card p-3 shadow-sm transition-shadow ${
            snapshot.isDragging ? "shadow-md ring-2 ring-primary/30" : "hover:shadow-md"
          }`}
        >
          <div className="flex items-start justify-between gap-1">
            <p {...(canMove ? provided.dragHandleProps : {})} className={`min-w-0 flex-1 text-sm font-medium leading-snug text-foreground ${canMove ? "cursor-grab active:cursor-grabbing" : ""}`}>
              {task.task_name}
            </p>
            {(canEdit || canDelete) && (
              <div className="flex shrink-0 items-center gap-0.5">
                {canEdit && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    aria-label={`Edit task ${task.task_name}`}
                    title="Edit task"
                    onClick={(event) => {
                      event.stopPropagation();
                      onEdit(task);
                    }}
                    onMouseDown={(event) => event.stopPropagation()}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
                {canDelete && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    aria-label={`Delete task ${task.task_name}`}
                    title="Delete task"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete(task);
                    }}
                    onMouseDown={(event) => event.stopPropagation()}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between">
            <PriorityBadge priority={task.priority} />
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

          <div className="mt-3">
            <UserAvatar user={assignee} showName={false} size="sm" />
          </div>
        </div>
      )}
    </Draggable>
  );
}
