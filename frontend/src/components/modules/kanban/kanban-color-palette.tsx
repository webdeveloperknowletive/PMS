"use client";

import { Check } from "lucide-react";

// Standard color set used for labels.
export const READY_KANBAN_COLORS = [
  "#4BCE97", "#F5CD47", "#FEA362", "#F87168",
  "#9F8FEF", "#579DFF", "#00B8D9", "#8590A2",
] as const;

export function KanbanColorPalette({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  return <div className="space-y-2" aria-label="Choose a label color">
    <div className="grid grid-cols-8 gap-1.5" role="radiogroup" aria-label="Ready label colors">
      {READY_KANBAN_COLORS.map((color) => <button key={color} type="button" role="radio" aria-checked={value.toLowerCase() === color.toLowerCase()} aria-label={`Color ${color}`} title={color} onClick={() => onChange(color)} className={`flex h-8 items-center justify-center rounded border-2 transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${value.toLowerCase() === color.toLowerCase() ? "border-slate-900 ring-2 ring-primary/40" : "border-transparent"}`} style={{ backgroundColor: color }}>
        {value.toLowerCase() === color.toLowerCase() && <Check className="h-4 w-4 text-slate-900" />}
      </button>)}
    </div>
  </div>;
}
