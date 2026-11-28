import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { ErrorMessage } from '../../components/ui'
import { googleClientId } from '../../data/client'
import type { GoogleCredential } from '../../domain/types'

type GoogleAccountsId = {
  initialize(options: {
    client_id: string
    nonce: string
    callback: (response: { credential: string }) => void
  }): void
  renderButton(
    target: HTMLElement,
    options: { theme: 'outline'; size: 'large'; text: 'continue_with'; locale: string },
  ): void
}

const googleAccounts = () =>
  (window as Window & { google?: { accounts?: { id?: GoogleAccountsId } } }).google?.accounts?.id
let loading: Promise<GoogleAccountsId> | undefined

function loadGoogle() {
  loading ??= new Promise<GoogleAccountsId>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client?hl=pt-BR'
    script.async = true
    function failed() {
      script.remove()
      reject(new Error('Não foi possível carregar o login com Google.'))
    }
    script.onerror = failed
    script.onload = () => {
      const google = googleAccounts()
      if (google) resolve(google)
      else failed()
    }
    document.head.append(script)
  }).catch((error: unknown) => {
    loading = undefined
    throw error
  })
  return loading
}

function base64Url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')
}

export function GoogleButton({
  onCredential,
  forDeletion = false,
}: {
  onCredential: (proof: GoogleCredential) => void
  forDeletion?: boolean
}) {
  const target = useRef<HTMLDivElement>(null)
  const received = useEffectEvent(onCredential)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const element = target.current
    if (!googleClientId || !element) return
    const id = googleClientId
    let active = true
    async function renderButton(target: HTMLDivElement) {
      const secret = crypto.getRandomValues(new Uint8Array(32))
      const hash = base64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', secret)))
      const nonce = forDeletion ? 'delete-account-' + hash : hash
      const google = await loadGoogle()
      if (!active) return
      google.initialize({
        client_id: id,
        nonce,
        callback: ({ credential }) => {
          if (active && credential) received({ credential, verifier: base64Url(secret) })
        },
      })
      google.renderButton(target, {
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        locale: 'pt-BR',
      })
    }
    void renderButton(element).catch(() => {
      if (active) setError('Não foi possível carregar o login com Google.')
    })
    return () => {
      active = false
      element.replaceChildren()
    }
  }, [attempt, forDeletion])

  return (
    <>
      <div ref={target} />
      <ErrorMessage message={error} />
      {error && (
        <button
          className="button secondary"
          type="button"
          onClick={() => {
            setError('')
            setAttempt((previous) => previous + 1)
          }}
        >
          Tentar carregar o Google novamente
        </button>
      )}
    </>
  )
}
