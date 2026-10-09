"use client";

import { useState } from "react";
import { Plus, MoreHorizontal, Pencil, Trash2, UserCog, Search } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserFormDialog } from "@/components/modules/users/user-form-dialog";
import { useUsers } from "@/hooks/queries/use-users";
import { useDeleteUser, useToggleUserStatus } from "@/hooks/queries/use-users-admin";
import { useAllRoleAssignments, useRoles } from "@/hooks/queries/use-roles";
import { formatDate } from "@/lib/utils";
import { getApiErrorMessage } from "@/lib/api/client";
import type { User } from "@/types/user";
import { RequireAdmin } from "@/components/shared/require-admin";
import { useAuthStore } from "@/store/auth-store";

const ALL = "__all__";

export default function UsersPage() {
  const { data: users, isLoading } = useUsers();
  const { data: assignments } = useAllRoleAssignments();
  const { data: roles } = useRoles();
  const toggleStatus = useToggleUserStatus();
  const deleteMutation = useDeleteUser();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const currentUser = useAuthStore((s) => s.user);

  const roleNamesForUser = (userId: string) => {
    const assignedRoleIds = new Set(
      (assignments ?? []).find((assignment) => assignment.user.user_id === userId)?.roles.map((role) => role.role_id) ?? []
    );
    return (roles ?? []).filter((role) => assignedRoleIds.has(role.role_id)).map((role) => role.role_name);
  };

  const filtered = (users ?? []).filter((u) => {
    const roleNames = roleNamesForUser(u.user_id);
    if (
      search &&
      !u.name.toLowerCase().includes(search.toLowerCase()) &&
      !u.email.toLowerCase().includes(search.toLowerCase()) &&
      !roleNames.some((roleName) => roleName.toLowerCase().includes(search.toLowerCase()))
    )
      return false;
    if (statusFilter === "ACTIVE" && !u.is_active) return false;
    if (statusFilter === "INACTIVE" && u.is_active) return false;
    return true;
  });

  const total = users?.length ?? 0;
  const active = users?.filter((u) => u.is_active).length ?? 0;
  const inactive = total - active;

  const openCreate = () => {
    setEditingUser(null);
    setFormOpen(true);
  };
  const openEdit = (u: User) => {
    setEditingUser(u);
    setFormOpen(true);
  };
  const handleToggleStatus = async (u: User) => {
    if (u.user_id === currentUser?.user_id) {
      toast.error("You can't deactivate your own account.");
      return;
    }
    try {
      await toggleStatus.mutateAsync({ userId: u.user_id, is_active: !u.is_active });
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };
  const confirmDelete = async () => {
    if (!deletingUser) return;
    try {
      await deleteMutation.mutateAsync(deletingUser.user_id);
      toast.success("User deleted");
      setDeletingUser(null);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  return (
    <RequireAdmin>
      <div className="space-y-6">
        <PageHeader
          title="Users"
          description="Manage system users and their access"
          actions={
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Add User
            </Button>
          }
        />

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total Users</p>
              <p className="mt-1 text-2xl font-semibold">{total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Active</p>
              <p className="mt-1 text-2xl font-semibold text-green-600">{active}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Inactive</p>
              <p className="mt-1 text-2xl font-semibold text-red-500">{inactive}</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by name or email..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All Statuses</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          {isLoading ? (
            <CardContent className="space-y-3 p-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </CardContent>
          ) : filtered.length === 0 ? (
            <CardContent className="p-5">
              <EmptyState icon={UserCog} title="No users found" description="Try adjusting your search or filters." />
            </CardContent>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => (
                  <TableRow key={u.user_id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <UserAvatar user={u} showName={false} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {u.name} ({roleNamesForUser(u.user_id).join(", ") || "No role assigned"})
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={u.is_active}
                          onCheckedChange={() => handleToggleStatus(u)}
                          disabled={u.user_id === currentUser?.user_id}
                        />
                        <span className="text-xs text-muted-foreground">
                          {u.is_active ? "Active" : "Inactive"}
                          {u.user_id === currentUser?.user_id && " (you)"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(u.created_at)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(u)}>
                            <Pencil />
                            Edit
                          </DropdownMenuItem>
                          {u.user_id !== currentUser?.user_id && (
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeletingUser(u)}
                            >
                              <Trash2 />
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        <UserFormDialog open={formOpen} onOpenChange={setFormOpen} user={editingUser} />

        <ConfirmDialog
          open={!!deletingUser}
          onOpenChange={(open) => !open && setDeletingUser(null)}
          title="Delete user?"
          description={`This will permanently delete "${deletingUser?.name}". If they lead any team, deletion will fail until reassigned (a real DB constraint).`}
          onConfirm={confirmDelete}
          isLoading={deleteMutation.isPending}
        />
      </div>
    </RequireAdmin>
  );
}
