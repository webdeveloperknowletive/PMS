"use client";

import { useState } from "react";
import { Loader2, Info } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateReport } from "@/hooks/queries/use-reports";
import { useProjects } from "@/hooks/queries/use-projects";
import { useTasks } from "@/hooks/queries/use-tasks";
import { useUsers } from "@/hooks/queries/use-users";
import { useMilestones } from "@/hooks/queries/use-milestones";
import { useAuthStore } from "@/store/auth-store";
import { generateProjectSummaryCsv, generateTaskReportCsv } from "@/lib/report-generators";
import { getApiErrorMessage } from "@/lib/api/client";
import { REPORT_FORMATS } from "@/lib/constants";

const REPORT_TYPES = ["Task Report", "Project Summary"] as const;

export function ReportFormDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data: projects } = useProjects();
  const { data: tasks } = useTasks({ limit: 500 });
  const { data: users } = useUsers();
  const { data: milestones } = useMilestones();
  const currentUser = useAuthStore((s) => s.user);
  const createMutation = useCreateReport();

  const [projectId, setProjectId] = useState("");
  const [reportType, setReportType] = useState<(typeof REPORT_TYPES)[number]>("Task Report");
  const [format, setFormat] = useState<(typeof REPORT_FORMATS)[number]>("CSV");
  const [isGenerating, setIsGenerating] = useState(false);

  const userMap = new Map((users ?? []).map((u) => [u.user_id, u]));

  const handleGenerate = async () => {
    if (!projectId) {
      toast.error("Select a project first");
      return;
    }
    const project = (projects ?? []).find((p) => p.project_id === projectId);
    if (!project) return;

    setIsGenerating(true);
    try {
      if (format === "CSV") {
        if (reportType === "Task Report") {
          generateTaskReportCsv(project.project_name, (tasks ?? []).filter((t) => t.project_id === projectId), userMap);
        } else {
          generateProjectSummaryCsv(
            project,
            (tasks ?? []).filter((t) => t.project_id === projectId),
            (milestones ?? []).filter((m) => m.project_id === projectId)
          );
        }
      }

      // Always log the report request, even for PDF/Excel where no file is actually produced yet.
      await createMutation.mutateAsync({
        project_id: projectId,
        generated_by: currentUser?.user_id ?? null,
        report_name: `${project.project_name} — ${reportType}`,
        report_type: reportType,
        report_format: format,
        file_url: null,
        status: format === "CSV" ? "Completed" : "Logged — file generation not yet available for this format",
      });

      toast.success(format === "CSV" ? "Report downloaded" : "Report request logged");
      onOpenChange(false);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate Report</DialogTitle>
          <DialogDescription>Export project data as a report.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Project</Label>
            <Select value={projectId} onValueChange={setProjectId}>
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
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Report type</Label>
              <Select value={reportType} onValueChange={(v) => setReportType(v as typeof reportType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Format</Label>
              <Select value={format} onValueChange={(v) => setFormat(v as typeof format)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_FORMATS.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {format !== "CSV" && (
            <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {format} generation isn&apos;t wired up on the backend yet — this will log the request but won&apos;t
              produce a downloadable file. Choose CSV for a real export.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={!projectId || isGenerating}>
            {isGenerating && <Loader2 className="h-4 w-4 animate-spin" />}
            Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}