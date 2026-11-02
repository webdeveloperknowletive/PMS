"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { getApiErrorMessage } from "@/lib/api/client";

export interface InlineDetailOption {
  value: string;
  label: string;
}

export function InlineDetailField({
  label,
  value,
  onSave,
  canEdit = false,
  type = "text",
  options,
  placeholder = "Not set",
  display,
  required = false,
  validate,
  className = "",
}: {
  label: string;
  value: string | number | null | undefined;
  onSave: (value: string) => Promise<unknown>;
  canEdit?: boolean;
  type?: "text" | "email" | "date" | "datetime-local" | "number" | "textarea" | "select";
  options?: readonly InlineDetailOption[];
  placeholder?: string;
  display?: ReactNode;
  required?: boolean;
  validate?: (value: string) => string | undefined;
  className?: string;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null);
  const current = value == null ? "" : String(value);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(current);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!editing) setDraft(current);
  }, [current, editing]);
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const cancel = () => {
    setEditing(false);
    setDraft(current);
    setError(undefined);
  };
  const save = async () => {
    const next = type === "text" || type === "email" || type === "number" ? draft.trim() : draft;
    if (required && !next) { setError(`${label} is required`); return; }
    const validationError = validate?.(next);
    if (validationError) { setError(validationError); return; }
    if (next === current) { cancel(); return; }
    setSaving(true);
    setError(undefined);
    try {
      await onSave(next);
      setEditing(false);
    } catch (cause) {
      setError(getApiErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  const editorClass = "w-full rounded border border-[#8590a2] bg-white px-2 py-1.5 text-sm text-[#172b4d] outline-none focus:border-[#0c66e4] focus:ring-2 focus:ring-[#0c66e4]/20";
  return <div className={`min-w-0 ${className}`}>
    <label htmlFor={id} className="mb-1 block text-xs font-medium text-[#626f86]">{label}</label>
    {editing ? <div className="space-y-1.5">
      {type === "textarea" ? <textarea ref={inputRef as React.Ref<HTMLTextAreaElement>} id={id} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") cancel(); if ((event.ctrlKey || event.metaKey) && event.key === "Enter") void save(); }} rows={4} className={editorClass} disabled={saving} />
        : type === "select" ? <select ref={inputRef as React.Ref<HTMLSelectElement>} id={id} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") cancel(); if (event.key === "Enter") void save(); }} className={editorClass} disabled={saving}>{options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
        : <input ref={inputRef as React.Ref<HTMLInputElement>} id={id} type={type} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") cancel(); if (event.key === "Enter") void save(); }} className={editorClass} disabled={saving} />}
      <div className="flex items-center gap-1">
        <button type="button" title={`Save ${label}`} aria-label={`Save ${label}`} onClick={() => void save()} disabled={saving} className="rounded border bg-white p-1 text-[#0c66e4] shadow-sm hover:bg-[#e9f2ff] disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}</button>
        <button type="button" title={`Cancel editing ${label}`} aria-label={`Cancel editing ${label}`} onClick={cancel} disabled={saving} className="rounded border bg-white p-1 text-[#44546f] shadow-sm hover:bg-[#f1f2f4] disabled:opacity-50"><X className="h-4 w-4" /></button>
        {type === "textarea" && <span className="ml-1 text-[11px] text-[#626f86]">Ctrl+Enter to save</span>}
      </div>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div> : canEdit ? <button type="button" onClick={() => { setDraft(current); setError(undefined); setEditing(true); }} aria-label={`Edit ${label}`} className="group/field flex min-h-8 w-full items-start justify-between gap-2 rounded px-2 py-1 text-left text-sm text-[#172b4d] hover:bg-[#f1f2f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c66e4]">
      <span className="min-w-0 whitespace-pre-wrap break-words">{display ?? (current || <span className="text-[#8590a2]">{placeholder}</span>)}</span>
      <Pencil aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#626f86] opacity-0 transition-opacity group-hover/field:opacity-100 group-focus-visible/field:opacity-100 max-md:opacity-100" />
    </button> : <div className="min-h-8 px-2 py-1 text-sm text-[#172b4d] whitespace-pre-wrap break-words">{display ?? (current || <span className="text-[#8590a2]">{placeholder}</span>)}</div>}
  </div>;
}
