const KNOWN_TYPE_COLORS: Record<string, string> = {
  Meeting: "#3B82F6",
  Deadline: "#EF4444",
  Milestone: "#F59E0B",
  Review: "#8B5CF6",
  Planning: "#22C55E",
  Standup: "#06B6D4",
  Holiday: "#EC4899",
};

const FALLBACK_COLORS = ["#3B82F6", "#8B5CF6", "#22C55E", "#F59E0B", "#EC4899", "#06B6D4", "#EF4444"];

export function getEventTypeColor(eventType: string): string {
  if (KNOWN_TYPE_COLORS[eventType]) return KNOWN_TYPE_COLORS[eventType];
  let hash = 0;
  for (let i = 0; i < eventType.length; i++) hash = eventType.charCodeAt(i) + ((hash << 5) - hash);
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
}
