export const categories = [
  "Power tools",
  "Garden",
  "Kitchen",
  "Camping",
  "Other",
] as const;
export const conditions = ["Like new", "Good", "Well used"] as const;
export function dateRange(
  start: string,
  end: string,
  today = new Date().toISOString().slice(0, 10),
) {
  const valid = (date: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    !Number.isNaN(Date.parse(date)) &&
    new Date(date).toISOString().slice(0, 10) === date;
  if (!valid(start) || !valid(end) || start < today || end < start)
    throw new Error("Choose a valid date range starting today or later (UTC).");
}
// Date-only ranges use UTC and include both the pickup and return day.
export function overlaps(
  a: { start: string; end: string },
  b: { start: string; end: string },
) {
  return a.start <= b.end && b.start <= a.end;
}
export function clean(value: string, label: string, max: number) {
  const result = value.trim();
  if (!result || result.length > max)
    throw new Error(`${label} must contain 1–${max} characters.`);
  return result;
}
