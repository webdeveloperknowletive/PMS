"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { organizationsApi } from "@/lib/api/organizations";
import { getApiErrorMessage } from "@/lib/api/client";
import { WORKSPACE_DOMAIN } from "@/lib/constants";

export default function AcceptInvitationPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [workspaceSlug, setWorkspaceSlug] = useState("");
  const [inviteDetails, setInviteDetails] = useState<{ organization_name: string; organization_slug: string; email: string; role_name: string } | null>(null);
  useEffect(() => {
    const inviteToken = new URLSearchParams(window.location.search).get("token") ?? "";
    setWorkspaceSlug(new URLSearchParams(window.location.search).get("workspace_slug") ?? "");
    setToken(inviteToken);
    if (inviteToken) {
      organizationsApi.previewInvitation(inviteToken)
        .then(setInviteDetails)
        .catch((cause) => setError(getApiErrorMessage(cause)));
    }
  }, []);

  const accept = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (name.trim().length < 2) {
      setError("Enter a name with at least 2 characters.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setWorking(true);
    try {
      await organizationsApi.acceptInvitation({ token, name: name.trim(), password, accepted_terms: acceptedTerms });
      if (inviteDetails && !WORKSPACE_DOMAIN.includes("localhost")) {
        window.location.assign(`https://${inviteDetails.organization_slug}.${WORKSPACE_DOMAIN}/login?invited=1`);
        return;
      }
      const loginParams = new URLSearchParams({ invited: "1" });
      if (inviteDetails?.organization_slug) loginParams.set("workspace_slug", inviteDetails.organization_slug);
      router.push(`/login?${loginParams.toString()}`);
    } catch (cause) {
      setError(getApiErrorMessage(cause));
    } finally {
      setWorking(false);
    }
  };
  const errorText = error.toLowerCase();
  const invitationAccepted = errorText.includes("already accepted");
  const invitationExpiredOrRevoked = errorText.includes("expired") || errorText.includes("revoked");
  const signInHref = workspaceSlug ? `/login?workspace_slug=${encodeURIComponent(workspaceSlug)}` : "/login";

  return (
    <Card className="mx-auto max-w-md border-slate-200 bg-white shadow-xl shadow-slate-900/5">
      <CardHeader className="items-center text-center">
        <span className="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-700"><UsersRound className="h-7 w-7" /></span>
        <CardTitle>Join the workspace</CardTitle>
        <CardDescription>Set up your account to join the organization.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={accept} className="space-y-4">
          {!token && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">The invitation link is missing its token.</p>}
          {inviteDetails && <div className="rounded-lg border border-violet-100 bg-violet-50 p-3 text-sm"><p className="font-semibold text-slate-900">{inviteDetails.organization_name}</p><p className="mt-1 text-slate-600">Joining as <strong>{inviteDetails.role_name}</strong></p><p className="text-slate-600">Invited email: {inviteDetails.email}</p></div>}
          <div className="space-y-1.5"><Label htmlFor="invite-name">Full name</Label><Input id="invite-name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={150} /></div>
          <div className="space-y-1.5"><Label htmlFor="invite-password">Create password</Label><Input id="invite-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} /></div>
          <div className="space-y-1.5"><Label htmlFor="invite-confirm-password">Re-enter password</Label><Input id="invite-confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={8} aria-invalid={!!confirmPassword && password !== confirmPassword} />{confirmPassword && password !== confirmPassword && <p className="text-xs text-destructive">Passwords do not match.</p>}</div>
          <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-600"><input type="checkbox" className="mt-1 accent-blue-600" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} required /><span>I agree to the <Link href="/terms" className="font-medium text-blue-700 hover:underline">Terms of Service</Link>.</span></label>
          {error && <div role="alert" className="space-y-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"><p>{error}</p>{invitationAccepted && <Button asChild variant="outline" className="border-destructive/20 bg-white text-foreground"><Link href={signInHref}>Go to workspace sign in</Link></Button>}{invitationExpiredOrRevoked && <p className="text-xs">Ask the workspace owner to resend the invitation. Resending creates a fresh link and invalidates older links.</p>}</div>}
          <Button type="submit" className="w-full" disabled={!token || !inviteDetails || !acceptedTerms || working}>{working && <Loader2 className="h-4 w-4 animate-spin" />}Accept invitation</Button>
          <p className="text-center text-xs text-muted-foreground">This invitation creates a new SprintIX account for the invited email address.</p>
        </form>
      </CardContent>
    </Card>
  );
}
