"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, KeyRound, Pencil, Plus, Search, ShieldCheck, Trash2, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RoleAssignUsersDialog } from "@/components/modules/roles/role-assign-users-dialog";
import { useAllRoleAssignments, useCreateRole, useDeleteRole, usePermissionCatalog, useRolePermissions, useRoles, useSetRolePermissions, useUpdateRole } from "@/hooks/queries/use-roles";
import { usePermissions } from "@/hooks/use-permissions";
import { formatDate } from "@/lib/utils";
import { getApiErrorMessage } from "@/lib/api/client";
import type { Permission, Role } from "@/types/role";

export default function RolesPage() {
  const { permissionCodes } = usePermissions();
  const can = (code: string) => permissionCodes.includes("roles.manage") || permissionCodes.includes(code);
  const { data: roles, isLoading } = useRoles(can("roles.view"));
  const { data: assignments } = useAllRoleAssignments(can("roles.assignments.view"));
  const canViewPermissions = can("roles.permissions.view") || can("roles.permissions.update");
  const { data: catalog, isLoading: catalogLoading, isError: catalogError } = usePermissionCatalog(canViewPermissions);
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const deleteRole = useDeleteRole();
  const setPermissions = useSetRolePermissions();
  const [search, setSearch] = useState("");
  const [usersRole, setUsersRole] = useState<Role | null>(null);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleName, setRoleName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const roleId = editingRole?.role_id;
  const { data: rolePermissions, isLoading: permissionsLoading, isError: permissionsError } = useRolePermissions(roleId, canViewPermissions);
  const grouped = useMemo(() => (catalog ?? []).reduce<Record<string, Permission[]>>((acc, p) => {
    (acc[p.category] ??= []).push(p);
    return acc;
  }, {}), [catalog]);

  useEffect(() => {
    if (editingRole) {
      setRoleName(editingRole.role_name);
      setDescription(editingRole.description ?? "");
      setSelected([]);
    } else {
      setRoleName(""); setDescription(""); setSelected([]);
    }
  }, [editingRole]);
  useEffect(() => {
    if (!editingRole?.role_id || rolePermissions) setSelected((rolePermissions ?? []).map((p) => p.permission_id));
  }, [editingRole?.role_id, rolePermissions]);

  const filtered = (roles ?? []).filter((role) => role.role_name.toLowerCase().includes(search.toLowerCase()));
  const totalAssignments = (assignments ?? []).reduce((sum, item) => sum + item.roles.length, 0);
  const countFor = (roleId: string) => (assignments ?? []).filter((a) => a.roles.some((r) => r.role_id === roleId)).length;
  const activeCategory = Object.keys(grouped).includes(selectedCategory) ? selectedCategory : Object.keys(grouped)[0] ?? "";
  useEffect(() => { if (activeCategory && activeCategory !== selectedCategory) setSelectedCategory(activeCategory); }, [activeCategory, selectedCategory]);
  const modulePermissions = grouped[activeCategory] ?? [];
  const moduleGranted = modulePermissions.filter((permission) => selected.includes(permission.permission_id)).length;
  const togglePermission = (id: string, checked: boolean) => setSelected((prev) => checked ? [...new Set([...prev, id])] : prev.filter((item) => item !== id));
  const showRoles = () => requestAnimationFrame(() => document.getElementById("role-results")?.scrollIntoView({ behavior: "smooth", block: "start" }));

  const saveRole = async () => {
    if (!roleName.trim()) { toast.error("Enter a role name."); return; }
    if (can("roles.permissions.update") && (catalogLoading || catalogError || (editingRole?.role_id && (permissionsLoading || permissionsError)))) {
      toast.error("Permissions could not be loaded. Close and reopen the role before saving.");
      return;
    }
    try {
      const role = editingRole?.role_id
        ? (can("roles.update")
            ? await updateRole.mutateAsync({ id: editingRole.role_id, payload: { role_name: roleName.trim(), description: description.trim() || null } })
            : editingRole)
        : await createRole.mutateAsync({ role_name: roleName.trim(), description: description.trim() || null });
      if (!role.is_system && can("roles.permissions.update")) {
        await setPermissions.mutateAsync({ roleId: role.role_id, permissionIds: selected });
      }
      toast.success(editingRole ? "Role updated." : "Role created.");
      setEditingRole(null);
    } catch (err) { toast.error(getApiErrorMessage(err)); }
  };
  const removeRole = async (role: Role) => {
    if (!window.confirm(`Delete role “${role.role_name}”?`)) return;
    try { await deleteRole.mutateAsync(role.role_id); toast.success("Role deleted."); }
    catch (err) { toast.error(getApiErrorMessage(err)); }
  };

  return <div className="space-y-6">
    <PageHeader title="Roles & Permissions" description="Create workspace roles and assign exact access to modules and actions."
      actions={can("roles.create") && <Button onClick={() => setEditingRole({ role_name: "", description: "", role_id: "", created_at: "", is_system: false })}><Plus className="mr-2 h-4 w-4" />Create role</Button>} />
    <div className="grid grid-cols-2 gap-4">
      <button type="button" onClick={showRoles} className="metric-card rounded-2xl border border-border bg-card text-left transition hover:border-violet-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"><span className="flex items-center gap-3 p-4"><span className="rounded-lg bg-indigo-100 p-2 text-indigo-700"><ShieldCheck className="h-5 w-5" /></span><span><span className="block text-xs text-muted-foreground">Workspace roles</span><span className="block text-2xl font-semibold">{roles?.length ?? 0}</span></span></span></button>
      <button type="button" onClick={showRoles} className="metric-card rounded-2xl border border-border bg-card text-left transition hover:border-violet-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"><span className="flex items-center gap-3 p-4"><span className="rounded-lg bg-cyan-100 p-2 text-cyan-700"><UsersRound className="h-5 w-5" /></span><span><span className="block text-xs text-muted-foreground">Role assignments</span><span className="block text-2xl font-semibold">{totalAssignments}</span></span></span></button>
    </div>
    <div className="relative w-full max-w-xs"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search roles..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
    <Card id="role-results" className="scroll-mt-6">{isLoading ? <CardContent className="space-y-3 p-5">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</CardContent> :
      <Table><TableHeader><TableRow><TableHead>Role</TableHead><TableHead>Users</TableHead><TableHead>Created</TableHead><TableHead className="w-48" /></TableRow></TableHeader><TableBody>
        {filtered.map((role) => <TableRow key={role.role_id}>
          <TableCell><div className="flex items-center gap-2 font-medium">{role.role_name}{role.is_system && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700">System</span>}</div>{role.description && <p className="mt-1 line-clamp-1 max-w-md text-xs text-muted-foreground">{role.description}</p>}</TableCell>
          <TableCell>{countFor(role.role_id)}</TableCell><TableCell className="text-sm text-muted-foreground">{formatDate(role.created_at)}</TableCell>
          <TableCell><div className="flex justify-end gap-2">{can("roles.assignments.view") && <Button variant="outline" size="sm" onClick={() => setUsersRole(role)}>Users</Button>}{!role.is_system && (can("roles.update") || can("roles.permissions.view") || can("roles.permissions.update")) && <Button variant="ghost" size="icon" aria-label={`Edit ${role.role_name}`} onClick={() => setEditingRole(role)}><Pencil className="h-4 w-4" /></Button>}{!role.is_system && can("roles.delete") && <Button variant="ghost" size="icon" aria-label={`Delete ${role.role_name}`} onClick={() => removeRole(role)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}</div></TableCell>
        </TableRow>)}
        {!filtered.length && <TableRow><TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">No roles found.</TableCell></TableRow>}
      </TableBody></Table>}
    </Card>
    <Dialog open={!!editingRole} onOpenChange={(open) => !open && setEditingRole(null)}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>{editingRole?.role_id ? "Edit role" : "Create role"}</DialogTitle><DialogDescription>Choose the exact actions this role can perform. Changes take effect immediately.</DialogDescription></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2"><div><label className="mb-1 block text-sm font-medium">Role name</label><Input value={roleName} onChange={(e) => setRoleName(e.target.value)} maxLength={100} disabled={!!editingRole?.role_id && !can("roles.update")} /></div><div><label className="mb-1 block text-sm font-medium">Description</label><Textarea className="min-h-10" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={255} disabled={!!editingRole?.role_id && !can("roles.update")} /></div></div>
        <div className="flex items-center gap-2 text-sm font-semibold"><KeyRound className="h-4 w-4 text-indigo-600" />Permissions</div>
        {permissionsLoading || catalogLoading ? <Skeleton className="h-48 w-full" /> : canViewPermissions ? catalogError || permissionsError ? <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">Could not load permissions. Close and reopen this role to retry; changes are disabled until the current grants are available.</p> : <div className="grid min-h-[280px] gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
          <nav aria-label="Permission modules" className="space-y-1 rounded-xl border bg-muted/30 p-2">{Object.entries(grouped).map(([category, permissions], index) => {
            const granted = permissions.filter((permission) => selected.includes(permission.permission_id)).length;
            const active = category === activeCategory;
            return <button key={category} type="button" onClick={() => setSelectedCategory(category)} aria-current={active ? "page" : undefined} className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition ${active ? "bg-indigo-600 text-white shadow-sm" : "text-foreground hover:bg-background"}`}><span className="flex min-w-0 items-center gap-2"><span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md text-[11px] font-bold ${active ? "bg-white/20" : "bg-indigo-100 text-indigo-700"}`}>{index + 1}</span><span className="truncate font-medium">{category}</span></span><span className={`text-xs tabular-nums ${active ? "text-indigo-100" : "text-muted-foreground"}`}>{granted}/{permissions.length}</span></button>;
          })}</nav>
          <section className="rounded-xl border p-4"><div className="mb-4 flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-base font-semibold">{activeCategory}</h3><p className="mt-1 text-xs text-muted-foreground">Select the operations this role can perform in this module.</p></div><span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">{moduleGranted} of {modulePermissions.length} enabled</span></div><div className="grid gap-2 sm:grid-cols-2">{modulePermissions.map((permission) => <label key={permission.permission_id} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition ${selected.includes(permission.permission_id) ? "border-indigo-200 bg-indigo-50/70" : "hover:bg-muted/40"}`}><Checkbox checked={selected.includes(permission.permission_id)} disabled={!can("roles.permissions.update")} onCheckedChange={(checked) => togglePermission(permission.permission_id, checked === true)} /><span className="min-w-0 flex-1"><span className="block font-medium">{permission.name.replace(`${activeCategory}: `, "")}</span><span className="mt-0.5 block break-all text-xs text-muted-foreground">{permission.code}</span></span>{selected.includes(permission.permission_id) && <Check className="h-4 w-4 shrink-0 text-indigo-600" />}</label>)}</div>{!modulePermissions.length && <p className="py-8 text-center text-sm text-muted-foreground">No operations are configured for this module.</p>}</section>
        </div> : <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">You can edit role details, but do not have permission to view or change its grants.</p>}
        <DialogFooter><Button variant="outline" onClick={() => setEditingRole(null)}>Cancel</Button><Button onClick={saveRole} disabled={createRole.isPending || updateRole.isPending || setPermissions.isPending || permissionsLoading || catalogLoading || catalogError || permissionsError || (!can("roles.update") && !can("roles.permissions.update"))}>{createRole.isPending || updateRole.isPending || setPermissions.isPending ? "Saving…" : "Save changes"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <RoleAssignUsersDialog open={!!usersRole} onOpenChange={(open) => !open && setUsersRole(null)} role={usersRole} />
  </div>;
}
