"use client";

import { Check } from "lucide-react";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { KanbanColorPalette } from "@/components/modules/kanban/kanban-color-palette";
import { useKanbanLabels } from "@/hooks/queries/use-kanban";

/** Select a direct task color or an existing named workspace label. */
export function KanbanLabelColorPicker({
  value,
  onChange,
  required = false,
  disabled = false,
}: {
  value: string;
  onChange: (labelKeyOrColor: string) => void;
  required?: boolean;
  disabled?: boolean;
}) {
  const { data: labels = [], isLoading, isError } = useKanbanLabels(true);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const directColor = /^#[0-9a-f]{6}$/i.test(value);
  const selected = labels.find((label) => label.label_key === value);
  const [customColor, setCustomColor] = useState(directColor ? value : "#579DFF");
  const filtered = useMemo(() => labels.filter((label) => label.name.toLowerCase().includes(search.trim().toLowerCase())), [labels, search]);
  const chooseColor = (color: string) => {
    const normalized = color.toLowerCase();
    setCustomColor(normalized);
    onChange(normalized);
    setOpen(false);
  };

  return <fieldset className="space-y-1.5" aria-required={required}>
    <legend className="text-sm font-medium">Label{required ? " *" : ""}</legend>
    <div className="relative">
      <Button type="button" variant="outline" disabled={disabled} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((current) => !current)} className="w-full justify-start gap-2">
        {selected ? <><span className="h-5 w-10 rounded border" style={{ backgroundColor: selected.color }} /><span>{selected.name}</span><Check className="ml-auto h-4 w-4" /></> : directColor ? <><span className="h-5 w-10 rounded border" style={{ backgroundColor: value }} /><span>Color selected</span><Check className="ml-auto h-4 w-4" /></> : <span>Choose a color</span>}
      </Button>
      {open && <div role="dialog" aria-label="Choose label color" className="absolute left-0 top-full z-50 mt-2 w-full rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg sm:w-80" onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}>
        <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">Choose a color</h3><Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Close</Button></div>
        <p className="mb-2 text-xs font-medium">Ready colors</p>
        <KanbanColorPalette value={directColor ? value : customColor} onChange={chooseColor} custom={false} />
        <label className="mt-3 flex items-center justify-between gap-2 border-t pt-3 text-xs font-medium">Custom color<Input type="color" aria-label="Choose a custom task color" className="h-9 w-12 p-1" value={directColor ? value : customColor} onChange={(event) => { const color = event.target.value.toLowerCase(); setCustomColor(color); onChange(color); }} /></label>
        {!isError && labels.length > 0 && <div className="mt-3 border-t pt-3"><p className="mb-2 text-xs font-medium">Saved label templates</p><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search labels…" aria-label="Search saved labels" /><div className="mt-2 max-h-36 space-y-2 overflow-y-auto">{filtered.map((label) => <button key={label.label_id} type="button" onClick={() => { onChange(label.label_key); setOpen(false); setSearch(""); }} className="flex w-full items-center gap-2 rounded p-1 text-left hover:bg-muted"><span className="h-7 flex-1 rounded" style={{ backgroundColor: label.color }} /><span className="sr-only">{label.name}</span>{value === label.label_key && <Check className="h-4 w-4" />}</button>)}{filtered.length === 0 && <p className="py-2 text-center text-xs text-muted-foreground">No matching labels.</p>}</div></div>}
        {isError && <p role="alert" className="mt-3 border-t pt-2 text-xs text-destructive">Saved labels could not be loaded. You can still choose a direct color.</p>}
      </div>}
    </div>
    {!isLoading && required && !value && <p className="text-xs text-destructive">Choose a color before saving this task.</p>}
  </fieldset>;
}
