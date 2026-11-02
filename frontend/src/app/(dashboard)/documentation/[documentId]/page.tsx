"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { RecordDetailPage, type DetailField } from "@/components/shared/record-detail-page";
import { useDocuments, useUpdateDocument } from "@/hooks/queries/use-documents";
import { usePermissions } from "@/hooks/use-permissions";
import type { DocumentUpdate } from "@/types/document";
import { Button } from "@/components/ui/button";
import { documentsApi } from "@/lib/api/documents";
import { getApiErrorMessage } from "@/lib/api/client";
import { toast } from "sonner";
export default function DocumentDetailPage() {
  const { documentId } = useParams<{ documentId: string }>();
  const { data = [], isLoading } = useDocuments();
  const update = useUpdateDocument();
  const { canUploadDocuments } = usePermissions();
  const item = data.find((entry) => entry.document_id === documentId);
  if (isLoading) return <p>Loading document…</p>;
  if (!item) return <p>Document unavailable.</p>;
  const fields: DetailField[] = [
    { label: "Title", key: "title", value: item.title, required: true },
    { label: "Version", key: "version", value: item.version, required: true },
    { label: "Type", value: item.resource_type },
    { label: "Project", value: item.project_id, display: <Link href={"/projects/" + item.project_id} className="text-[#0c66e4] hover:underline">Open project</Link> },
    { label: "Resource URL", key: item.resource_type === "FILE" || item.resource_type === "AI_DOC" ? undefined : "file_url", value: item.file_url, parse: (value) => value || null },
    { label: "Filename", value: item.original_filename },
    { label: "File size", value: item.file_size ? (item.file_size / 1024).toFixed(1) + " KB" : "" },
    ...(item.content ? [{ label: "Content", value: item.content, type: "textarea" as const }] : []),
  ];
  return <RecordDetailPage title={item.title} subtitle="Project resource" backHref="/documentation" backLabel="Documentation" fields={fields} canEdit={canUploadDocuments && item.resource_type !== "AI_DOC"} onSave={async (key, value) => { await update.mutateAsync({ id: documentId, payload: { [key]: value } as DocumentUpdate }); }}>
    {item.resource_type === "FILE" ? <Button variant="outline" onClick={() => void documentsApi.download(item.document_id, item.original_filename || item.title).catch((error) => toast.error(getApiErrorMessage(error)))}>Download file</Button> : item.file_url ? <Button asChild variant="outline"><a href={item.file_url} target="_blank" rel="noopener noreferrer">Open resource</a></Button> : null}
  </RecordDetailPage>;
}
