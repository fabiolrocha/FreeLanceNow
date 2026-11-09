import { useEffect, useState } from 'react'
import { useApp } from './store'
import { inbox } from '../data/inbox'
import { isMock } from '../data/client'

const EVENT = 'fln-unread'
const POLL_MS = 30000

// Lets a page that already loaded the inbox update the header badge without another request.
export function publishUnread(count: number) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: count }))
}

export function useUnreadCount() {
  const { user, contracts } = useApp(),
    [count, setCount] = useState(0)
  useEffect(() => {
    const listen = (e: Event) => setCount((e as CustomEvent<number>).detail)
    window.addEventListener(EVENT, listen)
    return () => window.removeEventListener(EVENT, listen)
  }, [])
  useEffect(() => {
    if (!user) return
    let active = true
    const load = () =>
      inbox
        .unread(user, contracts)
        .then((n) => active && setCount(n))
        .catch(() => {})
    void load()
    const timer = isMock ? undefined : setInterval(load, POLL_MS)
    return () => {
      active = false
      clearInterval(timer)
    }
    // The mock badge follows contract changes; the API badge polls.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [user?.id, isMock ? contracts : null])
  return user ? count : 0
}
