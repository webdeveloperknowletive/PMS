"use client";

import { useState, type FormEvent } from "react";
import { ChevronDown, ChevronUp, History, PackageCheck, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateProjectRelease, useDeleteProjectRelease, useProjectReleaseScopeHistory, useProjectReleases, useUpdateProjectRelease } from "@/hooks/queries/use-projects";
import { usePermissions } from "@/hooks/use-permissions";
import { getApiErrorMessage } from "@/lib/api/client";

const releaseStatuses = ["PLANNED", "IN_PROGRESS", "RELEASED", "CANCELLED"] as const;

export function ProjectReleasesPanel({ projectId }: { projectId: string }) {
  const { data: releases = [], isLoading } = useProjectReleases(projectId);
  const createRelease = useCreateProjectRelease();
  const updateRelease = useUpdateProjectRelease();
  const deleteRelease = useDeleteProjectRelease();
  const { permissionCodes } = usePermissions();
  const canManage = ["projects.create", "projects.update", "projects.delete", "projects.manage", "roles.manage"].some((code) => permissionCodes.includes(code));
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [version, setVersion] = useState("");
  const [releaseDate, setReleaseDate] = useState("");
  const [releaseToDelete, setReleaseToDelete] = useState<{ release_id: string; name: string } | null>(null);
  const [historySelection, setHistorySelection] = useState<string | null | undefined>();
  const historyReleaseId = typeof historySelection === "string" ? historySelection : undefined;
  const historyOpen = historySelection !== undefined;
  const { data: history = [], isLoading: historyLoading } = useProjectReleaseScopeHistory(projectId, historyReleaseId, historyOpen);
  const selectedReleaseName = releases.find((release) => release.release_id === historyReleaseId)?.name;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await createRelease.mutateAsync({ projectId, payload: { name: name.trim(), version: version.trim() || null, release_date: releaseDate || null, notes: null } });
      setName(""); setVersion(""); setReleaseDate(""); setShowForm(false); toast.success("Release created");
    } catch (error) { toast.error(getApiErrorMessage(error)); }
  };

  return <Card id="project-releases" className="scroll-mt-24 border-white/90">
    <CardHeader className="flex flex-row flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-700"><PackageCheck className="h-4 w-4" /></span>
      <CardTitle className="min-w-0 flex-1 text-sm">Releases and versions</CardTitle>
      <Badge variant="secondary">{releases.length}</Badge>
      <Button type="button" size="sm" variant="ghost" aria-expanded={historySelection === null} onClick={() => setHistorySelection((current) => current === null ? undefined : null)}><History className="h-4 w-4" />All history</Button>
      {canManage && <Button size="sm" variant="outline" onClick={() => setShowForm((value) => !value)}><Plus className="h-4 w-4" />Add release</Button>}
    </CardHeader>
    <CardContent className="space-y-3 p-4">
      {showForm && <form onSubmit={(event) => void submit(event)} className="grid gap-3 rounded-xl border border-violet-100 bg-violet-50/40 p-3 sm:grid-cols-3">
        <div className="space-y-1.5"><Label htmlFor="release-name">Release name</Label><Input id="release-name" value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={150} required /></div>
        <div className="space-y-1.5"><Label htmlFor="release-version">Version</Label><Input id="release-version" value={version} onChange={(event) => setVersion(event.target.value)} maxLength={50} placeholder="e.g. 2.1.0" /></div>
        <div className="space-y-1.5"><Label htmlFor="release-date">Release date</Label><Input id="release-date" type="date" value={releaseDate} onChange={(event) => setReleaseDate(event.target.value)} /></div>
        <div className="flex justify-end gap-2 sm:col-span-3"><Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button><Button type="submit" disabled={createRelease.isPending}>Create release</Button></div>
      </form>}
      {historySelection === null && <div className="rounded-xl border border-violet-100 bg-violet-50/30 p-3" aria-live="polite">
        <p className="mb-2 text-xs font-semibold text-slate-700">All release scope changes</p>
        {historyLoading ? <p className="py-2 text-xs text-slate-500">Loading release history…</p> : history.length === 0 ? <p className="py-2 text-xs text-slate-500">No scope changes recorded yet.</p> : <ol className="max-h-64 space-y-2 overflow-y-auto">
          {history.map((change) => <li key={change.scope_change_id} className="flex items-start justify-between gap-3 text-xs">
            <span className="min-w-0"><Badge variant={change.event_type === "REMOVED" ? "outline" : "secondary"} className="mr-2">{change.event_type === "BASELINE" ? "Existing" : change.event_type.toLowerCase()}</Badge><span className="font-medium text-slate-700">{change.task_name}</span><span className="text-slate-500"> · {change.release_name} · {change.actor_name ?? (change.event_type === "BASELINE" ? "Before history tracking" : "Former user")}</span></span>
            <time className="shrink-0 text-slate-500" dateTime={change.created_at}>{new Date(change.created_at).toLocaleString()}</time>
          </li>)}
        </ol>}
      </div>}
      {isLoading ? <p className="text-xs text-slate-500">Loading releases…</p> : releases.length === 0 ? <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">No releases are planned for this project.</p> : releases.map((release) => <div key={release.release_id} className="space-y-2 rounded-xl border border-slate-100 p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800">{release.name}{release.version ? ` · ${release.version}` : ""}</p><p className="mt-1 text-xs text-slate-500">{release.completed_task_count} complete · {release.unresolved_task_count} unresolved of {release.task_count}{release.release_date ? ` · due ${release.release_date}` : ""}</p></div>
          {canManage ? <Select value={release.status} onValueChange={(status) => updateRelease.mutate({ projectId, releaseId: release.release_id, payload: { status: status as typeof release.status } }, { onError: (error) => toast.error(getApiErrorMessage(error)) })}><SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger><SelectContent>{releaseStatuses.map((status) => <SelectItem key={status} value={status}>{status.replace("_", " ")}</SelectItem>)}</SelectContent></Select> : <Badge variant="outline">{release.status.replace("_", " ")}</Badge>}
          <Button type="button" size="sm" variant="ghost" aria-expanded={historyReleaseId === release.release_id} aria-controls={`release-history-${release.release_id}`} onClick={() => setHistorySelection((current) => current === release.release_id ? undefined : release.release_id)}>
            <History className="h-4 w-4" />History {historyReleaseId === release.release_id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          {canManage && <Button type="button" size="icon" variant="ghost" aria-label={`Delete release ${release.name}`} onClick={() => setReleaseToDelete({ release_id: release.release_id, name: release.name })}><Trash2 className="h-4 w-4 text-rose-600" /></Button>}
        </div>
        {historyReleaseId === release.release_id && <div id={`release-history-${release.release_id}`} className="border-t border-slate-100 pt-2" aria-live="polite">
          <p className="mb-2 text-xs font-semibold text-slate-700">{selectedReleaseName} scope changes</p>
          {historyLoading ? <p className="py-2 text-xs text-slate-500">Loading release history…</p> : history.length === 0 ? <p className="py-2 text-xs text-slate-500">No scope changes recorded yet.</p> : <ol className="max-h-64 space-y-2 overflow-y-auto">
            {history.map((change) => <li key={change.scope_change_id} className="flex items-start justify-between gap-3 text-xs">
              <span className="min-w-0"><Badge variant={change.event_type === "REMOVED" ? "outline" : "secondary"} className="mr-2">{change.event_type === "BASELINE" ? "Existing" : change.event_type.toLowerCase()}</Badge><span className="font-medium text-slate-700">{change.task_name}</span><span className="text-slate-500"> · {change.actor_name ?? (change.event_type === "BASELINE" ? "Before history tracking" : "Former user")}</span></span>
              <time className="shrink-0 text-slate-500" dateTime={change.created_at}>{new Date(change.created_at).toLocaleString()}</time>
            </li>)}
          </ol>}
        </div>}
      </div>)}
    </CardContent>
    <ConfirmDialog
      open={releaseToDelete !== null}
      onOpenChange={(open) => { if (!open && !deleteRelease.isPending) setReleaseToDelete(null); }}
      title="Delete release?"
      description={`Tasks will be unlinked from ${releaseToDelete?.name ?? "this release"}. The release scope history will be retained.`}
      onConfirm={() => {
        if (!releaseToDelete) return;
        deleteRelease.mutate({ projectId, releaseId: releaseToDelete.release_id }, {
          onSuccess: () => { toast.success("Release deleted"); setReleaseToDelete(null); },
          onError: (error) => toast.error(getApiErrorMessage(error)),
        });
      }}
      isLoading={deleteRelease.isPending}
    />
  </Card>;
}
