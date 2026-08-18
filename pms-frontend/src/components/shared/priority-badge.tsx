import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PRIORITY_COLOR, PRIORITY_LABEL, type TaskPriority } from "@/lib/constants";

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <Badge variant="outline" className={cn("border-0 font-medium", PRIORITY_COLOR[priority])}>
      {PRIORITY_LABEL[priority]}
    </Badge>
  );
}
