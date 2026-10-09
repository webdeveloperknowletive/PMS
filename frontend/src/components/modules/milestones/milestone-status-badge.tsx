import { Badge } from "@/components/ui/badge";
import type { Milestone } from "@/types/milestone";

export type DerivedMilestoneStatus = "Completed" | "Overdue" | "Upcoming";

/** Milestones has no status column — derive one from is_completed + due_date, same logic used for stat cards and filters. */
export function getMilestoneStatus(milestone: Milestone): DerivedMilestoneStatus {
  if (milestone.is_completed) return "Completed";
  const isOverdue = new Date(milestone.due_date) < new Date(new Date().toDateString());
  return isOverdue ? "Overdue" : "Upcoming";
}

const STATUS_COLOR: Record<DerivedMilestoneStatus, string> = {
  Completed: "bg-green-100 text-green-700",
  Overdue: "bg-red-100 text-red-700",
  Upcoming: "bg-amber-100 text-amber-700",
};

export function MilestoneStatusBadge({ milestone }: { milestone: Milestone }) {
  const status = getMilestoneStatus(milestone);
  return (
    <Badge variant="outline" className={`border-0 font-medium ${STATUS_COLOR[status]}`}>
      {status}
    </Badge>
  );
}
