"use client";

import { useMemo, useState } from "react";
import { Plus, MoreHorizontal, Trash2, BarChart3, Search } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ReportFormDialog } from "@/components/modules/reports/report-form-dialog";
import { useDeleteReport, useReports } from "@/hooks/queries/use-reports";
import { useProjects } from "@/hooks/queries/use-projects";
import { formatDate } from "@/lib/utils";
import { getApiErrorMessage } from "@/lib/api/client";
import type { Report } from "@/types/report";

const ALL = "__all__";

const FORMAT_COLOR: Record<string, string> = {
  PDF: "bg-red-100 text-red-700",
  Excel: "bg-green-100 text-green-700",
  CSV: "bg-blue-100 text-blue-700",
};

export default function ReportsPage() {
  const { data: reports, isLoading } = useReports();
  const { data: projects } = useProjects();
  const deleteMutation = useDeleteReport();

  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState(ALL);
  const [formatFilter, setFormatFilter] = useState(ALL);

  const [formOpen, setFormOpen] = useState(false);
  const [deletingReport, setDeletingReport] = useState<Report | null>(null);

  const projectMap = useMemo(() => new Map((projects ?? []).map((p) => [p.project_id, p])), [projects]);

  const filtered = (reports ?? []).filter((r) => {
    if (search && !r.report_name.toLowerCase().includes(search.toLowerCase())) return false;
    if (projectFilter !== ALL && r.project_id !== projectFilter) return false;
    if (formatFilter !== ALL && r.report_format !== formatFilter) return false;
    return true;
  });

  const total = reports?.length ?? 0;
  const thisWeek = (() => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return reports?.filter((r) => new Date(r.generated_at) >= weekAgo).length ?? 0;
  })();
  const csvCount = reports?.filter((r) => r.report_format === "CSV").length ?? 0;

  const confirmDelete = async () => {
    if (!deletingReport) return;
    try {
      await deleteMutation.mutateAsync(deletingReport.report_id);
      toast.success("Report record deleted");
      setDeletingReport(null);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Generate and track project reports"
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" />
            Generate Report
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Reports</p>
            <p className="mt-1 text-2xl font-semibold">{total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Generated This Week</p>
            <p className="mt-1 text-2xl font-semibold text-green-600">{thisWeek}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">CSV Exports</p>
            <p className="mt-1 text-2xl font-semibold text-blue-600">{csvCount}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search reports..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Project" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All Projects</SelectItem>
            {(projects ?? []).map((p) => (
              <SelectItem key={p.project_id} value={p.project_id}>
                {p.project_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={formatFilter} onValueChange={setFormatFilter}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Format" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All Formats</SelectItem>
            <SelectItem value="PDF">PDF</SelectItem>
            <SelectItem value="Excel">Excel</SelectItem>
            <SelectItem value="CSV">CSV</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        {isLoading ? (
          <CardContent className="space-y-3 p-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </CardContent>
        ) : filtered.length === 0 ? (
          <CardContent className="p-5">
            <EmptyState
              icon={BarChart3}
              title="No reports yet"
              description="Generate your first report to see it here."
              actionLabel="Generate Report"
              onAction={() => setFormOpen(true)}
            />
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Report</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Format</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Generated</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.report_id}>
                  <TableCell>
                    <p className="font-medium text-foreground">{r.report_name}</p>
                    <p className="text-xs text-muted-foreground">{r.report_type}</p>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {projectMap.get(r.project_id)?.project_name ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`border-0 font-medium ${FORMAT_COLOR[r.report_format]}`}>
                      {r.report_format}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[220px] truncate text-sm text-muted-foreground" title={r.status}>
                    {r.status}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(r.generated_at)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeletingReport(r)}
                        >
                          <Trash2 />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <ReportFormDialog open={formOpen} onOpenChange={setFormOpen} />

      <ConfirmDialog
        open={!!deletingReport}
        onOpenChange={(open) => !open && setDeletingReport(null)}
        title="Delete report record?"
        description={`This removes "${deletingReport?.report_name}" from the log. It won't undo any CSV already downloaded.`}
        onConfirm={confirmDelete}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}