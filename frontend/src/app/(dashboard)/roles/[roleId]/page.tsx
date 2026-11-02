"use client";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { RecordDetailPage, type DetailField } from "@/components/shared/record-detail-page";
import { usePermissionCatalog, useRolePermissions, useRoles, useSetRolePermissions, useUpdateRole } from "@/hooks/queries/use-roles";
import { usePermissions } from "@/hooks/use-permissions";
import { getApiErrorMessage } from "@/lib/api/client";
import { Pencil } from "lucide-react";
import type { RoleUpdate } from "@/types/role";
export default function RoleDetailPage() {
  const { roleId } = useParams<{ roleId: string }>();
  const { permissionCodes } = usePermissions();
  const canManagePermissions = permissionCodes.includes("roles.manage") || permissionCodes.includes("roles.permissions.update");
  const canViewPermissions = canManagePermissions || permissionCodes.includes("roles.permissions.view");
  const { data = [], isLoading } = useRoles();
  const { data: catalog = [], isLoading: catalogLoading, isError: catalogError } = usePermissionCatalog(canViewPermissions);
  const { data: granted = [], isLoading: grantedLoading, isError: grantedError } = useRolePermissions(roleId, canViewPermissions);
  const update = useUpdateRole();
  const setPermissions = useSetRolePermissions();
  const item = data.find((entry) => entry.role_id === roleId);
  if (isLoading) return <p>Loading role…</p>;
  if (!item) return <p>Role unavailable.</p>;
  const canEdit = permissionCodes.includes("roles.manage") || permissionCodes.includes("roles.update");
  const grantedIds = new Set(granted.map((entry) => entry.permission_id));
  const fields: DetailField[] = [
    { label: "Role name", key: "role_name", value: item.role_name, required: true, editable: !item.is_system },
    { label: "Description", key: "description", value: item.description, type: "textarea", parse: (value) => value || null, editable: !item.is_system },
    { label: "System role", value: item.is_system ? "Yes" : "No" },
  ];
  return <RecordDetailPage title={item.role_name} subtitle="Workspace role" backHref="/roles" backLabel="All roles" fields={fields} canEdit={canEdit} onSave={async (key, value) => { await update.mutateAsync({ id: roleId, payload: { [key]: value } as RoleUpdate }); }}>
    {canViewPermissions && <section className="rounded-md border border-[#dfe1e6] bg-white p-5 shadow-sm"><h2 className="mb-3 font-semibold">Permissions</h2>{catalogLoading || grantedLoading ? <p className="text-sm text-[#626f86]">Loading permissions…</p> : catalogError || grantedError ? <p role="alert" className="text-sm text-destructive">Could not load current permissions. Editing is unavailable.</p> : <div className="max-h-[60vh] space-y-2 overflow-y-auto">{catalog.map((permission) => <label key={permission.permission_id} className="group/permission flex items-start gap-2 rounded p-1 text-xs hover:bg-[#f1f2f4]"><input type="checkbox" className="mt-0.5" checked={grantedIds.has(permission.permission_id)} disabled={!canManagePermissions || item.is_system || setPermissions.isPending} onChange={(event) => { const next = event.target.checked ? [...grantedIds, permission.permission_id] : [...grantedIds].filter((id) => id !== permission.permission_id); void setPermissions.mutateAsync({ roleId, permissionIds: next }).then(() => toast.success("Permissions updated")).catch((error) => toast.error(getApiErrorMessage(error))); }} /><span className="flex-1"><strong>{permission.name}</strong><br /><span className="text-[#626f86]">{permission.description}</span></span>{canManagePermissions && !item.is_system && <Pencil className="h-3.5 w-3.5 text-[#626f86] opacity-0 group-hover/permission:opacity-100" />}</label>)}</div>}</section>}
  </RecordDetailPage>;
}
