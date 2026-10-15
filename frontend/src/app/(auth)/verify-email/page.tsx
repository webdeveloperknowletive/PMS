"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authApi } from "@/lib/api/auth";
import { getApiErrorMessage } from "@/lib/api/client";

export default function VerifyEmailPage() {
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState("");

  const verify = async () => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setError("This verification link is missing its token.");
      return;
    }
    setWorking(true);
    setError("");
    try {
      await authApi.verifyEmail({ token });
      setVerified(true);
    } catch (cause) {
      setError(getApiErrorMessage(cause));
    } finally {
      setWorking(false);
    }
  };

  return (
    <Card className="mx-auto max-w-md border-slate-200 bg-white shadow-xl shadow-slate-900/5">
      <CardHeader className="items-center text-center">
        <span className="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">{verified ? <CheckCircle2 className="h-7 w-7" /> : <MailCheck className="h-7 w-7" />}</span>
        <CardTitle>{verified ? "Email verified" : "Verify your email"}</CardTitle>
        <CardDescription>{verified ? "Your SprintIX workspace account is ready." : "Confirm your email address to activate your workspace owner account."}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        {verified ? <Button className="w-full" onClick={() => {
          const workspaceSlug = new URLSearchParams(window.location.search).get("workspace_slug");
          router.push(workspaceSlug ? `/login?workspace_slug=${encodeURIComponent(workspaceSlug)}` : "/login");
        }}>Continue to sign in</Button> : <Button className="w-full" onClick={verify} disabled={working}>{working ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Verify email</Button>}
        {!verified && <Button asChild variant="outline" className="w-full"><Link href="/login">Back to sign in</Link></Button>}
      </CardContent>
    </Card>
  );
}
