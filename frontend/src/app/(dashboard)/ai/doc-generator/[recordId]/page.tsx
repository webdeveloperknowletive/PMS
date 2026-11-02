"use client";
import { useParams } from "next/navigation";
import { RecordDetailPage, type DetailField } from "@/components/shared/record-detail-page";
import { Button } from "@/components/ui/button";
import { useGeneratedDocument, usePublishGeneratedDocument } from "@/hooks/queries/use-ai-doc-generator";
import { usePermissions } from "@/hooks/use-permissions";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/api/client";
export default function GeneratedDocumentDetailPage() {
  const { recordId } = useParams<{ recordId: string }>();
  const { data: item, isLoading } = useGeneratedDocument(recordId);
  const publish = usePublishGeneratedDocument();
  const { canUploadDocuments } = usePermissions();
  if (isLoading) return <p>Loading generated document…</p>;
  if (!item) return <p>Generated document unavailable.</p>;
  const fields: DetailField[] = [
    { label: "Title", value: item.title },
    { label: "Type", value: item.document_type },
    { label: "Version", value: item.version },
    { label: "Status", value: item.status },
    { label: "Content", value: item.generated_content, type: "textarea" },
  ];
  return <RecordDetailPage title={item.title} subtitle="Generated document" backHref="/ai/doc-generator" backLabel="AI documentation" fields={fields} canEdit={false} onSave={async () => {}}>
    {canUploadDocuments && !item.published_document_id && <Button onClick={() => void publish.mutateAsync(recordId).then(() => toast.success("Document published")).catch((error) => toast.error(getApiErrorMessage(error)))} disabled={publish.isPending}>Publish to documentation</Button>}
  </RecordDetailPage>;
}
