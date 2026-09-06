"use client";

import { useState } from "react";
import { FileStack, Loader2, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useProjects } from "@/hooks/queries/use-projects";
import {
  useDeleteGeneratedDocument,
  useGenerateDocument,
  useGeneratedDocuments,
} from "@/hooks/queries/use-ai-doc-generator";
import { formatDate } from "@/lib/utils";
import { getApiErrorMessage } from "@/lib/api/client";
import type { AIDocumentGeneration } from "@/types/ai";

export default function AIDocGeneratorPage() {
  const { data: projects } = useProjects();
  const { data: documents, isLoading } = useGeneratedDocuments();
  const generateMutation = useGenerateDocument();
  const deleteMutation = useDeleteGeneratedDocument();

  const [projectId, setProjectId] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");

  const [viewing, setViewing] = useState<AIDocumentGeneration | null>(null);
  const [deleting, setDeleting] = useState<AIDocumentGeneration | null>(null);

  const projectName = (id: string) => projects?.find((p) => p.project_id === id)?.project_name ?? "Unknown project";

  const canGenerate = projectId && documentType.trim() && title.trim() && prompt.trim() && !generateMutation.isPending;

  const handleGenerate = async () => {
    try {
      await generateMutation.mutateAsync({
        project_id: projectId,
        document_type: documentType.trim(),
        title: title.trim(),
        prompt: prompt.trim(),
      });
      toast.success("Document generated");
      setDocumentType("");
      setTitle("");
      setPrompt("");
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteMutation.mutateAsync(deleting.document_generation_id);
      toast.success("Generated document deleted");
      setDeleting(null);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Documentation"
        description="Describe what you need and Groq will draft it for you"
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Generate a document
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Project</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {(projects ?? []).map((p) => (
                    <SelectItem key={p.project_id} value={p.project_id}>
                      {p.project_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="document_type">Document type</Label>
              <Input
                id="document_type"
                placeholder="Project Charter, Status Report, Retrospective..."
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="Website Redesign — Q3 Status Report"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prompt">What should this document cover?</Label>
            <Textarea
              id="prompt"
              rows={5}
              placeholder="Describe the goals, scope, key stakeholders, and anything else the document should include..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              The more specific you are here, the more useful the result — vague prompts produce generic filler.
            </p>
          </div>

          <Button onClick={handleGenerate} disabled={!canGenerate}>
            {generateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Past generations</h2>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : !documents || documents.length === 0 ? (
          <Card>
            <CardContent className="p-5">
              <EmptyState
                icon={FileStack}
                title="No documents generated yet"
                description="Use the form above to generate your first AI document."
              />
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => (
              <Card key={doc.document_generation_id}>
                <CardContent className="flex items-start justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-foreground">{doc.title}</p>
                      <Badge variant="secondary">{doc.document_type}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {projectName(doc.project_id)} · {formatDate(doc.created_at)} · {doc.ai_model}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setViewing(doc)}>
                      View
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleting(doc)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!viewing} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewing?.title}</DialogTitle>
            <DialogDescription>
              {viewing?.document_type} · Generated {viewing && formatDate(viewing.created_at)}
            </DialogDescription>
          </DialogHeader>
          <div className="whitespace-pre-wrap rounded-lg bg-muted/40 p-4 text-sm text-foreground">
            {viewing?.generated_content}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete generated document?"
        description={`This will permanently delete "${deleting?.title}". This action cannot be undone.`}
        onConfirm={confirmDelete}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
