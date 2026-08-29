export function formatDateOnly(value: string | Date | null | undefined) {
  if (!value) return "—";
  const raw = value instanceof Date ? value.toISOString() : String(value);
  const [year, month, day] = raw.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return "—";
  return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" }).format(new Date(year, month - 1, day));
}
