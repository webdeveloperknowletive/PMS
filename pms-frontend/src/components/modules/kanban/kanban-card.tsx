import { Draggable } from "@hello-pangea/dnd";
import { Calendar } from "lucide-react";
import { PriorityBadge } from "@/components/shared/priority-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { formatDate } from "@/lib/utils";
import type { Task } from "@/types/task";
import type { User } from "@/types/user";

export function KanbanCard({
  task,
  assignee,
  placementId,
  index,
}: {
  task: Task;
  assignee: User | null | undefined;
  placementId: string;
  index: number;
}) {
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== "DONE";

  return (
    <Draggable draggableId={placementId} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`mb-2 rounded-lg border border-border bg-card p-3 shadow-sm transition-shadow ${
            snapshot.isDragging ? "shadow-md ring-2 ring-primary/30" : "hover:shadow-md"
          }`}
        >
          <p className="text-sm font-medium leading-snug text-foreground">{task.task_name}</p>

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
