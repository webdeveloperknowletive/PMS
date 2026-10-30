"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  return <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10"><Card className="w-full max-w-md border-slate-700 bg-slate-900 text-white"><CardHeader><div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-violet-600"><ShieldCheck className="h-6 w-6" /></div><CardTitle>Platform Super Admin</CardTitle><CardDescription className="text-slate-400">Developer-company access only. Customer workspace accounts cannot sign in here.</CardDescription></CardHeader><CardContent><form onSubmit={handleSubmit(onSubmit)} className="space-y-4"><div><Label htmlFor="platform-email">Email</Label><Input id="platform-email" type="email" className="mt-1 bg-slate-800 text-white" {...register("email")} />{errors.email && <p className="mt-1 text-xs text-red-300">{errors.email.message}</p>}</div><div><Label htmlFor="platform-password">Password</Label><Input id="platform-password" type="password" className="mt-1 bg-slate-800 text-white" {...register("password")} />{errors.password && <p className="mt-1 text-xs text-red-300">{errors.password.message}</p>}</div>{error && <p className="rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-200">{error}</p>}<Button className="w-full" disabled={loading}>{loading && <Loader2 className="h-4 w-4 animate-spin" />} Sign in to platform</Button></form></CardContent></Card></div>;
}
