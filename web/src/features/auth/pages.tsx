import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ShieldCheck, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { useApp } from '../../app/store'
import { client, isMock } from '../../data/client'
import { checkNewPassword, safeRedirect, validPassword } from '../../domain/rules'
import { ErrorMessage, Field, NewPasswordFields } from '../../components/ui'

export function Login() {
  const { signIn } = useApp(),
    navigate = useNavigate(),
    { state } = useLocation()
  const from = (state as { from?: unknown } | null)?.from
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  async function enter(email: string, password: string, remember: boolean) {
    setBusy(true)
    setError('')
    try {
      const s = await client.login(email, password)
      signIn(s, remember)
      navigate(safeRedirect(from, s.user.role === 'ADMIN' ? '/admin/usuarios' : '/inicio'), {
        replace: true,
      })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    void enter(
      String(data.get('email')),
      String(data.get('password')),
      data.get('remember') === 'on',
    )
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
        <h2>Bem-vindo de volta</h2>
        <p>{from ? 'Entre para continuar de onde parou.' : 'Entre para continuar.'}</p>
        <form onSubmit={submit}>
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
            <input type="checkbox" name="remember" defaultChecked />
            <span>Manter conectado neste dispositivo</span>
          </label>
          <Link className="subtle-link" to="/recuperar-senha">
            Esqueci minha senha
          </Link>
          <ErrorMessage message={error} />
          <button disabled={busy} className="button full">
            {busy ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
        <p className="auth-switch">
          Ainda não tem conta? <Link to="/cadastro">Criar conta</Link>
        </p>
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
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!role) return
    const d = new FormData(e.currentTarget),
      password = String(d.get('password'))
    if (!validPassword(password)) {
      setError('Use pelo menos 8 caracteres com letras e números, até 72 bytes.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const s = await client.register({
        name: String(d.get('name')),
        email: String(d.get('email')),
        phone: String(d.get('phone')),
        password,
        role,
        acceptedTerms: d.get('terms') === 'on',
      })
      signIn(s)
      navigate('/perfil/completar')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="form-panel auth-single">
      <Link to="/" className="subtle-link">
        <ArrowLeft size={16} />
        Voltar ao início
      </Link>
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
        <form onSubmit={submit}>
          <Field label="Nome completo" name="name" required maxLength={100} autoComplete="name" />
          <Field
            label="E-mail"
            name="email"
            type="email"
            required
            maxLength={254}
            autoComplete="email"
          />
          <Field
            label="Telefone"
            name="phone"
            type="tel"
            required
            pattern={'\\+?[0-9 \\(\\)\\-]{10,20}'}
            autoComplete="tel"
            placeholder="(61) 99999-0000"
          />
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
          <label className="check">
            <input type="checkbox" name="terms" required />
            <span>
              Li os{' '}
              <Link to="/termos" target="_blank">
                termos de uso
              </Link>{' '}
              e a{' '}
              <Link to="/privacidade" target="_blank">
                política de privacidade
              </Link>{' '}
              e autorizo o uso dos meus dados para operar minha conta.
            </span>
          </label>
          <ErrorMessage message={error} />
          <div className="row">
            <button type="button" className="button secondary" onClick={() => setRole(null)}>
              Alterar perfil
            </button>
            <button disabled={busy} className="button">
              {busy ? 'Criando…' : 'Criar conta'}
            </button>
          </div>
        </form>
      )}
      <p>
        Já tem conta? <Link to="/login">Entrar</Link>
      </p>
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
