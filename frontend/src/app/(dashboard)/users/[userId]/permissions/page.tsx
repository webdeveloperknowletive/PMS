"use client";

import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { UserPermissionsDialog } from "@/components/modules/users/user-permissions-dialog";
import { useUser } from "@/hooks/queries/use-users";
import { usePermissions } from "@/hooks/use-permissions";

export default function UserPermissionsPage() {
  const { userId } = useParams<{ userId: string }>();
  const router = useRouter();
  const { data: user, isLoading, isError } = useUser(userId);
  const { permissionCodes } = usePermissions();
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading user…</p>;
  if (isError || !user) return <p className="text-sm text-destructive">This user is unavailable.</p>;
  const canView = permissionCodes.includes("users.permissions.view") || permissionCodes.includes("users.permissions.update") || permissionCodes.includes("roles.manage");
  if (!canView) return <p className="text-sm text-destructive">You cannot view this user’s permissions.</p>;
  return <div className="space-y-6"><PageHeader title={`${user.name} · Access`} description="Direct module and action permissions" showHome={false} /><UserPermissionsDialog page open user={user} canUpdate={permissionCodes.includes("users.permissions.update") || permissionCodes.includes("roles.manage")} onOpenChange={() => router.push(`/users/${userId}`)} /></div>;
}
