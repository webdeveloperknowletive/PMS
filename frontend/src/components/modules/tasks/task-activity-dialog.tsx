"use client";

import { useEffect, useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAddTaskComment, useTaskActivity, useTaskComments } from "@/hooks/queries/use-tasks";
import { getApiErrorMessage } from "@/lib/api/client";
import type { Task } from "@/types/task";

function formatMoment(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function TaskActivityDialog({ task, open, onOpenChange, canComment = false }: { task: Task | null; open: boolean; onOpenChange: (open: boolean) => void; canComment?: boolean }) {
  const taskId = task?.task_id;
  const { data: comments = [] } = useTaskComments(taskId);
  const { data: activity = [] } = useTaskActivity(taskId);
  const addComment = useAddTaskComment();
  const [content, setContent] = useState("");
  useEffect(() => { if (!open) setContent(""); }, [open]);

  const submit = async () => {
    if (!taskId || !content.trim()) return;
    try { await addComment.mutateAsync({ taskId, content: content.trim() }); setContent(""); }
    catch (error) { toast.error(getApiErrorMessage(error)); }
  };

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader><DialogTitle>{task?.task_name ?? "Task details"}</DialogTitle><DialogDescription>Comments and changes for this task.</DialogDescription></DialogHeader>
      <section className="space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><MessageCircle className="h-4 w-4" />Comments</h3>
        <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg bg-slate-50 p-3">
          {comments.length ? comments.map((comment) => <article key={comment.comment_id} className="rounded-lg border bg-white p-3"><div className="flex justify-between gap-2"><span className="text-xs font-semibold text-slate-800">{comment.author_name ?? "Workspace member"}</span><time className="text-[10px] text-slate-500">{formatMoment(comment.created_at)}</time></div><p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{comment.content}</p></article>) : <p className="py-4 text-center text-xs text-slate-500">No comments yet. Add the first update.</p>}
        </div>
        {canComment ? <div className="flex items-end gap-2"><Textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="Write a comment for your team…" rows={2} /><Button onClick={() => void submit()} disabled={!content.trim() || addComment.isPending} aria-label="Send comment"><Send className="h-4 w-4" /></Button></div> : <p className="text-xs text-slate-500">You can view comments. Only task managers or the assigned teammate can add one.</p>}
      </section>
      <section className="space-y-3 border-t pt-4">
        <h3 className="text-sm font-semibold">Activity history</h3>
        {activity.length ? <ol className="space-y-2">{activity.map((entry) => <li key={entry.activity_id} className="flex gap-3 text-xs"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-violet-500" /><div><p className="text-slate-700"><span className="font-semibold">{entry.actor_name ?? "Workspace member"}</span> {entry.details}</p><time className="text-[10px] text-slate-500">{formatMoment(entry.created_at)}</time></div></li>)}</ol> : <p className="text-xs text-slate-500">No history has been recorded yet.</p>}
      </section>
    </DialogContent>
  </Dialog>;
}
