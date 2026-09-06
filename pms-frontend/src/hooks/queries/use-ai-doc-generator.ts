import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { aiDocGeneratorApi, generateDocument } from "@/lib/api/ai-doc-generator";
import type { AIDocumentGenerationRequest } from "@/types/ai";

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
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AIDocumentGenerationRequest) => generateDocument(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteGeneratedDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => aiDocGeneratorApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY] }),
  });
}
