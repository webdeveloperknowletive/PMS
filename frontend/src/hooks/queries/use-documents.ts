"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { documentsApi } from "@/lib/api/documents";
import type { DocumentCreate, DocumentUpdate } from "@/types/document";

const KEY = "documents";

export function useDocuments(enabled = true) {
  return useQuery({
    queryKey: [KEY],
    queryFn: () => documentsApi.list({ limit: 500 }),
    enabled,
  });
}

export function useProjectDocuments(projectId: string | undefined) {
  return useQuery({
    queryKey: [KEY, "project", projectId],
    queryFn: () => documentsApi.getProjectDocuments(projectId!, { limit: 500 }),
    enabled: !!projectId,
  });
}

export function useCreateDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: DocumentCreate) => documentsApi.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: DocumentUpdate }) => documentsApi.update(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => documentsApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: documentsApi.upload,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useReplaceDocumentFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => documentsApi.replaceFile(id, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY] }),
  });
}
