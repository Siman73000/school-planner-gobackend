const LS_KEY = "school_planner_offline_cache_v2"

export function saveOfflineCache(state: unknown) {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ t: Date.now(), state })) } catch {}
}

export function loadOfflineCache<T>(): T | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return (parsed?.state ?? null) as T | null
  } catch { return null }
}

export function clearOfflineCache() {
  try { localStorage.removeItem(LS_KEY) } catch {}
}
