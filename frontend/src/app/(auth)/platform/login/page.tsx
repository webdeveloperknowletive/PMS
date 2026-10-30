"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authApi } from "@/lib/api/auth";
import { tokenStorage } from "@/lib/api/client";
import { useAuthStore } from "@/store/auth-store";
import { getApiErrorMessage } from "@/lib/api/client";

const schema = z.object({ email: z.string().email("Enter a valid email address"), password: z.string().min(1, "Password is required") });
type Form = z.infer<typeof schema>;

export default function PlatformLoginPage() {
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) });
  const onSubmit = async (values: Form) => {
    setLoading(true); setError("");
    try { const data = await authApi.platformLogin(values.email, values.password); tokenStorage.setTokens(data.access_token, data.refresh_token); setUser(await authApi.getPlatformMe()); router.replace("/platform"); }
    catch (err) { setError(getApiErrorMessage(err)); } finally { setLoading(false); }
  };
  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 text-violet-700"><ShieldCheck className="h-6 w-6" /></div>
        <CardTitle>Platform Super Admin</CardTitle>
        <CardDescription>Sign in to manage SprintIX customer organizations. This portal is only for the developer company.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5"><Label htmlFor="platform-email">Email</Label><Input id="platform-email" type="email" placeholder="admin@yourcompany.com" autoComplete="username" {...register("email")} />{errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}</div>
          <div className="space-y-1.5"><Label htmlFor="platform-password">Password</Label><PasswordInput id="platform-password" placeholder="••••••••" autoComplete="current-password" {...register("password")} />{errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}</div>
          {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>{loading && <Loader2 className="h-4 w-4 animate-spin" />} Sign in to Platform</Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">Workspace customer? <Link href="/login" className="font-medium text-primary hover:underline">Customer login</Link></p>
        <p className="mt-3 text-center text-xs text-muted-foreground"><Link href="/register" className="font-medium text-primary hover:underline">Return to signup</Link></p>
      </CardContent>
    </Card>
  );
}
