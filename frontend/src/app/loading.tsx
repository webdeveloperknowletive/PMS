import { Loader2 } from "lucide-react";

export default function Loading() {
  return <div role="status" aria-live="polite" className="flex min-h-screen items-center justify-center gap-3 bg-white text-sm font-medium text-[#44546f]"><Loader2 className="h-6 w-6 animate-spin text-[#0c66e4]" />Loading page…</div>;
}
