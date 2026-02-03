// lib/dateLocal.ts
/**
 * Returns YYYY-MM-DD for the given IANA timezone (e.g. "America/Los_Angeles")
 * using the local calendar day in that zone.
 */
export function localISODate(timeZone: string): string {
  const now = new Date();
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = dtf.formatToParts(now);
  const year = parts.find((p) => p.type === "year")?.value ?? "0000";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}