import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const sections = [
  ["Workspace accounts", "A person creating a workspace must be authorized to represent their organization. Keep account credentials private and tell the workspace owner if access may be compromised."],
  ["Invited members", "Workspace owners and authorized administrators choose employee roles. Members must use the access granted to them and must not try to access another workspace or data they are not allowed to see."],
  ["Customer data", "Your organization is responsible for the files and information it adds, its user access, and keeping suitable copies of important data."],
  ["Acceptable use", "Do not use SprintIX to break laws, harm other people, interfere with the service, or upload content you do not have the right to share."],
  ["Plans and service", "Trial and paid plan details, prices, limits, cancellation, support, and service commitments must be shown in the product before paid subscriptions are offered."],
];

export default function TermsPage() {
  return (
    <Card className="mx-auto w-full max-w-2xl border-slate-200 bg-white shadow-xl shadow-slate-900/5">
      <CardHeader>
        <CardTitle>Terms of Service</CardTitle>
        <CardDescription>Demo terms for workspace signup</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          These are starter terms for the product demo, not a finalized legal agreement. The product owner must replace or approve them with qualified legal advice before public sale.
        </p>
        {sections.map(([title, body]) => (
          <section key={title}>
            <h2 className="font-semibold text-slate-900">{title}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">{body}</p>
          </section>
        ))}
        <Button asChild variant="outline"><Link href="/register">Back to workspace signup</Link></Button>
      </CardContent>
    </Card>
  );
}
