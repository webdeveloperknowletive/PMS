"use client";

import { useState } from "react";
import { Loader2, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useAllRoleAssignments, useAssignRole, useRemoveRoleAssignment } from "@/hooks/queries/use-roles";
import { useUsers } from "@/hooks/queries/use-users";
import { getApiErrorMessage } from "@/lib/api/client";
import type { Role } from "@/types/role";

export function RoleAssignUsersDialog({
  open,
  onOpenChange,
  role,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: Role | null;
}) {
  const { data: users } = useUsers();
  const { data: assignments, isLoading } = useAllRoleAssignments();
  const assignRole = useAssignRole();
  const removeAssignment = useRemoveRoleAssignment();
  const [selectedUserId, setSelectedUserId] = useState("");

  if (!role) return null;

  const assignedForThisRole = (assignments ?? [])
    .filter((a) => a.roles.some((r) => r.role_id === role.role_id))
    .map((a) => ({ user: a.user, userRole: a.roles.find((r) => r.role_id === role.role_id)! }));

  const assignedUserIds = new Set(assignedForThisRole.map((a) => a.user.user_id));
  const availableUsers = (users ?? []).filter((u) => !assignedUserIds.has(u.user_id));

  const handleAssign = async () => {
    if (!selectedUserId) return;
    try {
      await assignRole.mutateAsync({ userId: selectedUserId, payload: { user_id: selectedUserId, role_id: role.role_id } });
      toast.success("Role assigned");
      setSelectedUserId("");
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const handleRemove = async (userId: string, name: string) => {
    try {
      await removeAssignment.mutateAsync({ userId, roleId: role.role_id });
      toast.success(`${name}'s role removed`);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{role.role_name} — Users</DialogTitle>
          <DialogDescription>Manage which users have this role.</DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select user to assign" />
            </SelectTrigger>
            <SelectContent>
              {availableUsers.map((u) => (
                <SelectItem key={u.user_id} value={u.user_id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleAssign} disabled={!selectedUserId || assignRole.isPending}>
            {assignRole.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Assign
          </Button>
        </div>

        <div className="space-y-1">
          {isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading...</p>
          ) : assignedForThisRole.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No users have this role yet.</p>
          ) : (
            assignedForThisRole.map(({ user }) => (
              <div key={user.user_id} className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-muted/50">
                <UserAvatar user={user} />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => handleRemove(user.user_id, user.name)}
                  disabled={removeAssignment.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}