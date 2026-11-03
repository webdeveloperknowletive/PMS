"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authApi } from "@/lib/api/auth";
import axios from "axios";
import { Input } from "@/components/ui/input";

export default function VerifyEmailPage() {
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("Verify your email");
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState("");
  const [resending, setResending] = useState(false);
  const started = useRef(false);
  const [loginPath, setLoginPath] = useState("/login");

  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get("workspace_slug");
    if (!new URLSearchParams(window.location.search).get("token")) {
      setTitle("Invalid verification link");
      setError("This verification link is missing its token. Request a new email below.");
    }
    if (slug) setLoginPath(`/login?workspace_slug=${encodeURIComponent(slug)}`);
    // Do not consume tokens on page load: mail scanners may open links.
    document.querySelector('meta[name="referrer"]')?.setAttribute("content", "no-referrer");
  }, []);

  const resend = async () => {
    setResending(true);
    try {
      await authApi.resendVerification(email);
      setNotice("If that account needs verification, a new link has been requested. Please check your inbox.");
    } catch {
      setNotice("We could not request a new email. Please try again later.");
    } finally { setResending(false); }
  };

  const verify = async () => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setError("This verification link is missing its token.");
      return;
    }
    if (started.current) return;
    started.current = true;
    setTitle("Verifying email...");
    setWorking(true);
    setError("");
    try {
      const workspace_slug = new URLSearchParams(window.location.search).get("workspace_slug") ?? undefined;
      const result = await authApi.verifyEmail({ token, workspace_slug });
      setTitle(result.message === "Email already verified." ? "Email already verified" : "Email verified");
      window.history.replaceState(null, "", workspace_slug ? `/verify-email?workspace_slug=${encodeURIComponent(workspace_slug)}` : "/verify-email");
      setVerified(true);
    } catch (cause) {
      const status = axios.isAxiosError(cause) ? cause.response?.status : undefined;
      setTitle(status === 410 ? "Verification link expired" : status === 400 ? "Invalid verification link" : "Verification failed");
      setError(status === 410 ? "This link has expired. Request a new email below." : status === 400 ? "This link is invalid, replaced, or belongs to another workspace. Request a new email below." : "We could not verify your email. Please try again.");
      started.current = false;
    } finally {
      setWorking(false);
    }
  };

  return (
    <Card className="mx-auto max-w-md border-slate-200 bg-white shadow-xl shadow-slate-900/5">
      <CardHeader className="items-center text-center">
        <span className="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">{verified ? <CheckCircle2 className="h-7 w-7" /> : <MailCheck className="h-7 w-7" />}</span>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{verified ? "Your SprintIX workspace account is ready." : "Confirm your email address to activate your workspace owner account."}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        {verified ? <Button className="w-full" onClick={() => {
          router.push(loginPath);
        }}>Continue to sign in</Button> : <Button className="w-full" onClick={verify} disabled={working}>{working ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Verify email</Button>}
        {!verified && <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void resend(); }}>
          <Input type="email" required aria-label="Email address" placeholder="Your email address" value={email} onChange={(event) => setEmail(event.target.value)} />
          <Button type="submit" variant="outline" className="w-full" disabled={resending}>{resending ? "Requesting..." : "Resend verification email"}</Button>
        </form>}
        {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
        {!verified && <Button asChild variant="outline" className="w-full"><Link href={loginPath}>Back to sign in</Link></Button>}
      </CardContent>
    </Card>
  );
}
