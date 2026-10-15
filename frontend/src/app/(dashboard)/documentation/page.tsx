"use client";

import { useMemo, useState } from "react";
import { Download, ExternalLink, FileText, Github, HardDrive, Pencil, Plus, Search, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DocumentFormDialog } from "@/components/modules/documentation/document-form-dialog";
import { useDeleteDocument, useDocuments } from "@/hooks/queries/use-documents";
import { documentsApi } from "@/lib/api/documents";
import { useProjects } from "@/hooks/queries/use-projects";
import { formatDate } from "@/lib/utils";
import { getApiErrorMessage } from "@/lib/api/client";
import type { Document } from "@/types/document";
import { usePermissions } from "@/hooks/use-permissions";

type ResourceType = "FILE" | "GITHUB" | "DRIVE";
const ALL = "__all__";
const wasEdited = (doc: Document) => !!doc.updated_at && new Date(doc.updated_at).getTime() - new Date(doc.created_at).getTime() > 1000;

function ResourceSection({
  title,
  description,
  icon: Icon,
  resources,
  loading,
  projects,
  canEdit,
  canDelete,
  onAdd,
  onEdit,
  onDelete,
}: {
  title: string;
  description: string;
  icon: typeof FileText;
  resources: Document[];
  loading: boolean;
  projects: Map<string, string>;
  canEdit: boolean;
  canDelete: boolean;
  onAdd: () => void;
  onEdit: (doc: Document) => void;
  onDelete: (doc: Document) => void;
}) {
  return (
    <Card className="overflow-hidden border-white/90">
      <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><Icon className="h-5 w-5" /></div><div><CardTitle className="text-base">{title}</CardTitle><p className="mt-1 text-xs text-slate-500">{description}</p></div></div>
        {canEdit && <Button size="sm" onClick={onAdd}><Plus className="h-4 w-4" />{title === "Uploaded files" ? "Upload file" : `Add ${title === "GitHub links" ? "GitHub link" : "Drive link"}`}</Button>}
      </CardHeader>
      <CardContent className="space-y-2 p-4">
        {loading ? Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />) : resources.length === 0 ? (
          <EmptyState icon={Icon} title={`No ${title.toLowerCase()} yet`} description={canEdit ? "Add one here so your project team can find it." : "Project resources will appear here when added."} actionLabel={canEdit ? (title === "Uploaded files" ? "Upload file" : "Add link") : undefined} onAction={canEdit ? onAdd : undefined} />
        ) : resources.map((doc) => (
          <div key={doc.document_id} className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-white p-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-800">{doc.title}</p>
              <p className="mt-1 text-xs text-slate-500">{projects.get(doc.project_id) ?? "Project"} · v{doc.version}</p>
              <p className="mt-1 text-[11px] text-slate-500">Added by {doc.created_by || "Unknown user"} · {formatDate(doc.created_at)}</p>
              {wasEdited(doc) && doc.updated_by && <p className="mt-0.5 text-[11px] text-slate-500">Last edited by {doc.updated_by}{doc.updated_at ? ` · ${formatDate(doc.updated_at)}` : ""}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {doc.resource_type === "FILE" && doc.original_filename ? (
                <Button size="sm" variant="outline" onClick={() => void documentsApi.download(doc.document_id, doc.original_filename || `${doc.title}.file`).catch((err) => toast.error(getApiErrorMessage(err)))}><Download className="h-4 w-4" />Download</Button>
              ) : doc.resource_type !== "FILE" && doc.file_url ? (
                <Button asChild size="sm" variant="outline"><a href={doc.file_url} target="_blank" rel="noopener noreferrer">Open link<ExternalLink className="h-4 w-4" /></a></Button>
              ) : doc.resource_type === "FILE" ? <span className="text-xs text-slate-400">No file uploaded</span> : null}
              {(canEdit || canDelete) && <div className="flex items-center gap-1">
                {canEdit && <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Edit resource" title="Edit resource" onClick={() => onEdit(doc)}><Pencil className="h-4 w-4" /></Button>}
                {canDelete && <Button variant="outline" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" aria-label="Delete resource" title="Delete resource" onClick={() => onDelete(doc)}><Trash2 className="h-4 w-4" /></Button>}
              </div>}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function DocumentationPage() {
  const { data: documents, isLoading } = useDocuments();
  const { data: projects } = useProjects();
  const deleteMutation = useDeleteDocument();
  const { canUploadDocuments, canDeleteDocuments } = usePermissions();
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState(ALL);
  const [formOpen, setFormOpen] = useState(false);
  const [resourceType, setResourceType] = useState<ResourceType>("FILE");
  const [editingDoc, setEditingDoc] = useState<Document | null>(null);
  const [deletingDoc, setDeletingDoc] = useState<Document | null>(null);

  const projectMap = useMemo(() => new Map((projects ?? []).map((p) => [p.project_id, p.project_name])), [projects]);
  const filtered = (documents ?? []).filter((doc) =>
    (!search || doc.title.toLowerCase().includes(search.toLowerCase())) &&
    (projectFilter === ALL || doc.project_id === projectFilter)
  );
  const openCreate = (type: ResourceType) => { setEditingDoc(null); setResourceType(type); setFormOpen(true); };
  const openEdit = (doc: Document) => { setEditingDoc(doc); setResourceType(doc.resource_type); setFormOpen(true); };
  const confirmDelete = async () => {
    if (!deletingDoc) return;
    try { await deleteMutation.mutateAsync(deletingDoc.document_id); toast.success("Resource deleted"); setDeletingDoc(null); }
    catch (err) { toast.error(getApiErrorMessage(err)); }
  };

  const sections = [
    { type: "GITHUB" as const, title: "GitHub links", description: "Repositories, pull requests, and code references", icon: Github },
    { type: "FILE" as const, title: "Uploaded files", description: "Project files stored in this workspace", icon: FileText },
    { type: "DRIVE" as const, title: "Drive links", description: "Google Drive, SharePoint, and other shared documents", icon: HardDrive },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Project resources" description="Find shared code links, uploaded files, and team documents." />
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search resources..." className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        <Select value={projectFilter} onValueChange={setProjectFilter}><SelectTrigger className="w-52"><SelectValue placeholder="Project" /></SelectTrigger><SelectContent><SelectItem value={ALL}>All Projects</SelectItem>{(projects ?? []).map((project) => <SelectItem key={project.project_id} value={project.project_id}>{project.project_name}</SelectItem>)}</SelectContent></Select>
      </div>
      {sections.map((section) => (
        <ResourceSection key={section.type} {...section} resources={filtered.filter((doc) => doc.resource_type === section.type)} loading={isLoading} projects={projectMap} canEdit={canUploadDocuments} canDelete={canDeleteDocuments} onAdd={() => openCreate(section.type)} onEdit={openEdit} onDelete={setDeletingDoc} />
      ))}
      <DocumentFormDialog open={formOpen} onOpenChange={setFormOpen} document={editingDoc} resourceType={resourceType} />
      <ConfirmDialog open={!!deletingDoc} onOpenChange={(open) => !open && setDeletingDoc(null)} title="Delete this resource?" description={`This will permanently remove "${deletingDoc?.title}". This action cannot be undone.`} confirmLabel="Delete" onConfirm={confirmDelete} isLoading={deleteMutation.isPending} />
    </div>
  );
}
