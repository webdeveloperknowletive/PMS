"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IterationCw } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ProjectWorkPanel } from "@/components/modules/projects/project-work-panel";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProjects } from "@/hooks/queries/use-projects";
import { Skeleton } from "@/components/ui/skeleton";

export default function SprintPlanningPage() {
  const router = useRouter();
  const { data: projects = [], isLoading, isError } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const selectedProject = projects.find((project) => project.project_id === selectedProjectId) ?? projects[0];

  return (
    <div className="space-y-5">
      <PageHeader title="Sprint Planning" description="Plan work from a project backlog, organize it into sprints, and track delivery." />
      {isLoading ? (
        <Skeleton className="h-12 w-full max-w-md" />
      ) : isError ? (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">Projects could not be loaded. Refresh the page and try again.</p>
      ) : projects.length === 0 ? (
        <EmptyState icon={IterationCw} title="No projects available" description="Create a project before planning a sprint." actionLabel="Open projects" onAction={() => router.push("/projects")} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
            <label htmlFor="sprint-project" className="text-sm font-medium text-slate-700">Project</label>
            <Select value={selectedProject?.project_id ?? ""} onValueChange={setSelectedProjectId}>
              <SelectTrigger id="sprint-project" className="w-full max-w-md"><SelectValue placeholder="Choose a project" /></SelectTrigger>
              <SelectContent>{projects.map((project) => <SelectItem key={project.project_id} value={project.project_id}>{project.project_name} · {project.project_key}</SelectItem>)}</SelectContent>
            </Select>
            {selectedProject && <Button asChild variant="outline" size="sm"><Link href={`/projects/${selectedProject.project_id}#project-work`}>Open project</Link></Button>}
          </div>
          {selectedProject && <ProjectWorkPanel key={selectedProject.project_id} projectId={selectedProject.project_id} initialTab="backlog" />}
        </>
      )}
    </div>
  );
}
