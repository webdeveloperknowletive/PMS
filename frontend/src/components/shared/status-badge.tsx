import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PROJECT_STATUS_COLOR, TASK_STATUS_COLOR, TASK_STATUS_LABEL, type TaskStatus } from "@/lib/constants";

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return (
    <Badge variant="outline" className={cn("border-0 font-medium", TASK_STATUS_COLOR[status])}>
      {TASK_STATUS_LABEL[status]}
    </Badge>
  );
}

export function ProjectStatusBadge({ status }: { status: string }) {
  const label = status
    .toLowerCase()
    .split("_")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
  return (
    <Badge variant="outline" className={cn("border-0 font-medium", PROJECT_STATUS_COLOR[status] ?? "bg-slate-100 text-slate-600")}>
      {label}
    </Badge>
  );
}
