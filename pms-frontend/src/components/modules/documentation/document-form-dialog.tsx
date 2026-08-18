"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateDocument, useUpdateDocument } from "@/hooks/queries/use-documents";
import { useProjects } from "@/hooks/queries/use-projects";
import { getApiErrorMessage } from "@/lib/api/client";
import type { Document } from "@/types/document";

const schema = z.object({
  project_id: z.string().min(1, "Project is required"),
  title: z.string().min(2, "Title is required"),
  version: z.string().min(1, "Version is required"),
  file_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
});
type FormValues = z.infer<typeof schema>;

export function DocumentFormDialog({
  open,
  onOpenChange,
  document,
  defaultProjectId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document?: Document | null;
  defaultProjectId?: string;
}) {
  const isEditing = !!document;
  const { data: projects } = useProjects();
  const createMutation = useCreateDocument();
  const updateMutation = useUpdateDocument();
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { project_id: defaultProjectId ?? "", title: "", version: "1.0", file_url: "" },
  });

  useEffect(() => {
    if (open) {
      reset(
        document
          ? {
              project_id: document.project_id,
              title: document.title,
              version: document.version,
              file_url: document.file_url ?? "",
            }
          : { project_id: defaultProjectId ?? "", title: "", version: "1.0", file_url: "" }
      );
    }
  }, [open, document, defaultProjectId, reset]);

  const onSubmit = async (values: FormValues) => {
    const payload = { ...values, file_url: values.file_url || null };
    try {
      if (isEditing && document) {
        await updateMutation.mutateAsync({ id: document.document_id, payload });
        toast.success("Document updated");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Document added");
      }
      onOpenChange(false);
    } catch (err) {
      setError("root", { message: getApiErrorMessage(err) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Document" : "New Document"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update this document's details." : "Register a document for this project."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" placeholder="e.g. Project Requirement Specification" {...register("title")} />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Project</Label>
            <Controller
              control={control}
              name="project_id"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    {(projects ?? []).map((p) => (
                      <SelectItem key={p.project_id} value={p.project_id}>
                        {p.project_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.project_id && <p className="text-xs text-destructive">{errors.project_id.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="version">Version</Label>
              <Input id="version" placeholder="1.0" {...register("version")} />
              {errors.version && <p className="text-xs text-destructive">{errors.version.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="file_url">File link</Label>
            <Input id="file_url" placeholder="https://... (Google Drive, SharePoint, etc.)" {...register("file_url")} />
            {errors.file_url && <p className="text-xs text-destructive">{errors.file_url.message}</p>}
            <p className="text-xs text-muted-foreground">
              This system stores a link to the file, not the file itself — upload it somewhere (Drive, S3, etc.) first.
            </p>
          </div>

          {errors.root && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{errors.root.message}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEditing ? "Save changes" : "Add document"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}