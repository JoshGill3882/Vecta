/**
 * Short relative timestamp ("4d ago") for task cards, ported from the Vecta
 * design. Falls back to an absolute date past ~5 weeks, where "9w ago" stops
 * being easier to read than "12 Jun".
 */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";

  const mins = Math.floor(Math.max(0, Date.now() - then) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;

  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;

  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;

  const wks = Math.floor(days / 7);
  if (wks < 5) return `${wks}w ago`;

  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
