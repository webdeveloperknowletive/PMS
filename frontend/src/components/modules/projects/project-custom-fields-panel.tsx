"use client";

import { useState, type FormEvent } from "react";
import { Plus, Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useCreateProjectCustomField, useDeleteProjectCustomField, useProjectCustomFields } from "@/hooks/queries/use-projects";
import { usePermissions } from "@/hooks/use-permissions";
import { getApiErrorMessage } from "@/lib/api/client";
import type { ProjectCustomField, ProjectCustomFieldType } from "@/types/project";

const NO_DEFAULT = "__no_custom_default__";
const fieldTypes: { value: ProjectCustomFieldType; label: string }[] = [
  { value: "TEXT", label: "Text" },
  { value: "NUMBER", label: "Number" },
  { value: "DATE", label: "Date" },
  { value: "SINGLE_SELECT", label: "Single select" },
  { value: "CHECKBOX", label: "Checkbox" },
];

export function ProjectCustomFieldsPanel({ projectId }: { projectId: string }) {
  const { data: fields = [], isLoading } = useProjectCustomFields(projectId);
  const createField = useCreateProjectCustomField();
  const deleteField = useDeleteProjectCustomField();
  const { permissionCodes } = usePermissions();
  const canManage = ["projects.create", "projects.update", "projects.delete", "projects.manage", "roles.manage"].some((code) => permissionCodes.includes(code));
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [fieldType, setFieldType] = useState<ProjectCustomFieldType>("TEXT");
  const [required, setRequired] = useState(false);
  const [optionsText, setOptionsText] = useState("");
  const [defaultValue, setDefaultValue] = useState(NO_DEFAULT);
  const [deleting, setDeleting] = useState<ProjectCustomField | null>(null);

  const resetForm = () => {
    setName(""); setFieldType("TEXT"); setRequired(false); setOptionsText(""); setDefaultValue(NO_DEFAULT);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 100) return;
    const options = fieldType === "SINGLE_SELECT"
      ? [...new Set(optionsText.split(",").map((option) => option.trim()).filter(Boolean))]
      : [];
    if (fieldType === "SINGLE_SELECT" && (options.length === 0 || options.some((option) => option.length > 100))) {
      toast.error("Add 1 to 50 unique options, each up to 100 characters");
      return;
    }
    let parsedDefault: unknown = null;
    if (defaultValue !== NO_DEFAULT) {
      if (fieldType === "TEXT") parsedDefault = defaultValue.trim();
      else if (fieldType === "NUMBER") {
        parsedDefault = Number(defaultValue);
        if (!Number.isFinite(parsedDefault)) { toast.error("Enter a valid numeric default"); return; }
      } else if (fieldType === "DATE") {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(defaultValue) || Number.isNaN(Date.parse(`${defaultValue}T00:00:00`))) { toast.error("Enter a valid date default"); return; }
        parsedDefault = defaultValue;
      } else if (fieldType === "SINGLE_SELECT") {
        if (!options.includes(defaultValue)) { toast.error("Select a default from the configured options"); return; }
        parsedDefault = defaultValue;
      } else parsedDefault = defaultValue === "true";
    }
    try {
      await createField.mutateAsync({ projectId, payload: { name: trimmedName, field_type: fieldType, is_required: required, options, default_value: parsedDefault } });
      resetForm(); setShowForm(false); toast.success("Custom field created");
    } catch (error) { toast.error(getApiErrorMessage(error)); }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteField.mutateAsync({ projectId, fieldId: deleting.field_id });
      setDeleting(null);
      toast.success("Custom field removed");
    } catch (error) { toast.error(getApiErrorMessage(error)); }
  };

  return <>
    <Card id="project-custom-fields" className="scroll-mt-24 border-white/90">
      <CardHeader className="flex flex-row items-center gap-3 border-b border-slate-100 px-4 py-3.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-700"><Settings2 className="h-4 w-4" /></span>
        <CardTitle className="min-w-0 flex-1 text-sm">Task custom fields</CardTitle>
        <Badge variant="secondary">{fields.length}</Badge>
        {canManage && <Button size="sm" variant="outline" onClick={() => setShowForm((value) => !value)}><Plus className="h-4 w-4" /> Add field</Button>}
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        {showForm && <form onSubmit={(event) => void submit(event)} className="grid gap-3 rounded-xl border border-violet-100 bg-violet-50/40 p-3 sm:grid-cols-2">
          <div className="space-y-1.5"><Label htmlFor="custom-field-name">Field name</Label><Input id="custom-field-name" value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={100} required /></div>
          <div className="space-y-1.5"><Label>Type</Label><Select value={fieldType} onValueChange={(value) => { setFieldType(value as ProjectCustomFieldType); setDefaultValue(NO_DEFAULT); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{fieldTypes.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}</SelectContent></Select></div>
          {fieldType === "SINGLE_SELECT" && <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="custom-field-options">Options</Label><Input id="custom-field-options" value={optionsText} onChange={(event) => setOptionsText(event.target.value)} maxLength={5000} placeholder="Separate options with commas" required /></div>}
          {fieldType === "CHECKBOX" ? <div className="space-y-1.5"><Label>Default</Label><Select value={defaultValue} onValueChange={setDefaultValue}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={NO_DEFAULT}>No default</SelectItem><SelectItem value="true">Checked</SelectItem><SelectItem value="false">Unchecked</SelectItem></SelectContent></Select></div> : <div className="space-y-1.5"><Label htmlFor="custom-field-default">Default value (optional)</Label>{fieldType === "SINGLE_SELECT" ? <Select value={defaultValue} onValueChange={setDefaultValue}><SelectTrigger><SelectValue placeholder="No default" /></SelectTrigger><SelectContent><SelectItem value={NO_DEFAULT}>No default</SelectItem>{optionsText.split(",").map((option) => option.trim()).filter(Boolean).map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select> : <Input id="custom-field-default" type={fieldType === "NUMBER" ? "number" : fieldType === "DATE" ? "date" : "text"} value={defaultValue === NO_DEFAULT ? "" : defaultValue} onChange={(event) => setDefaultValue(event.target.value || NO_DEFAULT)} maxLength={1000} />}</div>}
          <label className="flex items-center gap-2 self-end text-sm"><input type="checkbox" checked={required} onChange={(event) => setRequired(event.target.checked)} className="h-4 w-4 rounded border-slate-300" />Required on tasks</label>
          <p className="text-xs text-slate-500 sm:col-span-2">Field types and options stay fixed after creation. Remove and recreate a field to change its type; removal clears its saved task values and records that change.</p>
          <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="ghost" onClick={() => { setShowForm(false); resetForm(); }}>Cancel</Button><Button type="submit" disabled={createField.isPending || name.trim().length < 2}>{createField.isPending ? "Creating…" : "Create field"}</Button></div>
        </form>}
        {isLoading ? <p className="text-xs text-slate-500">Loading custom fields…</p> : fields.length === 0 ? <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">No custom fields are configured for this project.</p> : fields.map((field) => <div key={field.field_id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800">{field.name}</p><p className="mt-1 text-xs text-slate-500">{fieldTypes.find((type) => type.value === field.field_type)?.label} · {field.is_required ? "Required" : "Optional"}{field.options.length ? ` · ${field.options.join(", ")}` : ""}{field.default_value !== null ? ` · Default: ${String(field.default_value)}` : ""}</p></div>
          {canManage && <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${field.name}`} onClick={() => setDeleting(field)}><Trash2 className="h-4 w-4" /></Button>}
        </div>)}
      </CardContent>
    </Card>
    <ConfirmDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)} title="Remove this custom field?" description={`This permanently clears “${deleting?.name ?? "this field"}” from project tasks and records the removal in each affected task's activity.`} confirmLabel="Remove field" onConfirm={() => void confirmDelete()} isLoading={deleteField.isPending} />
  </>;
}
