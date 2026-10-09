"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateDocument, useReplaceDocumentFile, useUpdateDocument, useUploadDocument } from "@/hooks/queries/use-documents";
import { useProjects } from "@/hooks/queries/use-projects";
import { getApiErrorMessage } from "@/lib/api/client";
import type { Document } from "@/types/document";

type ResourceType = "FILE" | "GITHUB" | "DRIVE";
const schema = z.object({
  project_id: z.string().min(1, "Project is required"),
  title: z.string().min(2, "Title is required"),
  version: z.string().min(1, "Version is required"),
  file_url: z.string().url("Enter a valid link").optional().or(z.literal("")),
});
type FormValues = z.infer<typeof schema>;

export function DocumentFormDialog({
  open,
  onOpenChange,
  document,
  resourceType,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document?: Document | null;
  resourceType: ResourceType;
}) {
  const isEditing = !!document;
  const { data: projects } = useProjects();
  const createMutation = useCreateDocument();
  const uploadMutation = useUploadDocument();
  const replaceMutation = useReplaceDocumentFile();
  const updateMutation = useUpdateDocument();
  const [file, setFile] = useState<File | null>(null);
  const isSaving = createMutation.isPending || uploadMutation.isPending || replaceMutation.isPending || updateMutation.isPending;
  const { register, handleSubmit, control, reset, setError, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { project_id: "", title: "", version: "1.0", file_url: "" },
  });

  useEffect(() => {
    if (open) {
      setFile(null);
      reset(document
        ? { project_id: document.project_id, title: document.title, version: document.version, file_url: document.file_url ?? "" }
        : { project_id: "", title: "", version: "1.0", file_url: "" });
    }
  }, [open, document, reset]);

  const onSubmit = async (values: FormValues) => {
    try {
      if (resourceType === "FILE") {
        if (isEditing && document) {
          await updateMutation.mutateAsync({ id: document.document_id, payload: { title: values.title, version: values.version } });
          if (file) await replaceMutation.mutateAsync({ id: document.document_id, file });
          toast.success(file ? "File updated" : "File details updated");
        } else {
          if (!file) {
            setError("root", { message: "Choose a file to upload." });
            return;
          }
          await uploadMutation.mutateAsync({ project_id: values.project_id, title: values.title, version: values.version, file });
          toast.success("File uploaded");
        }
      } else {
        if (!values.file_url) {
          setError("file_url", { message: "Enter a link." });
          return;
        }
        const linkPayload = {
          title: values.title,
          version: values.version,
          file_url: values.file_url || null,
          resource_type: resourceType,
        };
        if (isEditing && document) {
          await updateMutation.mutateAsync({ id: document.document_id, payload: linkPayload });
          toast.success("Link updated");
        } else {
          await createMutation.mutateAsync({ ...linkPayload, project_id: values.project_id });
          toast.success("Link added");
        }
      }
      onOpenChange(false);
    } catch (err) {
      setError("root", { message: getApiErrorMessage(err) });
    }
  };

  const typeTitle = resourceType === "FILE" ? "File" : resourceType === "GITHUB" ? "GitHub link" : "Drive link";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? `Edit ${typeTitle}` : `Add ${typeTitle}`}</DialogTitle>
          <DialogDescription>
            {resourceType === "FILE" ? "Upload a project file of any type." : "Add a link your project team can open."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="resource-title">Title</Label>
            <Input id="resource-title" placeholder="e.g. API requirements" {...register("title")} />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Project</Label>
            <Controller control={control} name="project_id" render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} disabled={isEditing}>
                <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>{(projects ?? []).map((project) => <SelectItem key={project.project_id} value={project.project_id}>{project.project_name}</SelectItem>)}</SelectContent>
              </Select>
            )} />
            {errors.project_id && <p className="text-xs text-destructive">{errors.project_id.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="resource-version">Version</Label>
            <Input id="resource-version" placeholder="1.0" {...register("version")} />
            {errors.version && <p className="text-xs text-destructive">{errors.version.message}</p>}
          </div>
          {resourceType === "FILE" ? (
            <div className="space-y-1.5">
              <Label htmlFor="resource-file">{isEditing ? "Replace file (optional)" : "Choose file"}</Label>
              <Input id="resource-file" type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
              {document?.original_filename && !file && <p className="text-xs text-muted-foreground">Current file: {document.original_filename}</p>}
              <p className="text-xs text-muted-foreground">Any file type is accepted.</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="resource-link">{resourceType === "GITHUB" ? "GitHub URL" : "Drive URL"}</Label>
              <Input id="resource-link" type="url" placeholder={resourceType === "GITHUB" ? "https://github.com/organization/repository" : "https://drive.google.com/..."} {...register("file_url")} />
              {errors.file_url && <p className="text-xs text-destructive">{errors.file_url.message}</p>}
            </div>
          )}
          {errors.root && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{errors.root.message}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>{isSaving && <Loader2 className="h-4 w-4 animate-spin" />}{isEditing ? "Save changes" : resourceType === "FILE" ? "Upload file" : "Add link"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
