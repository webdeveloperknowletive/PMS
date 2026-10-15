"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2, Check, Loader2, LockKeyhole, Mail, UserRound, Link2, ShieldCheck, BriefcaseBusiness, UsersRound, UserRoundSearch, Info, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { getApiErrorMessage } from "@/lib/api/client";
import { WORKSPACE_DOMAIN } from "@/lib/constants";

const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your full name (at least 2 characters)").max(150, "Name must be 150 characters or fewer"),
    email: z.string().email("Enter a valid work email address"),
    password: z.string().min(8, "Use at least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm your password"),
    organizationName: z.string().min(2, "Enter your company name"),
    workspaceSlug: z.string().min(3, "Workspace address must be at least 3 characters").max(63, "Workspace address must be 63 characters or fewer").regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])$/, "Use lowercase letters and numbers; hyphens can go between them"),
    acceptedTerms: z.boolean().refine(Boolean, "You must accept the Terms of Service"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });
type RegisterForm = z.infer<typeof registerSchema>;

function FieldIcon({ children }: { children: React.ReactNode }) {
  return <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{children}</span>;
}

function FieldError({ children }: { children?: string }) {
  if (!children) return null;
  return <p role="alert" className="flex items-start gap-1.5 rounded-md bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{children}</p>;
}

