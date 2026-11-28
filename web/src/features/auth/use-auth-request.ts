import { useEffect, useRef, useState } from 'react'

export function useAuthRequest() {
  const operation = useRef<AbortController | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => () => operation.current?.abort(), [])

  async function run(task: (signal: AbortSignal) => Promise<void>) {
    if (operation.current) return
    const controller = new AbortController()
    operation.current = controller
    setBusy(true)
    setError('')
    try {
      await task(controller.signal)
    } catch (e) {
      if (!controller.signal.aborted) setError((e as Error).message)
    } finally {
      operation.current = undefined
      if (!controller.signal.aborted) setBusy(false)
    }
  }

  return { busy, error, setError, run }
}
