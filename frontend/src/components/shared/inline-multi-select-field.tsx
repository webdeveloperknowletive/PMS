"use client";
import { useEffect, useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { getApiErrorMessage } from "@/lib/api/client";
import type { InlineDetailOption } from "@/components/shared/inline-detail-field";
export function InlineMultiSelectField({ label, values, options, canEdit, onSave }: {
  label: string; values: string[]; options: InlineDetailOption[]; canEdit: boolean; onSave: (values: string[]) => Promise<unknown>;
}) {
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState(values);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => { if (!editing) setSelected(values); }, [values, editing]);
  const cancel = () => { setEditing(false); setSelected(values); setError(undefined); };
  const save = async () => { setSaving(true); setError(undefined); try { await onSave(selected); setEditing(false); } catch (cause) { setError(getApiErrorMessage(cause)); } finally { setSaving(false); } };
  const names = values.map((value) => options.find((option) => option.value === value)?.label ?? value);
  return <div><p className="mb-1 text-xs font-medium text-[#626f86]">{label}</p>{editing ? <div className="rounded border border-[#8590a2] bg-white p-2"><div className="max-h-52 space-y-1 overflow-y-auto">{options.map((option) => <label key={option.value} className="flex items-center gap-2 rounded p-1 text-sm hover:bg-[#f1f2f4]"><input type="checkbox" checked={selected.includes(option.value)} disabled={saving} onChange={(event) => setSelected((current) => event.target.checked ? [...current, option.value] : current.filter((value) => value !== option.value))} />{option.label}</label>)}</div><div className="mt-2 flex gap-1"><button type="button" onClick={() => void save()} disabled={saving} aria-label={"Save " + label} className="rounded border p-1 text-[#0c66e4]"><Check className="h-4 w-4" /></button><button type="button" onClick={cancel} disabled={saving} aria-label={"Cancel " + label} className="rounded border p-1"><X className="h-4 w-4" /></button></div>{error && <p role="alert" className="mt-1 text-xs text-destructive">{error}</p>}</div> : canEdit ? <button type="button" className="group/field flex min-h-8 w-full items-start justify-between gap-2 rounded px-2 py-1 text-left text-sm hover:bg-[#f1f2f4] focus-visible:ring-2 focus-visible:ring-[#0c66e4]" aria-label={"Edit " + label} onClick={() => setEditing(true)}><span>{names.join(", ") || <span className="text-[#8590a2]">None</span>}</span><Pencil className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#626f86] opacity-0 group-hover/field:opacity-100 group-focus-visible/field:opacity-100 max-md:opacity-100" /></button> : <p className="px-2 py-1 text-sm">{names.join(", ") || "None"}</p>}</div>;
}