export default function RegisterPage() {
  const { register: registerUser, isRegistering } = useAuth();
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { acceptedTerms: false, workspaceSlug: "" },
    mode: "onTouched",
    reValidateMode: "onChange",
  });

  const organizationName = watch("organizationName", "");
  const workspaceSlug = watch("workspaceSlug", "");
  const acceptedTerms = watch("acceptedTerms", false);

  const onSubmit = async (values: RegisterForm) => {
    try {
      const result = await registerUser({
        name: values.name,
        email: values.email,
        password: values.password,
        organization_name: values.organizationName,
        workspace_slug: values.workspaceSlug,
        accepted_terms: values.acceptedTerms,
      });
      const verificationUrl = result.verification_url ? new URL(result.verification_url) : null;
      const token = verificationUrl?.searchParams.get("token") ?? null;
      const params = new URLSearchParams({ email: values.email });
      if (token) params.set("token", token);
      const workspaceSlug = verificationUrl?.searchParams.get("workspace_slug");
      if (workspaceSlug) params.set("workspace_slug", workspaceSlug);
      if (result.verification_email_sent) params.set("sent", "1");
      window.location.assign(`/verify-email-pending?${params.toString()}`);
    } catch (err) {
      setError("root", { message: getApiErrorMessage(err) });
    }
  };

  const nameRegistration = register("organizationName");
  const slugRegistration = register("workspaceSlug");
  const passwordRegistration = register("password", { deps: ["confirmPassword"] });
  const confirmPasswordRegistration = register("confirmPassword", { deps: ["password"] });

  return (
    <Card className="mx-auto w-full max-w-6xl overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl shadow-blue-950/10">
      <CardHeader className="px-6 pb-5 pt-6 sm:px-8">
        <CardTitle className="text-2xl">Create your SprintIX workspace</CardTitle>
        <CardDescription>Set up your company workspace. You will be its first Workspace Owner.</CardDescription>
      </CardHeader>
      <CardContent className="px-6 pb-6 sm:px-8 sm:pb-8">
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-5 lg:grid-cols-2">
          <section className="overflow-hidden rounded-xl border border-slate-200">
            <header className="flex items-center gap-3 border-b bg-gradient-to-r from-blue-50 to-indigo-50/70 px-5 py-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-sm font-bold text-white shadow-sm">1</span>
              <div><h2 className="font-bold uppercase tracking-wide text-slate-900">Account setup</h2><p className="text-xs text-slate-500">Your personal sign-in details</p></div>
            </header>
            <div className="space-y-4 p-5">
              <div className="space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <div className="relative"><FieldIcon><UserRound className="h-4 w-4" /></FieldIcon><Input id="name" autoComplete="name" placeholder="Jane Doe" aria-invalid={!!errors.name} className={`pl-10 ${errors.name ? "border-red-500 bg-red-50/40 focus-visible:border-red-500 focus-visible:ring-red-500/10" : ""}`} {...register("name")} /></div>
                <FieldError>{errors.name?.message}</FieldError>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Work email</Label>
                <div className="relative"><FieldIcon><Mail className="h-4 w-4" /></FieldIcon><Input id="email" type="email" autoComplete="email" placeholder="jane@company.com" aria-invalid={!!errors.email} className={`pl-10 ${errors.email ? "border-red-500 bg-red-50/40 focus-visible:border-red-500 focus-visible:ring-red-500/10" : ""}`} {...register("email")} /></div>
                <FieldError>{errors.email?.message}</FieldError>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <div className="relative"><FieldIcon><LockKeyhole className="h-4 w-4" /></FieldIcon><Input id="password" type="password" autoComplete="new-password" placeholder="At least 8 characters" aria-invalid={!!errors.password} className={`pl-10 ${errors.password ? "border-red-500 bg-red-50/40 focus-visible:border-red-500 focus-visible:ring-red-500/10" : ""}`} {...passwordRegistration} /></div>
                <FieldError>{errors.password?.message}</FieldError>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <Input id="confirmPassword" type="password" autoComplete="new-password" placeholder="Enter your password again" aria-invalid={!!errors.confirmPassword} className={errors.confirmPassword ? "border-red-500 bg-red-50/40 focus-visible:border-red-500 focus-visible:ring-red-500/10" : ""} {...confirmPasswordRegistration} />
                <FieldError>{errors.confirmPassword?.message}</FieldError>
              </div>
              <label className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm ${acceptedTerms ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
                <input type="checkbox" className="mt-1 accent-emerald-600" aria-invalid={!!errors.acceptedTerms} {...register("acceptedTerms")} />
                <span className="flex-1">I agree to the <Link href="/terms" className="font-medium text-blue-700 hover:underline">Terms of Service</Link>.</span>
                {acceptedTerms && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />}
              </label>
              <FieldError>{errors.acceptedTerms?.message}</FieldError>
              {errors.root && <p role="alert" className="flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700"><AlertCircle className="h-4 w-4 shrink-0" />{errors.root.message}</p>}
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={isRegistering || !acceptedTerms}>
                {isRegistering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Create workspace
              </Button>
              <p className="text-center text-sm text-muted-foreground">Already have an account? <Link href="/login" className="font-medium text-primary hover:underline">Log in</Link></p>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-200">
            <header className="flex items-center gap-3 border-b bg-gradient-to-r from-violet-50 to-indigo-50/70 px-5 py-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-sm font-bold text-white shadow-sm">2</span>
              <div><h2 className="font-bold uppercase tracking-wide text-indigo-900">Your workspace preview</h2><p className="text-xs text-slate-500">Company space and access roles</p></div>
            </header>
            <div className="space-y-5 p-5">
              <div className="space-y-1.5">
                <Label htmlFor="organizationName">Organization name</Label>
                <div className="relative"><FieldIcon><Building2 className="h-4 w-4" /></FieldIcon><Input id="organizationName" placeholder="Acme Technologies" aria-invalid={!!errors.organizationName} className={`pl-10 ${errors.organizationName ? "border-red-500 bg-red-50/40 focus-visible:border-red-500 focus-visible:ring-red-500/10" : ""}`} {...nameRegistration} onChange={(event) => {
                  nameRegistration.onChange(event);
                  if (!workspaceSlug || workspaceSlug === organizationName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")) {
                    setValue("workspaceSlug", event.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 63), { shouldValidate: true });
                  }
                }} /></div>
                <FieldError>{errors.organizationName?.message}</FieldError>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="workspaceSlug">Workspace address</Label>
                <div className={`flex overflow-hidden rounded-md border focus-within:ring-2 focus-within:ring-ring ${errors.workspaceSlug ? "border-red-500 bg-red-50/60" : "border-slate-200"}`}>
                  <span className="flex items-center border-r bg-slate-50 px-3 text-slate-400"><Link2 className="h-4 w-4" /></span>
                  <Input id="workspaceSlug" placeholder="your-company" aria-invalid={!!errors.workspaceSlug} className={`rounded-none border-0 focus-visible:ring-0 ${errors.workspaceSlug ? "bg-red-50/60 text-red-800" : ""}`} {...slugRegistration} onChange={(event) => setValue("workspaceSlug", event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/--+/g, "-"), { shouldValidate: true })} />
                  <span className="flex items-center bg-slate-50 px-3 text-xs text-slate-500">{WORKSPACE_DOMAIN.includes("localhost") ? "local workspace" : `.${WORKSPACE_DOMAIN}`}</span>
                </div>
                <p className="break-all text-xs text-slate-500">{WORKSPACE_DOMAIN.includes("localhost") ? `Local sign-in: http://${WORKSPACE_DOMAIN}/login?workspace_slug=${workspaceSlug || "your-workspace"}` : "You can share this unique workspace address with your team."}</p>
                <FieldError>{errors.workspaceSlug?.message}</FieldError>
              </div>
              <div className="space-y-2">
                <Label>Your role</Label>
                <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50/60 p-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-blue-600 bg-white"><span className="h-2.5 w-2.5 rounded-full bg-blue-600" /></span>
                  <ShieldCheck className="h-4 w-4 shrink-0 text-blue-600" />
                  <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-900">Workspace Owner / Creator</p><p className="text-xs text-slate-500">Manage the company workspace and invite your team.</p></div>
                  <span className="whitespace-nowrap rounded-full bg-violet-100 px-2 py-1 text-[10px] font-semibold text-violet-700">First account</span>
                </div>
                <div className="space-y-1.5 pt-1">
                  {[
                    { label: "Custom role access", icon: BriefcaseBusiness, note: "Configured by workspace admin" },
                    { label: "Team Member", icon: UsersRound, note: "Requires invite" },
                    { label: "External Guest / Client", icon: UserRoundSearch, note: "Requires invite" },
                  ].map(({ label, icon: Icon, note }) => <div key={label} className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-600"><span className="h-5 w-5 shrink-0 rounded-full border-2 border-slate-300 bg-white" /><Icon className="h-4 w-4 shrink-0 text-slate-400" /><span className="flex-1 text-sm">{label}</span><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-500">{note}</span></div>)}
                </div>
              </div>
              <div className="flex gap-3 rounded-lg border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50/70 p-4 text-xs leading-5 text-slate-600">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                <div><p className="font-semibold text-slate-800">What happens next?</p><p className="mt-1">Verify your work email, then create a project and invite employees. Choose each person’s role when you send their invitation.</p></div>
              </div>
            </div>
          </section>
        </form>
      </CardContent>
    </Card>
  );
}
