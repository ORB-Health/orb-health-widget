/** Tiny localStorage wrapper that stores all harness state under one key. */

import { useState, useEffect, Dispatch, SetStateAction } from 'react'

const STORAGE_KEY = 'orb-widget-test-harness'

export function loadStored<T>(field: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    return field in parsed ? (parsed[field] as T) : fallback
  } catch {
    return fallback
  }
}

export function saveStored(field: string, value: unknown) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    parsed[field] = value
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
  } catch {
    /* ignore */
  }
}

/** useState whose value is persisted to localStorage under `key`. */
export function usePersistedState<T>(
  key: string,
  fallback: T | (() => T)
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    const fb = typeof fallback === 'function' ? (fallback as () => T)() : fallback
    return loadStored<T>(key, fb)
  })
  useEffect(() => { saveStored(key, value) }, [key, value])
  return [value, setValue]
}
