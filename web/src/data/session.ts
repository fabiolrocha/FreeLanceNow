import type { Session } from '../domain/types'

const KEY = 'fln-session'

/**
 * "Manter conectado" keeps the session in localStorage (survives closing the browser and is
 * shared between tabs); otherwise it lives in sessionStorage and ends with the tab.
 */
export function loadSession(): Session | null {
  for (const storage of [localStorage, sessionStorage]) {
    try {
      const s = JSON.parse(storage.getItem(KEY) || 'null') as Session | null
      if (s?.accessToken && s.user) return s
    } catch {
      storage.removeItem(KEY)
    }
  }
  return null
}

export function saveSession(s: Session) {
  const target = s.remember === false ? sessionStorage : localStorage
  const other = target === localStorage ? sessionStorage : localStorage
  other.removeItem(KEY)
  target.setItem(KEY, JSON.stringify(s))
}

export function clearSession() {
  localStorage.removeItem(KEY)
  sessionStorage.removeItem(KEY)
}

/** Adds absolute expiry times and keeps the previous "remember" choice when renewing. */
export function timed(s: Session, previous?: Session | null): Session {
  const now = Date.now()
  return {
    ...s,
    remember: s.remember ?? previous?.remember ?? true,
    expiresAt: now + s.expiresIn * 1000,
    refreshExpiresAt: s.refreshExpiresIn ? now + s.refreshExpiresIn * 1000 : undefined,
  }
}

/** A session is usable while either its access token or its refresh token is still valid. */
export function usable(s: Session | null, now = Date.now()): s is Session {
  if (!s) return false
  if ((s.expiresAt || 0) > now) return true
  return !!s.refreshToken && (s.refreshExpiresAt || 0) > now
}
