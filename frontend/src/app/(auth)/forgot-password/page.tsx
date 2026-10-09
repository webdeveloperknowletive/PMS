"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Copy, ExternalLink, Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authApi } from "@/lib/api/auth";
import { getApiErrorMessage } from "@/lib/api/client";
import { toast } from "sonner";

const schema = z.object({ email: z.string().email("Enter a valid email address") });
type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [resetLink, setResetLink] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: authApi.forgotPassword,
    onSuccess: (response) => {
      if (response.reset_token) {
        const url = new URL("/reset-password", window.location.origin);
        url.searchParams.set("token", response.reset_token);
        setResetLink(url.toString());
      }
      setSent(true);
    },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      await mutation.mutateAsync(values);
    } catch (err) {
      setError("root", { message: getApiErrorMessage(err) });
    }
  };

  if (sent) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent">
            <MailCheck className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-base font-semibold text-foreground">Check your inbox</h2>
          <p className="text-sm text-muted-foreground">
            {resetLink
              ? "Email delivery is not configured yet, so use this private development reset link. It expires in 30 minutes and works once."
              : "If an account exists for that email, a password reset link will be sent when email delivery is configured."}
          </p>
          {resetLink && <div className="mt-2 flex w-full flex-col gap-2">
            <Button asChild className="w-full"><Link href={resetLink}><ExternalLink className="h-4 w-4" /> Open reset page</Link></Button>
            <Button type="button" variant="outline" className="w-full" onClick={async () => { try { await navigator.clipboard.writeText(resetLink); toast.success("Reset link copied"); } catch { toast.error("Could not copy the reset link."); } }}><Copy className="h-4 w-4" /> Copy reset link</Button>
          </div>}
          <Link href="/login" className="mt-2 text-sm font-medium text-primary hover:underline">
            Back to login
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Forgot your password?</CardTitle>
        <CardDescription>Enter your email and we&apos;ll send you a reset link.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="you@company.com" {...register("email")} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          {errors.root && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{errors.root.message}</p>
          )}

          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Send reset link
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Remembered it?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Log in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
