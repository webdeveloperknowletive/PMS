"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Plus, Pencil, Trash2, UserCog, Search, MailPlus, X, XCircle, RefreshCw, ShieldCheck } from "lucide-react";
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
import { UserFormDialog } from "@/components/modules/users/user-form-dialog";
import { UserPermissionsDialog } from "@/components/modules/users/user-permissions-dialog";
import { useUsers } from "@/hooks/queries/use-users";
import { useInviteOrganizationMember, useOrganizationInvitations, useResendOrganizationInvitation, useRevokeOrganizationInvitation } from "@/hooks/queries/use-organizations";
import { useDeleteUser, useToggleUserStatus } from "@/hooks/queries/use-users-admin";
import { useRoles } from "@/hooks/queries/use-roles";
import { formatDate } from "@/lib/utils";
import { getApiErrorMessage } from "@/lib/api/client";
import type { User } from "@/types/user";
import { useAuthStore } from "@/store/auth-store";
import { usePermissions } from "@/hooks/use-permissions";

const ALL = "__all__";
const USER_PAGE_SIZE = 100;
type InviteRow = { id: number; email: string; roleId: string; invitationId?: string; sent?: boolean; error?: string };

export default function UsersPage() {
  const [userPage, setUserPage] = useState(0);
  const { permissionCodes } = usePermissions();
  const can = (code: string) => permissionCodes.includes(code) || (code.startsWith("roles.") && permissionCodes.includes("roles.manage"));
  const { data: users, isLoading } = useUsers({ skip: userPage * USER_PAGE_SIZE, limit: USER_PAGE_SIZE }, can("users.view"));
  const { data: roles } = useRoles(can("roles.view"));
  const toggleStatus = useToggleUserStatus();
  const deleteMutation = useDeleteUser();
  const invitations = useOrganizationInvitations(can("invitations.view"));
  const inviteMutation = useInviteOrganizationMember();
  const resendInvitation = useResendOrganizationInvitation();
  const revokeInvitation = useRevokeOrganizationInvitation();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [permissionsUser, setPermissionsUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [inviteRows, setInviteRows] = useState<InviteRow[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRoleId, setInviteRoleId] = useState("");
  const nextRecipientId = useRef(0);
  const inviteEmailInput = useRef<HTMLInputElement>(null);
  const [sendingInvites, setSendingInvites] = useState(false);
  const currentUser = useAuthStore((s) => s.user);

  const inviteableRoles = (roles ?? []).filter((role) => !role.is_system);

  const handleAddRecipient = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sendingInvites) return;
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !inviteableRoles.some((role) => role.role_id === inviteRoleId)) {
      toast.error("Enter an employee email and choose their role.");
      return;
    }
    if (inviteRows.some((row) => row.email === email)) {
      toast.error("This email is already in the recipient list.");
      return;
    }
    const id = nextRecipientId.current++;
    setInviteRows((rows) => [...rows, { id, email, roleId: inviteRoleId }]);
    setInviteEmail("");
    setInviteRoleId("");
    inviteEmailInput.current?.focus();
  };

  const handleInvite = async () => {
    if (sendingInvites) return;
    if (inviteEmail.trim() || inviteRoleId) {
      toast.error("Click Add for the employee you entered, or clear the fields before sending.");
      return;
    }
    const pending = inviteRows.filter((row) => !row.sent);
    if (!pending.length) return;
    if (pending.some((row) => !row.email.trim() || !inviteableRoles.some((role) => role.role_id === row.roleId))) {
      toast.error("Enter an employee email and choose their role.");
      return;
    }
    const emails = inviteRows.map((row) => row.email.trim().toLowerCase());
    if (new Set(emails).size !== emails.length) {
      toast.error("Each employee email can appear only once. Remove duplicate emails.");
      return;
    }
    setSendingInvites(true);
    let sent = 0;
    try {
      for (const row of pending) {
        try {
          // Retry saved invitations through resend so failed delivery never creates duplicates.
          const result = row.invitationId
            ? await resendInvitation.mutateAsync(row.invitationId)
            : await inviteMutation.mutateAsync({ email: row.email.trim().toLowerCase(), role_id: row.roleId });
          if (result.email_sent) sent += 1;
          setInviteRows((rows) => rows.map((item) => item.id === row.id ? {
            ...item, invitationId: result.invitation_id, sent: Boolean(result.email_sent),
            error: result.email_sent ? undefined : "Email not sent. Check SMTP settings, then retry or use Resend below.",
          } : item));
        } catch (err) {
          setInviteRows((rows) => rows.map((item) => item.id === row.id ? { ...item, error: getApiErrorMessage(err) } : item));
        }
      }
      if (sent) toast.success(`${sent} invitation email${sent === 1 ? "" : "s"} sent.`);
      if (sent < pending.length) toast.error(`${pending.length - sent} invitation${pending.length - sent === 1 ? " needs" : "s need"} attention. Check the messages beside each employee.`);
    } finally {
      // Sent invitations remain in the Invitations list, not in the send queue.
      setInviteRows((rows) => rows.filter((row) => !row.sent));
      setSendingInvites(false);
    }
  };

  const handleRevokeInvitation = async (id: string) => {
    try {
      await revokeInvitation.mutateAsync(id);
      toast.success("Invitation revoked.");
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const handleResendInvitation = async (id: string) => {
    try {
      const result = await resendInvitation.mutateAsync(id);
      setInviteRows((rows) => rows.map((row) => row.invitationId === id ? {
        ...row, sent: Boolean(result.email_sent), error: result.email_sent ? undefined : "Email not sent. Check SMTP settings and retry.",
      } : row).filter((row) => !row.sent));
      if (result.email_sent) toast.success("Invitation email sent. The previous email's invitation is no longer valid.");
      else toast.error("Invitation saved, but email was not sent. Check SMTP settings and retry.");
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const filtered = (users ?? []).filter((u) => {
    const roleNames = u.role_names ?? [];
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

  const showUserResults = (status: string) => {
    setSearch("");
    setStatusFilter(status);
    setUserPage(0);
    requestAnimationFrame(() => document.getElementById("user-results")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  useEffect(() => {
    if (!isLoading && userPage > 0 && users?.length === 0) setUserPage((page) => page - 1);
  }, [isLoading, userPage, users?.length]);

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
      <div className="space-y-6">
        <PageHeader
          title="Users"
          description="Invite employees, assign roles, and manage module and action access"
          actions={can("invitations.create") ?
            <Button onClick={() => document.getElementById("invite-employee")?.scrollIntoView({ behavior: "smooth", block: "center" })}>
              <Plus className="h-4 w-4" />
              Invite User
            </Button> : undefined}
        />

        {can("invitations.create") && <Card id="invite-employee" className="border-blue-100">
          <CardContent className="space-y-4 p-5">
            <div>
              <h2 className="flex items-center gap-2 text-base font-semibold"><MailPlus className="h-4 w-4 text-blue-600" /> Invite employees</h2>
              <p className="mt-1 text-sm text-muted-foreground">Enter an email, select a role, and click Add. Build your recipient list, then send everyone an invitation in one click.</p>
            </div>
            <form onSubmit={handleAddRecipient} className="flex flex-col gap-3 sm:flex-row">
              <Input ref={inviteEmailInput} aria-label="Employee email" type="email" required placeholder="employee@company.com" value={inviteEmail} disabled={sendingInvites} onChange={(event) => setInviteEmail(event.target.value)} className="sm:flex-1" />
              <Select value={inviteRoleId} disabled={sendingInvites} onValueChange={setInviteRoleId}>
                <SelectTrigger aria-label="Employee role" className="sm:w-56"><SelectValue placeholder="Choose a role" /></SelectTrigger>
                <SelectContent>{inviteableRoles.map((role) => <SelectItem key={role.role_id} value={role.role_id}>{role.role_name}</SelectItem>)}</SelectContent>
              </Select>
              <Button type="submit" variant="outline" disabled={sendingInvites}><Plus className="h-4 w-4" /> Add</Button>
            </form>
            <div className="rounded-xl border bg-slate-50/60 p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Recipients ({inviteRows.length})</p>
              {inviteRows.length === 0 ? <p className="text-sm text-muted-foreground">Added employees will appear here with their roles.</p> :
                <ul aria-label="Invitation recipients" className="flex flex-wrap gap-2">
                  {inviteRows.map((row) => <li key={row.id} className={`max-w-full rounded-xl border px-3 py-2 text-sm ${row.error ? "border-red-200 bg-red-50" : row.sent ? "border-green-200 bg-green-50" : "border-violet-200 bg-white"}`}>
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 break-all font-medium">{row.email} <span className="font-normal text-muted-foreground">({roles?.find((role) => role.role_id === row.roleId)?.role_name ?? "Role"})</span></span>
                      <button type="button" aria-label={`Remove ${row.email} from recipients`} disabled={sendingInvites} className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:opacity-50" onClick={() => setInviteRows((rows) => rows.filter((item) => item.id !== row.id))}><X className="h-3.5 w-3.5" /></button>
                    </div>
                    {row.sent && <p role="status" className="mt-1 text-xs text-green-700">Email sent</p>}
                    {row.error && <p role="alert" className="mt-1 max-w-sm text-xs text-destructive">{row.error}</p>}
                  </li>)}
                </ul>}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p aria-live="polite" className="text-sm text-muted-foreground">{inviteRows.filter((row) => !row.sent).length} ready to send</p>
              <Button type="button" onClick={handleInvite} disabled={sendingInvites || inviteRows.every((row) => row.sent)}><MailPlus className="h-4 w-4" /> {sendingInvites ? "Sending invitations…" : "Send all invitations"}</Button>
            </div>
          </CardContent>
        </Card>}

        {can("invitations.view") && <Card>
          <CardContent className="p-5">
            <div className="mb-3 flex items-center justify-between"><div><h2 className="font-semibold">Invitations</h2><p className="text-sm text-muted-foreground">Invited people have access after they accept.</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold">{invitations.data?.filter((item) => !item.accepted_at && !item.revoked_at && new Date(item.expires_at).getTime() > Date.now()).length ?? 0} pending</span></div>
            {invitations.isLoading ? <p className="py-4 text-sm text-muted-foreground">Loading invitations…</p> : (invitations.data ?? []).length === 0 ? <p className="py-4 text-sm text-muted-foreground">No invitations yet.</p> : <div className="space-y-2">{(invitations.data ?? []).map((item) => {
              const roleName = roles?.find((role) => role.role_id === item.role_id)?.role_name ?? "Role";
              const expired = !item.accepted_at && !item.revoked_at && new Date(item.expires_at).getTime() <= Date.now();
              const statusLabel = item.accepted_at ? "Accepted" : item.revoked_at ? "Revoked" : expired ? "Expired" : "Pending";
              return <div key={item.invitation_id} className="flex flex-col gap-2 rounded-lg border px-3 py-2.5 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.email} <span className="font-normal text-slate-500">({roleName})</span></p><p className="text-xs text-muted-foreground">{statusLabel} · expires {formatDate(item.expires_at)}</p></div>
                {(statusLabel === "Pending" || statusLabel === "Expired") && <>
                  {can("invitations.resend") && <Button size="sm" variant="outline" onClick={() => handleResendInvitation(item.invitation_id)} disabled={sendingInvites || resendInvitation.isPending}><RefreshCw className="h-3.5 w-3.5" /> Resend</Button>}
                  {can("invitations.delete") && statusLabel === "Pending" && <Button size="sm" variant="ghost" onClick={() => handleRevokeInvitation(item.invitation_id)} disabled={sendingInvites || revokeInvitation.isPending}><XCircle className="h-4 w-4" /> Revoke</Button>}
                </>}
              </div>;
            })}</div>}
          </CardContent>
        </Card>}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <button type="button" onClick={() => showUserResults(ALL)} className="metric-card rounded-2xl border border-border bg-card text-left transition hover:border-violet-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
            <div className="p-4">
              <p className="text-xs text-muted-foreground">Users on this page</p>
              <p className="mt-1 text-2xl font-semibold">{total}</p>
            </div>
          </button>
          <button type="button" onClick={() => showUserResults("ACTIVE")} className="metric-card rounded-2xl border border-border bg-card text-left transition hover:border-violet-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
            <div className="p-4">
              <p className="text-xs text-muted-foreground">Active on page</p>
              <p className="mt-1 text-2xl font-semibold text-green-600">{active}</p>
            </div>
          </button>
          <button type="button" onClick={() => showUserResults("INACTIVE")} className="metric-card rounded-2xl border border-border bg-card text-left transition hover:border-violet-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
            <div className="p-4">
              <p className="text-xs text-muted-foreground">Inactive on page</p>
              <p className="mt-1 text-2xl font-semibold text-red-500">{inactive}</p>
            </div>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search this page by name or email..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setUserPage(0); }} />
          </div>
          <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setUserPage(0); }}>
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

        <Card id="user-results" className="scroll-mt-6">
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
                  <TableHead className="w-36">Access</TableHead>
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
                            {u.name} ({u.role_names?.join(", ") || "No post assigned"})
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
                          disabled={!can("users.status.update") || u.user_id === currentUser?.user_id}
                        />
                        <span className="text-xs text-muted-foreground">
                          {u.is_active ? "Active" : "Inactive"}
                          {u.user_id === currentUser?.user_id && " (you)"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(u.created_at)}</TableCell>
                    <TableCell>
                      <div className="flex flex-nowrap items-center gap-1">
                        {(can("users.permissions.view") || can("users.permissions.update")) && <Button variant="outline" size="sm" className="h-8 gap-1.5 px-2" aria-label={`Manage permissions for ${u.name}`} title="Manage direct permissions" onClick={() => setPermissionsUser(u)}><ShieldCheck className="h-4 w-4" /><span className="hidden xl:inline">Access</span></Button>}
                        {can("users.update") && <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Edit user" title="Edit user" onClick={() => openEdit(u)}><Pencil className="h-4 w-4" /></Button>}
                        {can("users.delete") && u.user_id !== currentUser?.user_id && <Button variant="outline" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" aria-label="Delete user" title="Delete user" onClick={() => setDeletingUser(u)}><Trash2 className="h-4 w-4" /></Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Page {userPage + 1} · Showing {users?.length ?? 0} employees</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setUserPage((page) => Math.max(0, page - 1))} disabled={userPage === 0 || isLoading}>Previous</Button>
            <Button variant="outline" size="sm" onClick={() => setUserPage((page) => page + 1)} disabled={isLoading || (users?.length ?? 0) < USER_PAGE_SIZE}>Next</Button>
          </div>
        </div>

        <UserFormDialog open={formOpen} onOpenChange={setFormOpen} user={editingUser} />
        <UserPermissionsDialog
          open={!!permissionsUser}
          onOpenChange={(open) => !open && setPermissionsUser(null)}
          user={permissionsUser}
          canUpdate={can("users.permissions.update")}
        />

        <ConfirmDialog
          open={!!deletingUser}
          onOpenChange={(open) => !open && setDeletingUser(null)}
          title="Delete user?"
          description={`This will permanently delete "${deletingUser?.name}". If they lead any team, deletion will fail until reassigned (a real DB constraint).`}
          onConfirm={confirmDelete}
          isLoading={deleteMutation.isPending}
        />
      </div>
  );
}
