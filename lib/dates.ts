// Date helpers shared by the client (date-picker → API) and the server (API → DB).
// Pure functions only — no `window`, so both helpers are safe on either side.

/**
 * Turn a `<input type="date">` value (and optional `<input type="time">` value) into a
 * real RFC-3339 instant. Anchors to **local noon**, not UTC midnight:
 * `new Date("2026-07-16").toISOString()` parses as UTC midnight, which renders as Jul 15
 * for every viewer west of Greenwich. Noon local keeps the calendar day intact everywhere.
 *
 * A missing/empty time defaults to noon — which also avoids building an invalid
 * `"2026-07-16T:00"` string (the empty-time `RangeError` in the reminder add path).
 */
export function localDateToISO(dateStr: string, timeStr?: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr ? timeStr.split(":").map(Number) : [12, 0];
  return new Date(y, m - 1, d, hh, mm, 0, 0).toISOString();
}

/**
 * Server-side safety net so a bare `YYYY-MM-DD` never 400s again even if a client sends one.
 * Accepts a plain date (→ noon UTC, so it lands on the same calendar day for any viewer) or a
 * full RFC-3339 string, and returns an ISO string — or `null` for empty/unparseable input.
 * Deliberately NOT `z.coerce.date()`, which turns `null` into the Unix epoch.
 */
export function coerceToISO(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(value + "T12:00:00Z").toISOString();
  const t = Date.parse(value);
  return isNaN(t) ? null : new Date(t).toISOString();
}
