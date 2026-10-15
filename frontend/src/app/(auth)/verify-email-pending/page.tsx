"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  }, []);

  const resend = async () => {
    if (!email || resending) return;
    setResending(true);
    setNotice("");
    try {
      const result = await authApi.resendVerification(email);
      setSent(result.email_sent);
      if (result.verification_url) {
        const verificationUrl = new URL(result.verification_url);
        setToken(verificationUrl.searchParams.get("token") ?? "");
        setWorkspaceSlug(verificationUrl.searchParams.get("workspace_slug") ?? "");
      }
      setNotice(result.email_sent ? "A new link has been sent." : "Email was not sent. In local development, use the verification link below.");
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
        <CardTitle>Check your email</CardTitle>
        <CardDescription>
          {sent ? "We sent a verification link" : "Your workspace is created. Email delivery is not configured yet."}
          {email ? <> for <strong className="text-slate-800">{email}</strong>.</> : "."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-center">
        {notice && <p className="text-sm text-slate-600">{notice}</p>}
        {token && <Button asChild className="w-full"><Link href={`/verify-email?${verificationParams.toString()}`}>Continue to email verification</Link></Button>}
        {!sent && !token && <p className="text-sm text-amber-700">Ask the site administrator to configure email delivery, then request a new verification message.</p>}
        {email && <Button variant="outline" className="w-full" onClick={resend} disabled={resending}>{resending && <Loader2 className="h-4 w-4 animate-spin" />}Resend verification email</Button>}
        <Button asChild variant="outline" className="w-full"><Link href="/login">Go to sign in</Link></Button>
      </CardContent>
    </Card>
  );
}
