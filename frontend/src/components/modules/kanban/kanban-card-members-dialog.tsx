"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useKanbanCardMemberOptions, useUpdateKanbanCardMembers } from "@/hooks/queries/use-kanban";
import { getApiErrorMessage } from "@/lib/api/client";
import type { KanbanCardMemberOption } from "@/types/kanban";
import type { Task, TaskCardMember } from "@/types/task";

function normalizedIds(values: Iterable<string>) {
  return [...values].sort();
}

export function KanbanCardMembersDialog({
  open,
  onOpenChange,
  task,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
}) {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const initialIds = useRef<string[]>([]);
  const taskId = task?.task_id;
  const optionsQuery = useKanbanCardMemberOptions(taskId, open && !!taskId);
  const updateMembers = useUpdateKanbanCardMembers();
  const currentMembers = task?.card_members ?? [];

  useEffect(() => {
    if (!open || !task) return;
    const selected = currentMembers.filter((member) => !member.is_primary && member.user_id !== task.user_id).map((member) => member.user_id);
    initialIds.current = normalizedIds(selected);
    setSelectedIds(new Set(selected));
    setSearch("");
  }, [open, task?.task_id]);

  const primaryMember = currentMembers.find((member) => member.is_primary)
    ?? (task?.user_id && task.assignee_name ? {
      user_id: task.user_id,
      name: task.assignee_name,
      profile_picture_url: null,
      is_primary: true,
      assigned_at: null,
    } satisfies TaskCardMember : undefined);

  const allOptions = useMemo(() => {
    const byId = new Map<string, KanbanCardMemberOption>((optionsQuery.data ?? []).map((option) => [option.user_id, option]));
    for (const member of currentMembers) {
      if (member.is_primary || byId.has(member.user_id)) continue;
      byId.set(member.user_id, {
        user_id: member.user_id,
        name: member.name,
        profile_picture_url: member.profile_picture_url,
        is_active: false,
        is_eligible: false,
      });
    }
    return [...byId.values()];
  }, [optionsQuery.data, currentMembers]);

  const normalizedSearch = search.trim().toLocaleLowerCase();
  const selectedMembers = allOptions.filter((member) => selectedIds.has(member.user_id)
    && (!normalizedSearch || member.name.toLocaleLowerCase().includes(normalizedSearch)));
  const availableMembers = allOptions.filter((member) => member.is_active && member.is_eligible
    && member.user_id !== primaryMember?.user_id
    && !selectedIds.has(member.user_id)
    && (!normalizedSearch || member.name.toLocaleLowerCase().includes(normalizedSearch)));
  const isDirty = JSON.stringify(normalizedIds(selectedIds)) !== JSON.stringify(initialIds.current);

  const toggleMember = (memberId: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(memberId);
      else next.delete(memberId);
      return next;
    });
  };

  const save = async () => {
    if (!taskId || !isDirty) return;
    try {
      await updateMembers.mutateAsync({ taskId, memberIds: normalizedIds(selectedIds) });
      toast.success("Card members updated");
      onOpenChange(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  const renderMemberRow = (member: KanbanCardMemberOption, opts: { primary?: boolean; selected?: boolean } = {}) => {
    const checked = opts.primary === true || opts.selected === true;
    const disabled = opts.primary === true || (!member.is_eligible && !checked);
    return <label key={member.user_id} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 ${checked ? "border-primary/30 bg-primary/5" : "hover:bg-muted/60"} ${disabled ? "cursor-default" : ""}`}>
      <Checkbox
        checked={checked}
        disabled={disabled || updateMembers.isPending}
        aria-label={`${checked ? "Remove" : "Assign"} ${member.name}${opts.primary ? " (primary assignee)" : ""}`}
        onCheckedChange={(value) => toggleMember(member.user_id, value === true)}
      />
      <UserAvatar user={{ user_id: member.user_id, name: member.name, profile_picture_url: member.profile_picture_url }} showName={false} size="sm" />
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{member.name}</span>
      {opts.primary && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">Primary</span>}
      {!opts.primary && !member.is_eligible && <span className="text-[10px] text-muted-foreground">No longer on project team</span>}
      {checked && <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />}
    </label>;
  };

  const primaryOption = primaryMember ? {
    user_id: primaryMember.user_id,
    name: primaryMember.name,
    profile_picture_url: primaryMember.profile_picture_url,
    is_active: true,
    is_eligible: false,
  } satisfies KanbanCardMemberOption : null;

  return (
    <Dialog open={open && !!task} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Assign members</DialogTitle>
          <DialogDescription>Choose active members of this project’s teams for “{task?.task_name}”.</DialogDescription>
        </DialogHeader>

        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search project members" aria-label="Search project members" />

        {optionsQuery.isLoading && <p className="text-sm text-muted-foreground">Loading project members…</p>}
        {optionsQuery.isError && <p role="alert" className="text-sm text-destructive">{getApiErrorMessage(optionsQuery.error)}</p>}

        {primaryOption && <section className="space-y-2">
          <h3 className="text-sm font-semibold">Card members · {selectedIds.size + 1}</h3>
          {renderMemberRow(primaryOption, { primary: true })}
        </section>}

        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Currently assigned</h3>
          {!selectedMembers.length && !primaryOption && <p className="rounded-md border border-dashed p-3 text-center text-sm text-muted-foreground">No members assigned yet.</p>}
          {selectedMembers.map((member) => renderMemberRow(member, { selected: true }))}
          {selectedMembers.length === 0 && primaryOption && selectedIds.size === 0 && <p className="text-xs text-muted-foreground">Add teammates from the project list below.</p>}
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Project team</h3>
          {!optionsQuery.isLoading && !optionsQuery.isError && availableMembers.length === 0 && <p className="rounded-md border border-dashed p-3 text-center text-sm text-muted-foreground">{normalizedSearch ? "No matching members." : "No other active project team members."}</p>}
          {availableMembers.map((member) => renderMemberRow(member))}
        </section>

        <p className="text-xs text-muted-foreground">The primary task assignee remains assigned. Team members who are no longer eligible can be removed from this card.</p>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button type="button" disabled={!isDirty || updateMembers.isPending || optionsQuery.isError} onClick={() => void save()}>
            {updateMembers.isPending ? "Saving…" : "Save members"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
