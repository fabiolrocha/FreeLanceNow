import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { isMock, request } from './client'

// One shared list for the signed-in user, so every heart on the page updates together.
let ids: string[] = [],
  owner = ''
const listeners = new Set<() => void>()
const storageKey = (userId: string) => `fln-mock-favorites:${userId}`

function publish(next: string[], persist = true) {
  ids = next
  if (persist && isMock && owner) sessionStorage.setItem(storageKey(owner), JSON.stringify(next))
  listeners.forEach((l) => l())
}
function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
async function load(userId: string) {
  if (owner === userId) return
  owner = userId
  // Clear the previous user's hearts without overwriting this user's stored list.
  publish([], false)
  try {
    const saved = isMock
      ? (JSON.parse(sessionStorage.getItem(storageKey(userId)) || '[]') as string[])
      : (await request<{ serviceIds: string[] }>('/users/me/favorites')).serviceIds
    if (owner === userId) publish(saved, false)
  } catch {
    // The hearts start empty; saving again still works.
  }
}

/** Saved service ids, newest first, and a toggle that updates the screen before the API answers. */
export function useFavorites(userId: string | undefined) {
  const current = useSyncExternalStore(subscribe, () => ids)
  useEffect(() => {
    if (userId) void load(userId)
    else owner = ''
  }, [userId])
  const toggle = useCallback(async (serviceId: string): Promise<boolean> => {
    const wasSaved = ids.includes(serviceId)
    publish(wasSaved ? ids.filter((x) => x !== serviceId) : [serviceId, ...ids])
    if (isMock) return !wasSaved
    try {
      await request(`/services/${serviceId}/favorite`, { method: wasSaved ? 'DELETE' : 'PUT' })
    } catch (e) {
      publish(wasSaved ? [serviceId, ...ids] : ids.filter((x) => x !== serviceId))
      throw e
    }
    return !wasSaved
  }, [])
  return { ids: userId && owner === userId ? current : [], toggle }
}
