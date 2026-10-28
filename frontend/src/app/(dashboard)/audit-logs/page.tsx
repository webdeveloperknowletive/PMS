"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { auditApi } from "@/lib/api/audit";

const PAGE_SIZE = 100;

export default function AuditLogsPage() {
  const [page, setPage] = useState(0);
  const [method, setMethod] = useState("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [exporting, setExporting] = useState(false);
  const filters = {
    method: method === "ALL" ? undefined : method,
    from_date: fromDate ? new Date(`${fromDate}T00:00:00`).toISOString() : undefined,
    to_date: toDate ? new Date(`${toDate}T23:59:59.999`).toISOString() : undefined,
  };
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["audit-logs", page, filters],
    queryFn: () => auditApi.list({ skip: page * PAGE_SIZE, limit: PAGE_SIZE, ...filters }),
  });

  async function downloadAuditEvents() {
    setExporting(true);
    try {
      const blob = await auditApi.export(filters);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "audit-events.csv";
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Audit log exported (up to 10,000 events)");
    } catch {
      toast.error("Could not export the audit log. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Audit Log" description="Review workspace write actions and their outcomes." actions={<Button variant="outline" size="sm" disabled={exporting} onClick={() => void downloadAuditEvents()}><Download className="h-4 w-4" />{exporting ? "Exporting…" : "Export CSV"}</Button>} />
      <div className="filter-bar">
        <Select value={method} onValueChange={(value) => { setMethod(value); setPage(0); }}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="All actions" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All actions</SelectItem>
            <SelectItem value="POST">Created or submitted</SelectItem>
            <SelectItem value="PUT">Updated</SelectItem>
            <SelectItem value="PATCH">Changed</SelectItem>
            <SelectItem value="DELETE">Deleted</SelectItem>
          </SelectContent>
        </Select>
        <Input aria-label="Audit events from date" className="w-full sm:w-44" type="date" value={fromDate} max={toDate || undefined} onChange={(event) => { setFromDate(event.target.value); setPage(0); }} />
        <Input aria-label="Audit events through date" className="w-full sm:w-44" type="date" value={toDate} min={fromDate || undefined} onChange={(event) => { setToDate(event.target.value); setPage(0); }} />
      </div>
      <Card>
        {isLoading ? <CardContent className="space-y-3 p-5">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</CardContent>
          : events.length === 0 ? <CardContent className="p-5"><EmptyState icon={Activity} title="No audit events found" description="Workspace write actions will appear here." /></CardContent>
            : <Table>
              <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Person</TableHead><TableHead>Action</TableHead><TableHead>Result</TableHead></TableRow></TableHeader>
              <TableBody>{events.map((event) => <TableRow key={event.event_id}>
                <TableCell className="whitespace-nowrap text-sm">{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.created_at))}</TableCell>
                <TableCell><div className="font-medium">{event.actor_name}</div><div className="text-xs text-muted-foreground">{event.actor_roles}</div></TableCell>
                <TableCell><span className="font-mono text-xs">{event.method}</span><span className="ml-2 break-all text-sm">{event.path}</span></TableCell>
                <TableCell><span className={event.status_code < 400 ? "text-emerald-700" : "text-destructive"}>{event.status_code}</span></TableCell>
              </TableRow>)}</TableBody>
            </Table>}
      </Card>
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" disabled={page === 0 || isLoading} onClick={() => setPage((value) => Math.max(0, value - 1))}><ChevronLeft className="mr-1 h-4 w-4" />Previous</Button>
        <span className="text-sm text-muted-foreground">Page {page + 1}</span>
        <Button variant="outline" size="sm" disabled={events.length < PAGE_SIZE || isLoading} onClick={() => setPage((value) => value + 1)}>Next<ChevronRight className="ml-1 h-4 w-4" /></Button>
      </div>
    </div>
  );
}
