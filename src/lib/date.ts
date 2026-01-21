export function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function addDays(d: Date, days: number) {
  return new Date(d.getTime() + days * 86400000)
}

export function formatShortDate(d: Date) {
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
}

export function toISOFromDatetimeLocal(v: string) {
  if (!v) return undefined
  const dt = new Date(v)
  if (isNaN(dt.getTime())) return undefined
  return dt.toISOString()
}

export function toDatetimeLocalFromISO(iso?: string) {
  if (!iso) return ""
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  const yyyy = d.getFullYear()
  const mm = pad(d.getMonth() + 1)
  const dd = pad(d.getDate())
  const hh = pad(d.getHours())
  const mi = pad(d.getMinutes())
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
}

export function monthGrid(year: number, monthIndex: number, weekStartsOn: 0 | 1) {
  const first = new Date(year, monthIndex, 1)
  const firstDow = first.getDay()
  const offset = (firstDow - weekStartsOn + 7) % 7
  const start = addDays(first, -offset)
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}

export function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n))
}
