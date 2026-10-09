"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCreateKanbanColumn } from "@/hooks/queries/use-kanban";
import { getApiErrorMessage } from "@/lib/api/client";

const COLOR_OPTIONS = [
  { label: "Slate", value: "#94A3B8" },
  { label: "Blue", value: "#3B82F6" },
  { label: "Amber", value: "#F59E0B" },
  { label: "Purple", value: "#8B5CF6" },
  { label: "Green", value: "#22C55E" },
  { label: "Red", value: "#EF4444" },
];

export function AddColumnDialog({
  open,
  onOpenChange,
  projectId,
  nextPosition,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  nextPosition: number;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLOR_OPTIONS[0].value);
  const createColumn = useCreateKanbanColumn();

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      await createColumn.mutateAsync({
        project_id: projectId,
        column_name: name.trim(),
        position: nextPosition,
        color,
      });
      toast.success(`"${name.trim()}" column added`);
      setName("");
      setColor(COLOR_OPTIONS[0].value);
      onOpenChange(false);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add column</DialogTitle>
          <DialogDescription>
            Add a new column to this board. Note: only columns named exactly &quot;To Do&quot;, &quot;In
            Progress&quot;, &quot;In Review&quot;, or &quot;Done&quot; auto-sync task status when cards are
            dragged into them — custom names are visual-only.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="column-name">Column name</Label>
            <Input
              id="column-name"
              placeholder="e.g. Testing"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) handleCreate();
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex gap-2">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={`h-7 w-7 rounded-full transition-all ${
                    color === c.value ? "ring-2 ring-offset-2 ring-primary" : ""
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!name.trim() || createColumn.isPending}>
            {createColumn.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Add column
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
