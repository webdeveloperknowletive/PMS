"use client";

import { useEffect } from "react";
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
import { useCreateRole, useUpdateRole } from "@/hooks/queries/use-roles";
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
  const isSaving = createMutation.isPending || updateMutation.isPending;

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

  const onSubmit = async (values: FormValues) => {
    const payload = { ...values, description: values.description || null };
    try {
      if (isEditing && role) {
        await updateMutation.mutateAsync({ id: role.role_id, payload });
        toast.success("Role updated");
      } else {
        await createMutation.mutateAsync(payload);
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
            {isEditing ? "Update this role's name and description." : "Add a new role users can be assigned."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="role_name">Role name</Label>
            <Input id="role_name" placeholder="e.g. Project Manager" {...register("role_name")} />
            {errors.role_name && <p className="text-xs text-destructive">{errors.role_name.message}</p>}
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