/**
 * Drop fields whose value is '' / null / undefined. The ORB API's enum and
 * date converters reject empty strings with 400, so we strip them before
 * sending PATCH/POST bodies.
 */
export function stripEmpty<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== '' && v !== undefined && v !== null)
  ) as Partial<T>
}

/**
 * Accepts ISO (1990-01-01), UK slash (28/12/1990), or US slash (12/28/1990)
 * and returns ISO YYYY-MM-DD. When the slash form is ambiguous (both parts
 * <= 12) we prefer UK interpretation. Returns the original string if it
 * can't be parsed so the backend rejects it and the user sees a real error.
 */
export function normalizeDob(raw: string): string {
  const s = raw.trim()
  if (!s) return s
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/)
  if (!m) return s
  const a = Number(m[1]), b = Number(m[2]), y = m[3]
  const [dd, mm] = a > 12 ? [a, b]
    : b > 12 ? [b, a]
    : [a, b]
  return `${y}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
}
