"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TaskActivityDialog } from "@/components/modules/tasks/task-activity-dialog";
import { useTaskDependencies } from "@/hooks/queries/use-tasks";
import { useTask } from "@/hooks/queries/use-tasks";
import { formatDate } from "@/lib/utils";
import type { Project } from "@/types/project";
import type { User } from "@/types/user";

const ALL = "__all__";
const UNASSIGNED = "__unassigned__";
const PAGE_SIZE = 50;

export function TaskDependencyPanel({ projects, users }: { projects: Project[]; users: User[] }) {
  const [projectId, setProjectId] = useState(ALL);
  const [ownerId, setOwnerId] = useState(ALL);
  const [search, setSearch] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [activeTaskId, setActiveTaskId] = useState<string>();
  const params = useMemo(() => ({
    skip: page * PAGE_SIZE,
    limit: PAGE_SIZE,
    project_id: projectId === ALL ? undefined : projectId,
    owner_id: ownerId !== ALL && ownerId !== UNASSIGNED ? ownerId : undefined,
    unassigned: ownerId === UNASSIGNED ? true : undefined,
    overdue: overdueOnly ? true : undefined,
    search: search.trim() || undefined,
  }), [page, projectId, ownerId, overdueOnly, search]);
  const { data, isLoading, isError, refetch } = useTaskDependencies(params);
  const { data: activeTask } = useTask(activeTaskId);
  const totalPages = Math.max(1, Math.ceil((data?.total_count ?? 0) / PAGE_SIZE));

  const clearFilters = () => {
    setProjectId(ALL);
    setOwnerId(ALL);
    setSearch("");
    setOverdueOnly(false);
    setPage(0);
  };

  return <>
    <Card className="border-amber-100">
      <CardHeader className="gap-1 border-b border-slate-100 px-4 py-4 sm:px-5">
        <CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4 text-amber-600" />Open dependencies across your projects</CardTitle>
        <CardDescription>Find unfinished work blocked by another task. Results follow your workspace and project access.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Input aria-label="Search dependency tasks" placeholder="Search task or project" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} className="w-full sm:max-w-xs" maxLength={120} />
          <Select value={projectId} onValueChange={(value) => { setProjectId(value); setPage(0); }}>
            <SelectTrigger aria-label="Filter dependencies by project" className="w-full sm:w-52"><SelectValue placeholder="All projects" /></SelectTrigger>
            <SelectContent><SelectItem value={ALL}>All projects</SelectItem>{projects.map((project) => <SelectItem key={project.project_id} value={project.project_id}>{project.project_name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={ownerId} onValueChange={(value) => { setOwnerId(value); setPage(0); }}>
            <SelectTrigger aria-label="Filter dependencies by owner" className="w-full sm:w-52"><SelectValue placeholder="All owners" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All owners</SelectItem>
              <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
              {users.map((user) => <SelectItem key={user.user_id} value={user.user_id}>{user.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button type="button" variant={overdueOnly ? "default" : "outline"} onClick={() => { setOverdueOnly((value) => !value); setPage(0); }} aria-pressed={overdueOnly}>Overdue</Button>
          {(projectId !== ALL || ownerId !== ALL || search || overdueOnly) && <Button type="button" variant="ghost" onClick={clearFilters}><RotateCcw className="h-4 w-4" />Clear filters</Button>}
        </div>

        <p className="text-xs text-muted-foreground">{data?.total_count ?? 0} open blocking {data?.total_count === 1 ? "dependency" : "dependencies"}</p>
        {isLoading ? <Skeleton className="h-40 w-full" /> : isError ? <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm"><p>Could not load dependencies.</p><Button type="button" variant="link" onClick={() => void refetch()}>Try again</Button></div> : !data?.items.length ? <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">No open dependencies match these filters.</p> : <>
          <div className="overflow-x-auto rounded-lg border border-slate-100">
            <Table>
              <TableHeader><TableRow><TableHead>Project</TableHead><TableHead>Blocking task</TableHead><TableHead aria-label="Relationship" /><TableHead>Waiting task</TableHead><TableHead>Owner</TableHead><TableHead>Due date</TableHead></TableRow></TableHeader>
              <TableBody>{data.items.map((item) => <TableRow key={item.link_id}>
                <TableCell className="min-w-32">{item.project_name}</TableCell>
                <TableCell className="min-w-40"><button type="button" className="text-left font-medium text-violet-700 underline-offset-4 hover:underline" onClick={() => setActiveTaskId(item.source_task_id)}>{item.source_task_name}</button></TableCell>
                <TableCell><ArrowRight className="h-4 w-4 text-amber-600" aria-label="blocks" /></TableCell>
                <TableCell className="min-w-40"><button type="button" className="text-left font-medium text-violet-700 underline-offset-4 hover:underline" onClick={() => setActiveTaskId(item.target_task_id)}>{item.target_task_name}</button></TableCell>
                <TableCell className="min-w-28">{item.owner_name ?? "Unassigned"}</TableCell>
                <TableCell className="whitespace-nowrap">{formatDate(item.target_due_date)}</TableCell>
              </TableRow>)}</TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">Page {page + 1} of {totalPages}</p>
            <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setPage((value) => Math.max(0, value - 1))} disabled={page === 0}>Previous</Button><Button size="sm" variant="outline" onClick={() => setPage((value) => Math.min(totalPages - 1, value + 1))} disabled={page + 1 >= totalPages}>Next</Button></div>
          </div>
        </>}
      </CardContent>
    </Card>
    {activeTask && <TaskActivityDialog task={activeTask} open={!!activeTaskId} onOpenChange={(open) => !open && setActiveTaskId(undefined)} canComment={false} />}
  </>;
}
