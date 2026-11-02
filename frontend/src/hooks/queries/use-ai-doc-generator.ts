import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { aiDocGeneratorApi, generateDocument, saveDocument } from "@/lib/api/ai-doc-generator";
import type { AIDocumentGenerationRequest, GeneratedDocumentPreview } from "@/types/ai";

const KEY = "ai-document-generations";

export function useGeneratedDocuments() {
  return useQuery({
    queryKey: [KEY],
    queryFn: () => aiDocGeneratorApi.list(),
  });
}

export function useGeneratedDocument(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, id],
    queryFn: () => aiDocGeneratorApi.get(id as string),
    enabled: !!id,
  });
}

/** Calls Groq server-side — this can take a few seconds, unlike other
 *  mutations in the app, since it's waiting on an LLM response. */
export function useGenerateDocument() {
  return useMutation({
    mutationFn: (payload: AIDocumentGenerationRequest): Promise<GeneratedDocumentPreview> => generateDocument(payload),
  });
}

export function useSaveGeneratedDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveDocument,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function usePublishGeneratedDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => aiDocGeneratorApi.publish(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [KEY] });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

export function useDeleteGeneratedDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => aiDocGeneratorApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY] }),
  });
}
