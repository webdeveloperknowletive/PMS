"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCreateRole, usePermissionCatalog, useRolePermissions, useSetRolePermissions, useUpdateRole } from "@/hooks/queries/use-roles";
import { getApiErrorMessage } from "@/lib/api/client";
import type { Role } from "@/types/role";

const schema = z.object({
  role_name: z.string().min(2, "Role name is required"),
  description: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export function RoleFormDialog({
  open,
  onOpenChange,
  role,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role?: Role | null;
}) {
  const isEditing = !!role;
  const createMutation = useCreateRole();
  const updateMutation = useUpdateRole();
  const permissionsMutation = useSetRolePermissions();
  const { data: catalog = [] } = usePermissionCatalog();
  const { data: assignedPermissions = [] } = useRolePermissions(role?.role_id);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([]);
  const groupedPermissions = useMemo(() => catalog.reduce<Record<string, typeof catalog>>((groups, permission) => {
    (groups[permission.category] ??= []).push(permission);
    return groups;
  }, {}), [catalog]);
  const isSaving = createMutation.isPending || updateMutation.isPending || permissionsMutation.isPending;

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { role_name: "", description: "" },
  });

  useEffect(() => {
    if (open) {
      reset(role ? { role_name: role.role_name, description: role.description ?? "" } : { role_name: "", description: "" });
    }
  }, [open, role, reset]);

  useEffect(() => {
    if (open) setSelectedPermissionIds(assignedPermissions.map((permission) => permission.permission_id));
  }, [open, assignedPermissions]);

  const onSubmit = async (values: FormValues) => {
    const payload = { ...values, description: values.description || null };
    try {
      if (isEditing && role) {
        await updateMutation.mutateAsync({ id: role.role_id, payload });
        await permissionsMutation.mutateAsync({ roleId: role.role_id, permissionIds: selectedPermissionIds });
        toast.success("Role updated");
      } else {
        const createdRole = await createMutation.mutateAsync(payload);
        await permissionsMutation.mutateAsync({ roleId: createdRole.role_id, permissionIds: selectedPermissionIds });
        toast.success("Role created");
      }
      onOpenChange(false);
    } catch (err) {
      setError("root", { message: getApiErrorMessage(err) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Role" : "Create Role"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update the role details and choose what members can do." : "Create a role and choose what members can do."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="role_name">Role name</Label>
            <Input id="role_name" placeholder="e.g. Product operations" {...register("role_name")} />
            {errors.role_name && <p className="text-xs text-destructive">{errors.role_name.message}</p>}
          </div>

          <div className="space-y-2">
            <div>
              <Label>Permissions</Label>
              <p className="text-xs text-muted-foreground">Choose which actions people with this role can use.</p>
            </div>
            <div className="max-h-64 space-y-4 overflow-y-auto rounded-md border p-3">
              {Object.entries(groupedPermissions).map(([category, permissions]) => (
                <section key={category} className="space-y-2">
                  <h4 className="text-sm font-medium">{category}</h4>
                  {permissions.map((permission) => (
                    <label key={permission.permission_id} className="flex cursor-pointer items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={selectedPermissionIds.includes(permission.permission_id)}
                        onChange={(event) => setSelectedPermissionIds((current) => event.target.checked
                          ? [...current, permission.permission_id]
                          : current.filter((id) => id !== permission.permission_id))}
                      />
                      <span><span className="font-medium">{permission.name}</span><span className="block text-xs text-muted-foreground">{permission.description}</span></span>
                    </label>
                  ))}
                </section>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" placeholder="What can users with this role do?" {...register("description")} />
          </div>

          {errors.root && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{errors.root.message}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEditing ? "Save changes" : "Create role"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
