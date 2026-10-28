"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { getApiErrorMessage } from "@/lib/api/client";
import type { Permission } from "@/types/role";
import type { User } from "@/types/user";
import { useSetUserPermissions, useUserPermissionCatalog, useUserPermissions } from "@/hooks/queries/use-users-admin";

interface UserPermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  canUpdate: boolean;
}

export function UserPermissionsDialog({ open, onOpenChange, user, canUpdate }: UserPermissionsDialogProps) {
  const catalog = useUserPermissionCatalog(open);
  const grants = useUserPermissions(user?.user_id, open);
  const savePermissions = useSetUserPermissions();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");

  const grouped = useMemo(() => (catalog.data ?? []).reduce<Record<string, Permission[]>>((result, permission) => {
    (result[permission.category] ??= []).push(permission);
    return result;
  }, {}), [catalog.data]);
  const categories = Object.keys(grouped);
  const activeCategory = categories.includes(selectedCategory) ? selectedCategory : categories[0] ?? "";
  const modulePermissions = grouped[activeCategory] ?? [];
  const directIds = new Set(selectedIds);
  const inheritedCodes = new Set((grants.data?.inherited ?? []).map((permission) => permission.code));
  const directCount = selectedIds.length;

  useEffect(() => {
    if (open && grants.data) setSelectedIds(grants.data.direct.map((permission) => permission.permission_id));
  }, [open, grants.data, user?.user_id]);

  useEffect(() => {
    if (activeCategory && activeCategory !== selectedCategory) setSelectedCategory(activeCategory);
  }, [activeCategory, selectedCategory]);

  const togglePermission = (permissionId: string, checked: boolean) => {
    setSelectedIds((current) => checked
      ? [...new Set([...current, permissionId])]
      : current.filter((id) => id !== permissionId));
  };

  const toggleModule = () => {
    const moduleIds = modulePermissions.map((permission) => permission.permission_id);
    const allSelected = moduleIds.length > 0 && moduleIds.every((id) => directIds.has(id));
    setSelectedIds((current) => allSelected
      ? current.filter((id) => !moduleIds.includes(id))
      : [...new Set([...current, ...moduleIds])]);
  };

  const save = async () => {
    if (!user) return;
    try {
      await savePermissions.mutateAsync({ userId: user.user_id, permissionIds: selectedIds });
      toast.success("User permissions saved.");
      onOpenChange(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  const loading = catalog.isLoading || grants.isLoading;
  const error = catalog.isError || grants.isError;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-indigo-600" /> User permissions</DialogTitle>
          <DialogDescription>
            {user ? `Manage direct module and action access for ${user.name}.` : "Manage direct module and action access."}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 p-3 text-sm text-indigo-950">
          Direct grants add access on top of the user’s assigned roles. To remove access inherited from a role, edit that role’s permissions.
          <div className="mt-1 text-xs text-indigo-800">{directCount} direct grants · {grants.data?.inherited.length ?? 0} permissions inherited from roles</div>
        </div>

        {loading ? <Skeleton className="h-80 w-full" /> : error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            <p>Could not load permission details. Retry before making changes.</p>
            <Button className="mt-3" size="sm" variant="outline" onClick={() => { void catalog.refetch(); void grants.refetch(); }}>Retry</Button>
          </div>
        ) : (
          <div className="grid min-h-[380px] gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
            <nav aria-label="Permission modules" className="space-y-1 rounded-xl border bg-muted/30 p-2">
              {Object.entries(grouped).map(([category, permissions], index) => {
                const granted = (permissions ?? []).filter((permission) => directIds.has(permission.permission_id)).length;
                const active = category === activeCategory;
                return <button
                  key={category}
                  type="button"
                  onClick={() => setSelectedCategory(category)}
                  aria-current={active ? "page" : undefined}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition ${active ? "bg-indigo-600 text-white shadow-sm" : "text-foreground hover:bg-background"}`}
                >
                  <span className="flex min-w-0 items-center gap-2"><span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md text-[11px] font-bold ${active ? "bg-white/20" : "bg-indigo-100 text-indigo-700"}`}>{index + 1}</span><span className="truncate font-medium">{category}</span></span>
                  <span className={`text-xs tabular-nums ${active ? "text-indigo-100" : "text-muted-foreground"}`}>{granted}/{permissions?.length ?? 0}</span>
                </button>;
              })}
            </nav>

            <section className="rounded-xl border p-4">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold">{activeCategory}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Choose actions to grant directly to this user.</p>
                </div>
                {canUpdate && <Button type="button" variant="outline" size="sm" onClick={toggleModule} disabled={!modulePermissions.length}>
                  {modulePermissions.length > 0 && modulePermissions.every((permission) => directIds.has(permission.permission_id)) ? "Clear module" : "Select module"}
                </Button>}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {modulePermissions.map((permission) => (
                  <label key={permission.permission_id} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition ${directIds.has(permission.permission_id) ? "border-indigo-200 bg-indigo-50/70" : "hover:bg-muted/40"}`}>
                    <Checkbox checked={directIds.has(permission.permission_id)} disabled={!canUpdate} onCheckedChange={(checked) => togglePermission(permission.permission_id, checked === true)} />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5 font-medium">
                        {permission.name.replace(`${activeCategory}: `, "")}
                        {inheritedCodes.has(permission.code) && <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">Via role</span>}
                      </span>
                      <span className="mt-1 block break-words text-xs text-muted-foreground">{permission.description}</span>
                      <span className="mt-1 block break-all font-mono text-[10px] text-slate-400">{permission.code}</span>
                    </span>
                    {directIds.has(permission.permission_id) && <Check className="h-4 w-4 shrink-0 text-indigo-600" />}
                  </label>
                ))}
              </div>
              {!modulePermissions.length && <p className="py-8 text-center text-sm text-muted-foreground">No actions are configured for this module.</p>}
            </section>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          {canUpdate && <Button onClick={save} disabled={loading || error || savePermissions.isPending}>
            {savePermissions.isPending ? "Saving…" : "Save permissions"}
          </Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
