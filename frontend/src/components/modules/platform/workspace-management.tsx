"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Pencil, PauseCircle, PlayCircle, Trash2, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { platformApi, type PlatformOrganizationDetail } from "@/lib/api/platform";
import { getApiErrorMessage } from "@/lib/api/client";

function WorkspaceFields({ name, slug, setName, setSlug }: { name: string; slug: string; setName: (value: string) => void; setSlug: (value: string) => void }) {
  return <>
    <div className="space-y-2"><Label htmlFor="workspace-name">Client / workspace name</Label><Input id="workspace-name" value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={180} /></div>
    <div className="space-y-2"><Label htmlFor="workspace-slug">Workspace address</Label><Input id="workspace-slug" value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase())} required minLength={3} maxLength={63} pattern="[a-z0-9][a-z0-9-]*[a-z0-9]" placeholder="acme-services" /><p className="text-xs text-muted-foreground">Use lowercase letters, numbers and hyphens.</p></div>
  </>;
}

function useRefreshPlatform() {
  const queryClient = useQueryClient();
  return async (id?: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["platform-organizations"] }),
      queryClient.invalidateQueries({ queryKey: ["platform-overview"] }),
      queryClient.invalidateQueries({ queryKey: ["platform-subscriptions"] }),
      queryClient.invalidateQueries({ queryKey: ["platform-users"] }),
      ...(id ? [queryClient.invalidateQueries({ queryKey: ["platform-organization", id] })] : []),
    ]);
  };
}

export function CreateWorkspaceButton() {
  const router = useRouter();
  const refresh = useRefreshPlatform();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      const result = await platformApi.createOrganization({ name: name.trim(), slug, owner_email: email.trim() });
      setOpen(false);
      if (result.email_sent) toast.success("Workspace created. Owner setup email sent.");
      else toast.warning("Workspace created, but the setup email was not delivered. Use Resend owner setup on the workspace page.");
      await refresh();
      router.push(`/platform/organizations/${result.organization_id}`);
    } catch (cause) { setError(getApiErrorMessage(cause)); }
    finally { setBusy(false); }
  };
  return <>
    <Button onClick={() => { setError(""); setOpen(true); }}><Plus className="h-4 w-4" />Create workspace</Button>
    <Dialog open={open} onOpenChange={(value) => { if (!busy) setOpen(value); }}><DialogContent><DialogHeader><DialogTitle>Create client workspace</DialogTitle><DialogDescription>The owner receives a private setup link to choose their password and accept the terms. No password is shared with the administrator.</DialogDescription></DialogHeader>
      <form className="space-y-4" onSubmit={submit}>
        <WorkspaceFields name={name} slug={slug} setName={setName} setSlug={setSlug} />
        <div className="space-y-2"><Label htmlFor="owner-email">Owner email</Label><Input id="owner-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="off" /></div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button><Button disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Create and send setup email</Button></div>
      </form>
    </DialogContent></Dialog>
  </>;
}

export function WorkspaceActions({ workspace }: { workspace: PlatformOrganizationDetail }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const refresh = useRefreshPlatform();
  const [action, setAction] = useState<"edit" | "status" | "delete" | "resend" | null>(null);
  const [name, setName] = useState(workspace.name);
  const [slug, setSlug] = useState(workspace.slug);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const suspended = workspace.status === "SUSPENDED";
  const begin = (next: typeof action) => {
    setError(""); setConfirmation(""); setName(workspace.name); setSlug(workspace.slug); setAction(next);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !action) return;
    setBusy(true); setError("");
    try {
      if (action === "edit") await platformApi.updateOrganization(workspace.organization_id, { name: name.trim(), slug });
      if (action === "status") await platformApi.setOrganizationStatus(workspace.organization_id, suspended ? "ACTIVE" : "SUSPENDED");
      if (action === "resend") {
        const result = await platformApi.resendOwnerSetup(workspace.organization_id);
        if (!result.email_sent) throw new Error("Setup email could not be delivered. Check email delivery and try again.");
      }
      if (action === "delete") {
        await platformApi.deleteOrganization(workspace.organization_id, confirmation);
        queryClient.removeQueries({ queryKey: ["platform-organization", workspace.organization_id] });
        router.replace("/platform");
        await refresh();
        toast.success("Workspace deleted.");
      } else {
        await refresh(workspace.organization_id);
        toast.success(action === "edit" ? "Workspace updated." : action === "resend" ? "Owner setup email sent." : suspended ? "Workspace reactivated." : "Workspace suspended. Access is blocked.");
      }
      setAction(null);
    } catch (cause) { setError(cause instanceof Error && !('response' in cause) ? cause.message : getApiErrorMessage(cause)); }
    finally { setBusy(false); }
  };
  const title = action === "edit" ? "Edit workspace" : action === "delete" ? "Permanently delete workspace" : action === "resend" ? "Resend owner setup" : suspended ? "Reactivate workspace" : "Suspend workspace";
  return <>
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" onClick={() => begin("edit")}><Pencil className="h-4 w-4" />Edit</Button>
      <Button size="sm" variant="outline" onClick={() => begin("status")}>{suspended ? <PlayCircle className="h-4 w-4" /> : <PauseCircle className="h-4 w-4" />}{suspended ? "Reactivate" : "Suspend"}</Button>
      {workspace.owner_setup_pending && <Button size="sm" variant="outline" disabled={suspended} onClick={() => begin("resend")}><Mail className="h-4 w-4" />Resend owner setup</Button>}
      <Button size="sm" variant="destructive" onClick={() => begin("delete")}><Trash2 className="h-4 w-4" />Delete</Button>
    </div>
    <Dialog open={action !== null} onOpenChange={(open) => { if (!open && !busy) setAction(null); }}><DialogContent><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{action === "edit" ? "Update client details. Changing the workspace address changes its login hostname; existing bookmarks may stop working." : action === "delete" ? `Permanently removes ${workspace.name}, its users, projects, tasks and workspace history. This cannot be undone.` : action === "resend" ? `Send a new setup email to ${workspace.owner?.email ?? "the owner"}. Previous setup links will stop working.` : suspended ? "Restore access for this workspace. Individual inactive accounts remain inactive." : "Block sign-in and further API access for all users of this workspace. Workspace data is preserved."}</DialogDescription></DialogHeader>
      <form className="space-y-4" onSubmit={submit}>
        {action === "edit" && <WorkspaceFields name={name} slug={slug} setName={setName} setSlug={setSlug} />}
        {action === "delete" && <>
          {!suspended && <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">Suspend the workspace before deleting it.</p>}
          <div className="space-y-2"><Label htmlFor="confirm-workspace">Type {workspace.slug} to confirm</Label><Input id="confirm-workspace" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" required /></div>
        </>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => setAction(null)}>Cancel</Button><Button variant={action === "delete" ? "destructive" : "default"} disabled={busy || (action === "delete" && (!suspended || confirmation !== workspace.slug))}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}{title}</Button></div>
      </form>
    </DialogContent></Dialog>
  </>;
}
