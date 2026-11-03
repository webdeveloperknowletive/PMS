"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { RecordDetailPage, type DetailField } from "@/components/shared/record-detail-page";
import { Button } from "@/components/ui/button";
import { usePermissionCatalog, useRolePermissions, useRoles, useSetRolePermissions, useUpdateRole } from "@/hooks/queries/use-roles";
import { usePermissions } from "@/hooks/use-permissions";
import { getApiErrorMessage } from "@/lib/api/client";
import type { Permission, RoleUpdate } from "@/types/role";

function PermissionOption({ permission, checked, disabled, onChange }: {
  permission: Permission;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return <label className={`flex items-start gap-3 rounded-lg border p-3 text-sm transition ${checked ? "border-indigo-200 bg-indigo-50/70" : "border-slate-200 hover:bg-slate-50"} ${disabled ? "cursor-default" : "cursor-pointer"}`}>
    <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-[#0c66e4]" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
    <span className="min-w-0"><span className="block font-medium text-[#172b4d]">{permission.name.replace(/: Module access$/, "")}</span><span className="mt-1 block text-xs text-[#626f86]">{permission.description}</span></span>
  </label>;
}

export default function RoleDetailPage() {
  const { roleId } = useParams<{ roleId: string }>();
  const { permissionCodes } = usePermissions();
  const canManagePermissions = permissionCodes.includes("roles.manage") || permissionCodes.includes("roles.permissions.update");
  const canViewPermissions = canManagePermissions || permissionCodes.includes("roles.permissions.view");
  const { data: roles = [], isLoading } = useRoles();
  const { data: catalog = [], isLoading: catalogLoading, isError: catalogError } = usePermissionCatalog(canViewPermissions);
  const { data: granted, isLoading: grantedLoading, isError: grantedError } = useRolePermissions(roleId, canViewPermissions);
  const update = useUpdateRole();
  const setPermissions = useSetRolePermissions();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (granted) setSelectedIds(granted.map((entry) => entry.permission_id));
  }, [granted, roleId]);

  const item = roles.find((entry) => entry.role_id === roleId);
  if (isLoading) return <p>Loading role…</p>;
  if (!item) return <p>Role unavailable.</p>;

  const canEdit = permissionCodes.includes("roles.manage") || permissionCodes.includes("roles.update");
  const canChangeGrants = canManagePermissions && !item.is_system;
  const moduleAccess = catalog.filter((permission) => permission.code.startsWith("modules.") && permission.code.endsWith(".access"));
  const actionGroups = catalog.filter((permission) => !permission.code.startsWith("modules.")).reduce<Record<string, Permission[]>>((groups, permission) => {
    (groups[permission.category] ??= []).push(permission);
    return groups;
  }, {});
  const grantedIds = new Set((granted ?? []).map((entry) => entry.permission_id));
  const hasChanges = selectedIds.length !== grantedIds.size || selectedIds.some((id) => !grantedIds.has(id));
  const toggle = (id: string, checked: boolean) => setSelectedIds((current) =>
    checked ? [...new Set([...current, id])] : current.filter((value) => value !== id));
  const save = async () => {
    try {
      await setPermissions.mutateAsync({ roleId, permissionIds: selectedIds });
      toast.success("Role access updated");
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };
  const fields: DetailField[] = [
    { label: "Role name", key: "role_name", value: item.role_name, required: true, editable: !item.is_system },
    { label: "Description", key: "description", value: item.description, type: "textarea", parse: (value) => value || null, editable: !item.is_system },
    { label: "System role", value: item.is_system ? "Yes" : "No" },
  ];

  return <RecordDetailPage title={item.role_name} subtitle="Workspace role" backHref="/roles" backLabel="All roles" fields={fields} canEdit={canEdit} fullWidthChildren onSave={async (key, value) => { await update.mutateAsync({ id: roleId, payload: { [key]: value } as RoleUpdate }); }}>
    {canViewPermissions && <div className="space-y-5">
      {catalogLoading || grantedLoading ? <p className="text-sm text-[#626f86]">Loading role access…</p> : catalogError || grantedError ? <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-destructive">Could not load current grants. Editing is unavailable.</p> : <>
        <section className="rounded-md border border-[#dfe1e6] bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-[#172b4d]">Module access</h2>
          <p className="mb-4 mt-1 text-sm text-[#626f86]">Choose which application modules this role can open. Action permissions below control what it can do inside them.</p>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {moduleAccess.map((permission) => <PermissionOption key={permission.permission_id} permission={permission} checked={selectedIds.includes(permission.permission_id)} disabled={!canChangeGrants || setPermissions.isPending} onChange={(checked) => toggle(permission.permission_id, checked)} />)}
          </div>
        </section>
        <section className="rounded-md border border-[#dfe1e6] bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-[#172b4d]">Action permissions</h2>
          <p className="mb-4 mt-1 text-sm text-[#626f86]">Choose the actions allowed within each module.</p>
          <div className="space-y-5">{Object.entries(actionGroups).map(([category, permissions]) => <div key={category}>
            <h3 className="mb-2 text-sm font-semibold text-[#172b4d]">{category}</h3>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{permissions.map((permission) => <PermissionOption key={permission.permission_id} permission={permission} checked={selectedIds.includes(permission.permission_id)} disabled={!canChangeGrants || setPermissions.isPending} onChange={(checked) => toggle(permission.permission_id, checked)} />)}</div>
          </div>)}</div>
        </section>
        {canChangeGrants && <div className="flex justify-end"><Button disabled={!hasChanges || setPermissions.isPending} onClick={() => void save()}>{setPermissions.isPending ? "Saving…" : "Save role access"}</Button></div>}
        {item.is_system && <p className="text-sm text-[#626f86]">System role access is managed by SprintIX.</p>}
      </>}
    </div>}
  </RecordDetailPage>;
}
