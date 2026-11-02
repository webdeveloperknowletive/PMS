"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { InlineDetailField } from "@/components/shared/inline-detail-field";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { useUser } from "@/hooks/queries/use-users";
import { useToggleUserStatus, useUpdateUserProfile } from "@/hooks/queries/use-users-admin";
import { usePermissions } from "@/hooks/use-permissions";

export default function UserProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const { data: user, isLoading, isError } = useUser(userId);
  const { permissionCodes } = usePermissions();
  const update = useUpdateUserProfile();
  const toggleStatus = useToggleUserStatus();
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading user…</p>;
  if (isError || !user) return <p className="text-sm text-destructive">This user is unavailable.</p>;
  const canEdit = permissionCodes.includes("users.update") || permissionCodes.includes("roles.manage");
  const canAccess = permissionCodes.includes("users.permissions.view") || permissionCodes.includes("users.permissions.update") || permissionCodes.includes("roles.manage");
  const save = async (payload: { name?: string; email?: string }) => {
    await update.mutateAsync({ userId, payload });
    toast.success("User updated");
  };
  return <div className="space-y-6">
    <PageHeader title={user.name} description="Workspace user profile" showHome={false} actions={<>{canAccess && <Button asChild variant="outline" size="sm"><Link href={"/users/" + userId + "/permissions"}>Access and roles</Link></Button>}<Button asChild variant="outline" size="sm"><Link href="/users">All users</Link></Button></>} />
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
      <section className="rounded-md border border-[#dfe1e6] bg-white p-5 shadow-sm">
        <div className="mb-6 flex items-center gap-4"><UserAvatar user={user} showName={false} size="lg" /><div><h2 className="font-semibold text-[#172b4d]">{user.name}</h2><p className="text-sm text-[#626f86]">{user.role_names?.join(", ") || "No role assigned"}</p></div></div>
        <div className="grid gap-5 sm:grid-cols-2">
          <InlineDetailField label="Full name" value={user.name} canEdit={canEdit} required validate={(value) => value.length < 2 ? "Use at least 2 characters" : value.length > 150 ? "Use 150 characters or fewer" : undefined} onSave={(value) => save({ name: value })} />
          <InlineDetailField label="Email" value={user.email} canEdit={canEdit} type="email" required validate={(value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? undefined : "Enter a valid email"} onSave={(value) => save({ email: value })} />
          <InlineDetailField label="Status" value={user.is_active ? "active" : "inactive"} canEdit={canEdit} type="select" options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} display={user.is_active ? "Active" : "Inactive"} onSave={async (value) => { await toggleStatus.mutateAsync({ userId, is_active: value === "active" }); toast.success("User status updated"); }} />
          <div><p className="mb-1 text-xs font-medium text-[#626f86]">Roles and permissions</p><Link href={"/users/" + userId + "/permissions"} className="px-2 text-sm text-[#0c66e4] hover:underline">View access details</Link></div>
        </div>
      </section>
      <aside className="h-fit rounded-md border border-[#dfe1e6] bg-white p-5 text-xs text-[#626f86] shadow-sm"><p>Created {new Date(user.created_at).toLocaleString()}</p><p className="mt-2">Updated {new Date(user.updated_at).toLocaleString()}</p></aside>
    </div>
  </div>;
}
