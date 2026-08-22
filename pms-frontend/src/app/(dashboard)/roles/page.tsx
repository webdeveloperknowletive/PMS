"use client";

import { useState } from "react";
import { Plus, MoreHorizontal, Pencil, Trash2, ShieldCheck, Search, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RoleFormDialog } from "@/components/modules/roles/role-form-dialog";
import { RoleAssignUsersDialog } from "@/components/modules/roles/role-assign-users-dialog";
import { useAllRoleAssignments, useDeleteRole, useRoles } from "@/hooks/queries/use-roles";
import { formatDate } from "@/lib/utils";
import { getApiErrorMessage } from "@/lib/api/client";
import type { Role } from "@/types/role";
import { RequireAdmin } from "@/components/shared/require-admin";

export default function RolesPage() {
  const { data: roles, isLoading } = useRoles();
  const { data: assignments } = useAllRoleAssignments();
  const deleteMutation = useDeleteRole();

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [deletingRole, setDeletingRole] = useState<Role | null>(null);
  const [usersRole, setUsersRole] = useState<Role | null>(null);

  const userCountByRole = (roleId: string) =>
    (assignments ?? []).filter((a) => a.roles.some((r) => r.role_id === roleId)).length;

  const filtered = (roles ?? []).filter((r) => r.role_name.toLowerCase().includes(search.toLowerCase()));

  const totalAssignments = (assignments ?? []).reduce((sum, a) => sum + a.roles.length, 0);

  const openCreate = () => {
    setEditingRole(null);
    setFormOpen(true);
  };
  const openEdit = (r: Role) => {
    setEditingRole(r);
    setFormOpen(true);
  };
  const confirmDelete = async () => {
    if (!deletingRole) return;
    try {
      await deleteMutation.mutateAsync(deletingRole.role_id);
      toast.success("Role deleted");
      setDeletingRole(null);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  return (
     <RequireAdmin>
    <div className="space-y-6">
      <PageHeader
        title="Roles & Permissions"
        description="Manage user roles across the system"
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Create Role
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Roles</p>
            <p className="mt-1 text-2xl font-semibold">{roles?.length ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Assignments</p>
            <p className="mt-1 text-2xl font-semibold">{totalAssignments}</p>
          </CardContent>
        </Card>
      </div>

      <div className="relative w-full max-w-xs">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search roles..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
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
            <EmptyState
              icon={ShieldCheck}
              title="No roles found"
              description="Create a role to start assigning it to users."
              actionLabel="Create Role"
              onAction={openCreate}
            />
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead>Users</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((role) => (
                <TableRow key={role.role_id}>
                  <TableCell>
                    <p className="font-medium text-foreground">{role.role_name}</p>
                    {role.description && (
                      <p className="line-clamp-1 max-w-md text-xs text-muted-foreground">{role.description}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => setUsersRole(role)}
                      className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                    >
                      <UsersRound className="h-3.5 w-3.5" />
                      {userCountByRole(role.role_id)} user{userCountByRole(role.role_id) === 1 ? "" : "s"}
                    </button>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(role.created_at)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setUsersRole(role)}>
                          <UsersRound />
                          Manage Users
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEdit(role)}>
                          <Pencil />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeletingRole(role)}
                        >
                          <Trash2 />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <RoleFormDialog open={formOpen} onOpenChange={setFormOpen} role={editingRole} />
      <RoleAssignUsersDialog open={!!usersRole} onOpenChange={(open) => !open && setUsersRole(null)} role={usersRole} />

      <ConfirmDialog
        open={!!deletingRole}
        onOpenChange={(open) => !open && setDeletingRole(null)}
        title="Delete role?"
        description={`This will permanently delete "${deletingRole?.role_name}" and remove it from anyone currently assigned it.`}
        onConfirm={confirmDelete}
        isLoading={deleteMutation.isPending}
      />
    </div>
    </RequireAdmin>
  );
}