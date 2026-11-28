import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ErrorMessage, Field } from '../../components/ui'
import { client, googleClientId } from '../../data/client'
import type { GoogleCredential, GoogleNext, Session } from '../../domain/types'
import { GoogleButton } from './google-button'
import { RegistrationPhone, RegistrationTerms } from './registration-fields'
import { useAuthRequest } from './use-auth-request'

type AccountRole = 'CLIENT' | 'FREELANCER'
type PendingGoogle = Extract<GoogleNext, { next: 'REGISTER' | 'LINK' }> & {
  proof: GoogleCredential
}

export function GoogleEntry({
  children,
  onSignIn,
  initialRole,
  disabled = false,
}: {
  children: (googleBusy: boolean) => ReactNode
  onSignIn: (session: Session, registered: boolean) => void
  initialRole?: AccountRole | null
  disabled?: boolean
}) {
  const [pending, setPending] = useState<PendingGoogle>()
  const { busy, error, setError, run } = useAuthRequest()

  if (!googleClientId) return children(false)

  function identify(proof: GoogleCredential) {
    if (disabled) return
    return run(async (signal) => {
      const result = await client.googleSignIn(proof, signal)
      if (signal.aborted) return
      if (result.next === 'SIGNED_IN') onSignIn(result.session, false)
      else setPending({ ...result, proof })
    })
  }

  function complete(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!pending) return
    const data = new FormData(e.currentTarget)
    return run(async (signal) => {
      if (pending.next === 'LINK') {
        const session = await client.googleLink(pending.proof, String(data.get('password')), signal)
        if (!signal.aborted) onSignIn(session, false)
      } else {
        const role = data.get('role')
        if (role !== 'CLIENT' && role !== 'FREELANCER') return
        const session = await client.googleRegister(
          {
            ...pending.proof,
            name: String(data.get('name')),
            phone: String(data.get('phone')),
            role,
            acceptedTerms: data.get('terms') === 'on',
          },
          signal,
        )
        if (!signal.aborted) onSignIn(session, true)
      }
    })
  }

  if (!pending) {
    return (
      <>
        {children(busy)}
        <div className="google-auth">
          <div hidden={busy || disabled}>
            <GoogleButton onCredential={(proof) => void identify(proof)} />
          </div>
          {busy && <p role="status">Verificando sua conta Google…</p>}
          <ErrorMessage message={error} />
        </div>
      </>
    )
  }

  const linking = pending.next === 'LINK'
  const Heading = initialRole === undefined ? 'h2' : 'h1'
  return (
    <div className="google-auth">
      <Heading>{linking ? 'Vincular sua conta Google' : 'Complete seu cadastro'}</Heading>
      <p>
        {linking
          ? 'Confirme a senha do FreeLanceNow para vincular a conta de'
          : 'Você está criando sua conta com'}{' '}
        <strong>{pending.email}</strong>.
      </p>
      <form onSubmit={complete}>
        {linking ? (
          <>
            <Field
              label="Senha do FreeLanceNow"
              name="password"
              type="password"
              required
              maxLength={72}
              autoComplete="current-password"
            />
            <Link className="subtle-link" to="/recuperar-senha">
              Esqueci minha senha
            </Link>
          </>
        ) : (
          <>
            <Field
              label="Nome completo"
              name="name"
              required
              defaultValue={pending.name.slice(0, 100)}
              maxLength={100}
              autoComplete="name"
            />
            <RegistrationPhone />
            <label className="field">
              <span>Tipo de conta</span>
              <select name="role" required defaultValue={initialRole ?? ''}>
                <option value="" disabled>
                  Selecione um perfil
                </option>
                <option value="CLIENT">Cliente</option>
                <option value="FREELANCER">Freelancer</option>
              </select>
            </label>
            <RegistrationTerms />
          </>
        )}
        <ErrorMessage message={error} />
        <div className="row">
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={() => {
              setError('')
              setPending(undefined)
            }}
          >
            Voltar
          </button>
          <button className="button" disabled={busy}>
            {busy ? 'Aguarde…' : linking ? 'Vincular e entrar' : 'Criar conta'}
          </button>
        </div>
      </form>
    </div>
  )
}
