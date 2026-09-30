import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ShieldCheck, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { useApp } from '../../app/store'
import { client, isMock } from '../../data/client'
import { demoUsers } from '../../data/fixtures'
import { validPassword } from '../../domain/rules'
import { ErrorMessage, Field } from '../../components/ui'

export function Login() {
  const { signIn } = useApp(),
    navigate = useNavigate()
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  async function enter(email: string, password: string) {
    setBusy(true)
    setError('')
    try {
      const s = await client.login(email, password)
      signIn(s)
      navigate(s.user.role === 'ADMIN' ? '/admin/usuarios' : '/inicio')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    void enter(String(data.get('email')), String(data.get('password')))
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
        <p>Entre para continuar.</p>
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
          <Link className="subtle-link" to="/recuperar-senha">
            Esqueci minha senha
          </Link>
          <ErrorMessage message={error} />
          <button disabled={busy} className="button full">
            {busy ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
        {isMock && (
          <div className="demo-accounts">
            <p>Explorar com uma conta de demonstração</p>
            <div className="row">
              {demoUsers.map((u) => (
                <button
                  key={u.id}
                  className="button secondary"
                  disabled={busy}
                  onClick={() => void enter(u.email, 'Demo12345')}
                >
                  {u.role === 'CLIENT'
                    ? 'Cliente'
                    : u.role === 'FREELANCER'
                      ? 'Freelancer'
                      : 'Admin'}
                </button>
              ))}
            </div>
            <small>Senha das contas fictícias: Demo12345</small>
          </div>
        )}
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
                termos de uso acadêmico
              </Link>{' '}
              e a{' '}
              <Link to="/privacidade" target="_blank">
                política de privacidade da demonstração
              </Link>
              . Autorizo o uso dos dados para esta demonstração.
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
  const [sent, setSent] = useState(false)
  return (
    <section className="form-panel auth-single">
      <h1>Recuperar acesso</h1>
      <p>
        {isMock
          ? 'Simulação do pedido de recuperação. Nenhum e-mail será enviado.'
          : 'O envio de e-mail ainda está em desenvolvimento. Entre em contato com o grupo responsável pela demonstração.'}
      </p>
      {isMock && !sent && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            setSent(true)
          }}
        >
          <Field label="E-mail cadastrado" type="email" required />
          <button className="button">Simular envio do link</button>
        </form>
      )}
      {sent && (
        <p className="success">
          <CheckCircle2 />
          Pedido simulado. Na versão integrada, o link terá validade de 30 minutos.
        </p>
      )}
      <Link to="/login">Voltar ao login</Link>
    </section>
  )
}
