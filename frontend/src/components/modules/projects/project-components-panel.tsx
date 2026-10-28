"use client";

import { useState, type FormEvent } from "react";
import { Component, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useCreateProjectComponent, useDeleteProjectComponent, useProjectComponents, useUpdateProjectComponent } from "@/hooks/queries/use-projects";
import { usePermissions } from "@/hooks/use-permissions";
import { getApiErrorMessage } from "@/lib/api/client";
import type { ProjectComponent } from "@/types/project";

export function ProjectComponentsPanel({ projectId }: { projectId: string }) {
  const { data: components = [], isLoading } = useProjectComponents(projectId);
  const createComponent = useCreateProjectComponent();
  const updateComponent = useUpdateProjectComponent();
  const deleteComponent = useDeleteProjectComponent();
  const { permissionCodes } = usePermissions();
  const canManage = ["projects.create", "projects.update", "projects.delete", "projects.manage", "roles.manage"].some((code) => permissionCodes.includes(code));
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingDescription, setEditingDescription] = useState("");
  const [deleting, setDeleting] = useState<ProjectComponent | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 100) return;
    try {
      await createComponent.mutateAsync({ projectId, payload: { name: trimmedName, description: description.trim() || null } });
      setName("");
      setDescription("");
      setShowForm(false);
      toast.success("Component created");
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteComponent.mutateAsync({ projectId, componentId: deleting.component_id });
      toast.success("Component removed; linked tasks remain in the project");
      setDeleting(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  const saveEdit = async (event: FormEvent<HTMLFormElement>, componentId: string) => {
    event.preventDefault();
    const trimmedName = editingName.trim();
    if (trimmedName.length < 2 || trimmedName.length > 100) return;
    try {
      await updateComponent.mutateAsync({ projectId, componentId, payload: { name: trimmedName, description: editingDescription.trim() || null } });
      setEditingId(null);
      toast.success("Component updated");
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  return <>
    <Card id="project-components" className="scroll-mt-24 border-white/90">
      <CardHeader className="flex flex-row items-center gap-3 border-b border-slate-100 px-4 py-3.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-700"><Component className="h-4 w-4" /></span>
        <CardTitle className="min-w-0 flex-1 text-sm">Project components</CardTitle>
        <Badge variant="secondary">{components.length}</Badge>
        {canManage && <Button size="sm" variant="outline" onClick={() => setShowForm((value) => !value)}><Plus className="h-4 w-4" /> Add component</Button>}
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        {showForm && <form onSubmit={(event) => void submit(event)} className="grid gap-3 rounded-xl border border-violet-100 bg-violet-50/40 p-3 sm:grid-cols-2">
          <div className="space-y-1.5"><Label htmlFor="component-name">Component name</Label><Input id="component-name" value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={100} required /></div>
          <div className="space-y-1.5"><Label htmlFor="component-description">Description</Label><Input id="component-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} placeholder="Optional" /></div>
          <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button><Button type="submit" disabled={createComponent.isPending || name.trim().length < 2}>{createComponent.isPending ? "Creating…" : "Create component"}</Button></div>
        </form>}
        {isLoading ? <p className="text-xs text-slate-500">Loading components…</p> : components.length === 0 ? <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">No components are defined for this project.</p> : components.map((component) => editingId === component.component_id ? <form key={component.component_id} onSubmit={(event) => void saveEdit(event, component.component_id)} className="grid gap-2 rounded-xl border border-violet-100 bg-violet-50/40 p-3 sm:grid-cols-2">
          <Input aria-label="Component name" value={editingName} onChange={(event) => setEditingName(event.target.value)} minLength={2} maxLength={100} required />
          <Input aria-label="Component description" value={editingDescription} onChange={(event) => setEditingDescription(event.target.value)} maxLength={1000} placeholder="Optional description" />
          <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button><Button type="submit" disabled={updateComponent.isPending || editingName.trim().length < 2}>{updateComponent.isPending ? "Saving…" : "Save changes"}</Button></div>
        </form> : <div key={component.component_id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800">{component.name}</p>{component.description && <p className="mt-1 truncate text-xs text-slate-500">{component.description}</p>}</div>
          {canManage && <><Button type="button" variant="ghost" size="icon" aria-label={`Edit ${component.name}`} onClick={() => { setEditingId(component.component_id); setEditingName(component.name); setEditingDescription(component.description ?? ""); }}><Pencil className="h-4 w-4" /></Button><Button type="button" variant="ghost" size="icon" aria-label={`Remove ${component.name}`} onClick={() => setDeleting(component)}><Trash2 className="h-4 w-4" /></Button></>}
        </div>)}
      </CardContent>
    </Card>
    <ConfirmDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)} title="Remove this component?" description="Linked tasks will remain and their component will be cleared. The removal will be recorded in task activity." confirmLabel="Remove component" onConfirm={() => void confirmDelete()} isLoading={deleteComponent.isPending} />
  </>;
}
