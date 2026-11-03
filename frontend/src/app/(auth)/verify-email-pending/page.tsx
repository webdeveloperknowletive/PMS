"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authApi } from "@/lib/api/auth";

export default function VerifyEmailPendingPage() {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [workspaceSlug, setWorkspaceSlug] = useState("");
  const [sent, setSent] = useState(false);
  const [resending, setResending] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setEmail(params.get("email") ?? "");
    setToken(params.get("token") ?? "");
    setWorkspaceSlug(params.get("workspace_slug") ?? "");
    setSent(params.get("sent") === "1");
    if (params.get("sent") === "1") {
      setNotice("Check your inbox for the verification link. You can request another email below.");
    }
  }, []);

  const resend = async () => {
    if (!email || resending) return;
    setResending(true);
    setNotice("");
    try {
      const result = await authApi.resendVerification(email);
      setSent(true);
      if (result.verification_url) {
        const verificationUrl = new URL(result.verification_url);
        setToken(verificationUrl.searchParams.get("token") ?? "");
        setWorkspaceSlug(verificationUrl.searchParams.get("workspace_slug") ?? "");
      }
      setNotice("If that account needs verification, a new link has been requested. Check your inbox; requests are limited to once per minute.");
    } catch {
      setNotice("We could not send the email. Check your address or contact your workspace administrator.");
    } finally {
      setResending(false);
    }
  };

  const verificationParams = new URLSearchParams();
  if (token) verificationParams.set("token", token);
  if (workspaceSlug) verificationParams.set("workspace_slug", workspaceSlug);

  return (
    <Card className="mx-auto max-w-lg border-slate-200 bg-white shadow-xl shadow-slate-900/5">
      <CardHeader className="items-center text-center">
        <span className="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><MailCheck className="h-7 w-7" /></span>
        <CardTitle>{sent ? "Check your email" : "Verify your email"}</CardTitle>
        <CardDescription>
          Verify your email before signing in. Enter the address you registered with to request a new link.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-center">
        {notice && <p role="status" className="text-sm text-slate-600">{notice}</p>}
        {token && <Button asChild className="w-full"><Link href={`/verify-email?${verificationParams.toString()}`}>Continue to email verification</Link></Button>}
        <form className="space-y-3 text-left" onSubmit={(event) => {
          event.preventDefault();
          void resend();
        }}>
          <div className="space-y-1.5">
            <Label htmlFor="verification-email">Email address</Label>
            <Input id="verification-email" required type="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={resending || !email.trim()}>
            {resending && <Loader2 className="h-4 w-4 animate-spin" />}
            Resend verification email
          </Button>
        </form>
        <p className="text-sm text-muted-foreground">Open the newest verification email, confirm your address, then return to sign in. Older links may no longer work.</p>
        <Button asChild variant="outline" className="w-full"><Link href={workspaceSlug ? `/login?workspace_slug=${encodeURIComponent(workspaceSlug)}` : "/login"}>Go to sign in</Link></Button>
      </CardContent>
    </Card>
  );
}
