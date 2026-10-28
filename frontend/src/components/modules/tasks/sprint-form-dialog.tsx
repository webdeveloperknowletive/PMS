"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCreateSprint } from "@/hooks/queries/use-tasks";
import { getApiErrorMessage } from "@/lib/api/client";

export function SprintFormDialog({ open, onOpenChange, projectId }: { open: boolean; onOpenChange: (open: boolean) => void; projectId: string }) {
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [capacityPoints, setCapacityPoints] = useState("");
  const createSprint = useCreateSprint();

  const close = () => {
    onOpenChange(false);
    setName(""); setGoal(""); setStartDate(""); setEndDate(""); setCapacityPoints("");
  };
  const save = async () => {
    if (!name.trim()) return;
    if (startDate && endDate && endDate < startDate) { toast.error("Sprint end date must be after its start date"); return; }
    const capacity = capacityPoints === "" ? null : Number(capacityPoints);
    if (capacity !== null && (!Number.isInteger(capacity) || capacity < 0 || capacity > 10000)) { toast.error("Capacity must be a whole number from 0 to 10,000 story points"); return; }
    try {
      await createSprint.mutateAsync({ project_id: projectId, sprint_name: name.trim(), goal: goal.trim() || null, start_date: startDate || null, end_date: endDate || null, capacity_points: capacity });
      toast.success("Sprint created");
      close();
    } catch (error) { toast.error(getApiErrorMessage(error)); }
  };

  return <Dialog open={open} onOpenChange={(value) => value ? onOpenChange(true) : close()}>
    <DialogContent>
      <DialogHeader><DialogTitle>Create sprint</DialogTitle><DialogDescription>Give the team a short time window and one clear goal.</DialogDescription></DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5"><Label htmlFor="sprint-name">Sprint name</Label><Input id="sprint-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Sprint 1" autoFocus /></div>
        <div className="space-y-1.5"><Label htmlFor="sprint-goal">Sprint goal</Label><Textarea id="sprint-goal" value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="What should the team finish?" /></div>
        <div className="space-y-1.5"><Label htmlFor="sprint-capacity">Capacity (story points)</Label><Input id="sprint-capacity" type="number" min={0} max={10000} step={1} inputMode="numeric" value={capacityPoints} onChange={(event) => setCapacityPoints(event.target.value)} placeholder="Optional" /><p className="text-xs text-muted-foreground">Leave blank when the team has not set a capacity.</p></div>
        <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label htmlFor="sprint-start">Start date</Label><Input id="sprint-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></div><div className="space-y-1.5"><Label htmlFor="sprint-end">End date</Label><Input id="sprint-end" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></div></div>
      </div>
      <DialogFooter><Button variant="outline" onClick={close}>Cancel</Button><Button onClick={() => void save()} disabled={!name.trim() || createSprint.isPending}>{createSprint.isPending ? "Creating…" : "Create sprint"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
