"use client";

import Link from "next/link";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { InlineDetailField, type InlineDetailOption } from "@/components/shared/inline-detail-field";
import { Button } from "@/components/ui/button";

export interface DetailField {
  label: string;
  value: string | number | null | undefined;
  key?: string;
  type?: "text" | "email" | "date" | "datetime-local" | "number" | "textarea" | "select";
  options?: readonly InlineDetailOption[];
  display?: React.ReactNode;
  required?: boolean;
  editable?: boolean;
  validate?: (value: string) => string | undefined;
  parse?: (value: string) => unknown;
}

export function RecordDetailPage({ title, subtitle, backHref, backLabel, fields, canEdit, onSave, children, fullWidthChildren = false }: {
  title: string;
  subtitle?: string;
  backHref: string;
  backLabel: string;
  fields: DetailField[];
  canEdit: boolean;
  onSave: (key: string, value: unknown) => Promise<unknown>;
  children?: React.ReactNode;
  fullWidthChildren?: boolean;
}) {
  return <div className="space-y-5">
    <PageHeader title={title} description={subtitle} showHome={false} actions={<Button asChild variant="outline" size="sm"><Link href={backHref}>{backLabel}</Link></Button>} />
    <div className={fullWidthChildren ? "grid gap-5" : "grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]"}>
      <section className="rounded-md border border-[#dfe1e6] bg-white p-5 shadow-sm"><h2 className="mb-4 font-semibold text-[#172b4d]">Details</h2><div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        {fields.map((field) => <InlineDetailField key={field.label} label={field.label} value={field.value} type={field.type} options={field.options} display={field.display} required={field.required} canEdit={canEdit && field.editable !== false && !!field.key} validate={field.validate} className={field.type === "textarea" ? "sm:col-span-2" : ""} onSave={async (value) => { if (!field.key) return; await onSave(field.key, field.parse ? field.parse(value) : value); toast.success(field.label + " updated"); }} />)}
      </div></section>
      {children && !fullWidthChildren && <aside>{children}</aside>}
    </div>
    {children && fullWidthChildren && <div>{children}</div>}
  </div>;
}
