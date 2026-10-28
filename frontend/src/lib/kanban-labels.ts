export function normalizeKanbanLabelKey(value: string) {
  return value.trim().toLocaleLowerCase();
}

export function labelTextColor(color: string) {
  const match = /^#([0-9a-f]{6})$/i.exec(color);
  if (!match) return "#FFFFFF";
  const value = match[1];
  const channels = [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16) / 255);
  const linear = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  return luminance > 0.42 ? "#0F172A" : "#FFFFFF";
}
