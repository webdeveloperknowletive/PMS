import { Droppable } from "@hello-pangea/dnd";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanCard } from "./kanban-card";
import type { KanbanColumn as KanbanColumnType } from "@/types/kanban";
import type { Task } from "@/types/task";
import type { User } from "@/types/user";

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
  canMoveTask,
  canEditTask,
  canDeleteTask,
  onEditTask,
  onDeleteTask,
}: {
  column: KanbanColumnType;
  cards: KanbanCardData[];
  userMap: Map<string, User>;
  onAddTask: (columnId: string) => void;
  canAddTask: boolean;
  canMoveTask: boolean;
  canEditTask: (task: Task) => boolean;
  canDeleteTask: boolean;
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
}) {
  return (
    <div className="flex w-72 shrink-0 flex-col rounded-xl bg-secondary/50">
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
        </div>
        {canAddTask && <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onAddTask(column.column_id)} aria-label={`Add task to ${column.column_name}`} title="Add task">
            <Plus className="h-3.5 w-3.5" />
          </Button>
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
              <KanbanCard
                key={card.placementId}
                task={card.task}
                assignee={card.task.user_id ? userMap.get(card.task.user_id) : null}
                placementId={card.placementId}
                index={index}
                canEdit={canEditTask(card.task)}
                canMove={canMoveTask}
                canDelete={canDeleteTask}
                onEdit={onEditTask}
                onDelete={onDeleteTask}
              />
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
