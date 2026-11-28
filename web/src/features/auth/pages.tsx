import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ShieldCheck, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { useApp } from '../../app/store'
import { client, isMock } from '../../data/client'
import { checkNewPassword, safeRedirect, validPassword } from '../../domain/rules'
import { ErrorMessage, Field, NewPasswordFields } from '../../components/ui'
import type { Session } from '../../domain/types'
import { GoogleEntry } from './google'
import { RegistrationPhone, RegistrationTerms } from './registration-fields'
import { useAuthRequest } from './use-auth-request'

export function Login() {
  const { signIn } = useApp(),
    navigate = useNavigate(),
    { state } = useLocation()
  const from = (state as { from?: unknown } | null)?.from
  const { busy, error, run } = useAuthRequest()
  const [remember, setRemember] = useState(true)
  function finish(session: Session, registered = false) {
    signIn(session, remember)
    const fallback = session.user.role === 'ADMIN' ? '/admin/usuarios' : '/inicio'
    navigate(registered ? '/perfil/completar' : safeRedirect(from, fallback), { replace: true })
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    void run(async (signal) => {
      const session = await client.login(
        String(data.get('email')),
        String(data.get('password')),
        signal,
      )
      if (!signal.aborted) finish(session)
    })
  }
  return (
    <div className="auth-layout">
      <div className="auth-story">
        <ShieldCheck size={40} />
        <h1>O serviço certo começa com uma boa conexão.</h1>
        <p>Encontre profissionais, organize suas contratações e acompanhe cada etapa.</p>
        <div className="auth-story-bottom">Elétrica, limpeza, encanamento, pintura e TI.</div>
      </div>
      <section className="auth-panel">
        <GoogleEntry onSignIn={finish} disabled={busy}>
          {(googleBusy) => (
            <>
              <h2>Que bom ver você de novo</h2>
              <p>{from ? 'Entre para continuar de onde parou.' : 'Entre para continuar.'}</p>
              <form onSubmit={(e) => (googleBusy ? e.preventDefault() : submit(e))}>
                <Field label="E-mail" name="email" type="email" required autoComplete="email" />
                <Field
                  label="Senha"
                  name="password"
                  type="password"
                  required
                  maxLength={72}
                  autoComplete="current-password"
                />
                <label className="check">
                  <input
                    type="checkbox"
                    name="remember"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                  />
                  <span>Manter conectado neste dispositivo</span>
                </label>
                <Link className="subtle-link" to="/recuperar-senha">
                  Esqueci minha senha
                </Link>
                <ErrorMessage message={error} />
                <button disabled={busy || googleBusy} className="button full">
                  {busy ? 'Entrando…' : 'Entrar'}
                </button>
              </form>
              <p className="auth-switch">
                Ainda não tem conta? <Link to="/cadastro">Criar conta</Link>
              </p>
            </>
          )}
        </GoogleEntry>
      </section>
    </div>
  )
}
export function Signup() {
  const [params] = useSearchParams(),
    navigate = useNavigate(),
    { signIn } = useApp()
  const [role, setRole] = useState<'CLIENT' | 'FREELANCER' | null>(
    params.get('tipo') === 'freelancer' ? 'FREELANCER' : null,
  )
  const { busy, error, setError, run } = useAuthRequest()
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!role) return
    const d = new FormData(e.currentTarget)
    const password = String(d.get('password'))
    if (!validPassword(password)) {
      setError('Use pelo menos 8 caracteres com letras e números, até 72 bytes.')
      return
    }
    void run(async (signal) => {
      const session = await client.register(
        {
          name: String(d.get('name')),
          email: String(d.get('email')),
          phone: String(d.get('phone')),
          password,
          role,
          acceptedTerms: d.get('terms') === 'on',
        },
        signal,
      )
      if (signal.aborted) return
      signIn(session)
      navigate('/perfil/completar')
    })
  }
  return (
    <section className="form-panel auth-single">
      <Link to="/" className="subtle-link">
        <ArrowLeft size={16} />
        Voltar ao início
      </Link>
      <GoogleEntry
        initialRole={role}
        disabled={busy}
        onSignIn={(session, registered) => {
          signIn(session)
          navigate(registered ? '/perfil/completar' : '/inicio', { replace: true })
        }}
      >
        {(googleBusy) => (
          <>
            <h1>
              {!role
                ? 'Como você quer participar?'
                : role === 'CLIENT'
                  ? 'Criar conta de cliente'
                  : 'Criar conta de freelancer'}
            </h1>
            <p>
              {!role
                ? 'Escolha o perfil que combina com o que você precisa.'
                : 'Depois, você poderá completar seu perfil.'}
            </p>
            {!role ? (
              <>
                <button className="role-choice" onClick={() => setRole('CLIENT')}>
                  <strong>Quero contratar</strong>
                  <span>Busque profissionais e acompanhe seus serviços.</span>
                </button>
                <button className="role-choice" onClick={() => setRole('FREELANCER')}>
                  <strong>Quero trabalhar</strong>
                  <span>Publique serviços e receba solicitações.</span>
                </button>
              </>
            ) : (
              <form onSubmit={(e) => (googleBusy ? e.preventDefault() : submit(e))}>
                <Field
                  label="Nome completo"
                  name="name"
                  required
                  maxLength={100}
                  autoComplete="name"
                />
                <Field
                  label="E-mail"
                  name="email"
                  type="email"
                  required
                  maxLength={254}
                  autoComplete="email"
                />
                <RegistrationPhone />
                <Field
                  label="Senha"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  maxLength={72}
                  autoComplete="new-password"
                  hint="Ao menos 8 caracteres, com letras e números."
                />
                <RegistrationTerms />
                <ErrorMessage message={error} />
                <div className="row">
                  <button type="button" className="button secondary" onClick={() => setRole(null)}>
                    Trocar tipo de conta
                  </button>
                  <button disabled={busy || googleBusy} className="button">
                    {busy ? 'Criando…' : 'Criar conta'}
                  </button>
                </div>
              </form>
            )}
            <p>
              Já tem conta? <Link to="/login">Entrar</Link>
            </p>
          </>
        )}
      </GoogleEntry>
    </section>
  )
}
export function Recovery() {
  const [sent, setSent] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const email = String(new FormData(e.currentTarget).get('email')).trim()
    setBusy(true)
    setError('')
    try {
      await client.forgotPassword(email)
      setSent(email)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="form-panel auth-single">
      <Link to="/login" className="subtle-link">
        <ArrowLeft size={16} />
        Voltar ao login
      </Link>
      <h1>Recuperar acesso</h1>
      {sent ? (
        <>
          <p className="success">
            <CheckCircle2 />
            {isMock
              ? 'Pedido registrado. No modo de demonstração nenhum e-mail é enviado.'
              : `Se houver uma conta ativa para ${sent}, enviamos um link para criar uma nova senha. Ele vale por 30 minutos.`}
          </p>
          <p>Não recebeu? Confira a caixa de spam ou peça outro link em 1 minuto.</p>
          <button type="button" className="button secondary" onClick={() => setSent('')}>
            Pedir outro link
          </button>
        </>
      ) : (
        <form onSubmit={submit}>
          <p>Informe o e-mail da sua conta. Enviaremos um link para você criar uma nova senha.</p>
          <Field
            label="E-mail cadastrado"
            name="email"
            type="email"
            required
            maxLength={254}
            autoComplete="email"
          />
          <ErrorMessage message={error} />
          <button disabled={busy} className="button full">
            {busy ? 'Enviando…' : 'Enviar link'}
          </button>
        </form>
      )}
    </section>
  )
}
export function ResetPassword() {
  const [params] = useSearchParams(),
    resetToken = params.get('token') || ''
  const [done, setDone] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const d = new FormData(e.currentTarget),
      invalid = checkNewPassword(d)
    if (invalid) return setError(invalid)
    setBusy(true)
    setError('')
    try {
      await client.resetPassword(resetToken, String(d.get('password')))
      setDone(true)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="form-panel auth-single">
      <h1>Criar nova senha</h1>
      {done ? (
        <>
          <p className="success">
            <CheckCircle2 />
            Senha alterada. Entre com a nova senha.
          </p>
          <Link className="button" to="/login">
            Entrar
          </Link>
        </>
      ) : !resetToken ? (
        <>
          <p>Este link está incompleto. Abra o link do e-mail novamente ou peça um novo.</p>
          <Link className="button" to="/recuperar-senha">
            Pedir novo link
          </Link>
        </>
      ) : (
        <form onSubmit={submit}>
          <p>Escolha uma senha que você não usa em outros sites.</p>
          <NewPasswordFields />
          <ErrorMessage message={error} />
          <button disabled={busy} className="button full">
            {busy ? 'Salvando…' : 'Salvar nova senha'}
          </button>
          {error && (
            <Link className="subtle-link" to="/recuperar-senha">
              Pedir novo link
            </Link>
          )}
        </form>
      )}
    </section>
  )
}
/** Opened from the registration e-mail. Works signed in or out; the link carries the account. */
export function VerifyEmail() {
  const [params] = useSearchParams(),
    verifyToken = params.get('token') || ''
  const { user, updateUser } = useApp()
  const [state, setState] = useState<'busy' | 'done' | 'error'>(verifyToken ? 'busy' : 'error'),
    [error, setError] = useState(
      verifyToken ? '' : 'Este link está incompleto. Abra o link do e-mail novamente.',
    )
  useEffect(() => {
    if (!verifyToken) return
    let active = true
    client
      .verifyEmail(verifyToken)
      .then(() => {
        if (!active) return
        setState('done')
        if (user) updateUser({ ...user, emailVerified: true })
      })
      .catch((e: Error) => {
        if (!active) return
        setError(e.message)
        setState('error')
      })
    return () => {
      active = false
    }
    // Run once per link; the user object changes after confirming.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verifyToken])
  return (
    <section className="form-panel auth-single">
      <h1>Confirmação de e-mail</h1>
      {state === 'busy' && <p>Confirmando seu e-mail…</p>}
      {state === 'done' && (
        <>
          <p className="success">
            <CheckCircle2 />
            E-mail confirmado. Agora você recebe por e-mail os avisos da sua conta.
          </p>
          <Link className="button" to={user ? '/inicio' : '/login'}>
            {user ? 'Ir para o início' : 'Entrar'}
          </Link>
        </>
      )}
      {state === 'error' && (
        <>
          <ErrorMessage message={error} />
          <p>
            {user
              ? 'Use "Reenviar link" no aviso do topo da página para receber um link novo.'
              : 'Entre na sua conta para pedir um link novo.'}
          </p>
          <Link className="button" to={user ? '/inicio' : '/login'}>
            {user ? 'Voltar ao início' : 'Entrar'}
          </Link>
        </>
      )}
    </section>
  )
}
