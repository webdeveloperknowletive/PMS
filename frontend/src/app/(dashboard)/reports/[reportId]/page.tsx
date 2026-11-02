"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { RecordDetailPage, type DetailField } from "@/components/shared/record-detail-page";
import { useReports, useUpdateReport } from "@/hooks/queries/use-reports";
import { usePermissions } from "@/hooks/use-permissions";
import type { ReportUpdate } from "@/types/report";
export default function ReportDetailPage() {
  const { reportId } = useParams<{ reportId: string }>();
  const { data = [], isLoading } = useReports();
  const update = useUpdateReport();
  const { canManageReports } = usePermissions();
  const item = data.find((entry) => entry.report_id === reportId);
  if (isLoading) return <p>Loading report…</p>;
  if (!item) return <p>Report unavailable.</p>;
  const fields: DetailField[] = [
    { label: "Name", value: item.report_name },
    { label: "Type", value: item.report_type },
    { label: "Format", value: item.report_format },
    { label: "Status", key: "status", value: item.status, type: "select", options: ["PENDING", "PROCESSING", "COMPLETED", "FAILED"].map((value) => ({ value, label: value })) },
    { label: "File URL", key: "file_url", value: item.file_url, parse: (value) => value || null },
    { label: "Project", value: item.project_id, display: <Link href={"/projects/" + item.project_id} className="text-[#0c66e4] hover:underline">Open project</Link> },
  ];
  return <RecordDetailPage title={item.report_name} subtitle="Generated report" backHref="/reports" backLabel="All reports" fields={fields} canEdit={canManageReports} onSave={async (key, value) => { await update.mutateAsync({ id: reportId, payload: { [key]: value } as ReportUpdate }); }} />;
}
