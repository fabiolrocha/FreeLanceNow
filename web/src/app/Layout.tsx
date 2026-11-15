import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import {
  Home,
  Search,
  Users,
  ClipboardList,
  BriefcaseBusiness,
  Bell,
  MessageSquare,
  Wallet,
  LogOut,
  Menu,
  Settings,
  Shield,
  X,
  Plus,
  Send,
  Flag,
  CircleHelp,
  UserRound,
} from 'lucide-react'
import { useApp } from './store'
import { useUnreadCount } from './useUnread'
import { avatarUrl, client, isMock } from '../data/client'
import { Avatar } from '../components/ui'
import '../features/feed/feed.css'

export function Brand() {
  const { user } = useApp()
  return (
    <Link to={user ? (user.role === 'ADMIN' ? '/admin' : '/inicio') : '/'} className="brand">
      <img
        src="/images/logo.svg"
        alt=""
        aria-hidden="true"
        className="brand-logo"
        width={36}
        height={36}
      />
      <span>
        FreeLance<span className="brand-accent">Now</span>
      </span>
    </Link>
  )
}
export function Layout() {
  const { user, signOut, loading, error, refresh } = useApp(),
    unread = useUnreadCount(),
    navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const social = !!user && user.role !== 'ADMIN'
  function logout() {
    signOut()
    setOpen(false)
    navigate('/')
  }
  const links =
    user?.role === 'ADMIN'
      ? ([
          ['/admin/usuarios', 'Usuários', Users],
          ['/admin/categorias', 'Categorias', BriefcaseBusiness],
          ['/admin/moderacao', 'Moderação', Shield],
          ['/admin/relatorios', 'Relatórios', ClipboardList],
          ...(isMock ? ([['/admin/transacoes', 'Transações', Wallet]] as const) : []),
          ['/perfil/editar', 'Minha conta', Settings],
        ] as const)
      : ([
          ['/inicio', 'Início', Home],
          ...(user?.role === 'FREELANCER'
            ? ([
                ['/painel', 'Meu painel', Home],
                ['/solicitacoes', 'Solicitações', ClipboardList],
                ['/contratacoes', 'Contratações', BriefcaseBusiness],
                ['/demandas', 'Demandas abertas', ClipboardList],
                ['/propostas', 'Minhas propostas', Send],
                ['/meus-servicos', 'Meus serviços', Plus],
              ] as const)
            : ([
                ['/servicos', 'Buscar serviços', Search],
                ['/profissionais', 'Profissionais', Users],
                ['/demandas', 'Minhas demandas', ClipboardList],
                ['/contratacoes', 'Contratações', BriefcaseBusiness],
              ] as const)),
          ['/mensagens', 'Mensagens', MessageSquare],
          ['/notificacoes', 'Notificações', Bell],
          ...(isMock
            ? ([
                ['/carteira', user?.role === 'FREELANCER' ? 'Carteira' : 'Pagamentos', Wallet],
              ] as const)
            : []),
          ['/denuncias', 'Minhas denúncias', Flag],
          ['/perfil', 'Meu perfil', UserRound],
          ['/perfil/editar', 'Configurações da conta', Settings],
          ['/ajuda', 'Ajuda', CircleHelp],
        ] as const)
  return (
    <>
      <a className="skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>
      {isMock && (
        <div className="demo-banner">
          Demonstração acadêmica · dados fictícios · nenhum pagamento real
        </div>
      )}
      {user && user.emailVerified === false && <VerifyEmailBanner email={user.email} />}
      <header className={`topbar ${social ? 'social-header' : ''}`}>
        <Brand />
        <nav className="public-links" aria-label="Menu principal">
          {social && (
            <>
              <NavLink to="/inicio">Feed</NavLink>
              {user.role === 'FREELANCER' ? (
                <>
                  <NavLink to="/demandas">Demandas abertas</NavLink>
                  <NavLink to="/propostas">Minhas propostas</NavLink>
                  <NavLink to="/meus-servicos">Meus serviços</NavLink>
                  <NavLink to="/solicitacoes">Solicitações</NavLink>
                </>
              ) : (
                <>
                  <NavLink to="/servicos">Serviços</NavLink>
                  <NavLink to="/profissionais">Profissionais</NavLink>
                  <NavLink to="/demandas">Minhas demandas</NavLink>
                </>
              )}
            </>
          )}
          {!user && (
            <>
              <Link to="/servicos">Encontrar serviços</Link>
              <Link to="/profissionais">Profissionais</Link>
              <Link to="/cadastro?tipo=freelancer">Para profissionais</Link>
            </>
          )}
        </nav>
        <div className="top-actions">
          {user ? (
            <>
              {social && (
                <Link className="icon-link" to="/mensagens" aria-label="Mensagens">
                  <MessageSquare size={20} />
                </Link>
              )}
              <Link
                className="icon-link"
                to="/notificacoes"
                aria-label={unread ? `Notificações: ${unread} não lidas` : 'Notificações'}
                style={{ position: 'relative' }}
              >
                <Bell size={20} />
                {unread > 0 && (
                  <span className="badge-count" aria-hidden="true">
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </Link>
              <Link className="user-top" to={user.role === 'ADMIN' ? '/perfil/editar' : '/perfil'}>
                <Avatar name={user.name} src={avatarUrl(user.id, user.avatarVersion)} />
                <span>
                  {user.name}
                  <small>
                    {user.role === 'CLIENT'
                      ? 'Cliente'
                      : user.role === 'FREELANCER'
                        ? 'Freelancer'
                        : 'Administrador'}
                  </small>
                </span>
              </Link>
              {social && !open && (
                <button className="text-button desktop-signout" onClick={logout}>
                  Sair da conta
                </button>
              )}
              <button
                className="menu-button"
                aria-label={open ? 'Fechar menu' : 'Abrir menu'}
                onClick={() => setOpen(!open)}
              >
                {open ? <X /> : <Menu />}
              </button>
            </>
          ) : (
            <>
              <Link to="/login">Entrar</Link>
              <Link className="button" to="/cadastro">
                Criar conta
              </Link>
            </>
          )}
        </div>
      </header>
      <div className={social ? 'social-shell' : user ? 'app-shell' : 'public-shell'}>
        {user && (
          <aside className={`sidebar ${open ? 'open' : ''}`}>
            <nav aria-label="Navegação da conta">
              {links.map(([to, name, Icon]) => (
                <NavLink key={to} to={to} onClick={() => setOpen(false)}>
                  <Icon size={19} />
                  {name}
                </NavLink>
              ))}
            </nav>
            <div className="sidebar-bottom">
              <p>Seu trabalho, em um só lugar.</p>
              <button className="text-button" onClick={logout}>
                <LogOut size={18} />
                Sair da conta
              </button>
            </div>
          </aside>
        )}
        <main id="conteudo" className={user ? 'app-content' : 'public-content'}>
          {error && (
            <div role="alert" className="error">
              Não foi possível carregar os dados. {error}{' '}
              <button onClick={() => void refresh()}>Tentar novamente</button>
            </div>
          )}
          {loading ? (
            <p role="status" className="loading">
              Carregando serviços…
            </p>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
      {!user && (
        <footer className="footer">
          <Brand />
          <span>Serviços gerais, pessoas próximas.</span>
          <div>
            <Link to="/termos">Termos de uso</Link>
            <Link to="/privacidade">Privacidade</Link>
            <Link to="/ajuda">Ajuda</Link>
          </div>
          <small>FreeLanceNow · Grupo 2 · Projeto acadêmico</small>
        </footer>
      )}
    </>
  )
}
/** Shown until the address is confirmed; the link arrives by e-mail right after registration. */
function VerifyEmailBanner({ email }: { email: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'sent'>('idle'),
    [error, setError] = useState('')
  async function resend() {
    setState('busy')
    setError('')
    try {
      await client.resendVerification()
      setState('sent')
    } catch (e) {
      setError((e as Error).message)
      setState('idle')
    }
  }
  return (
    <div className="demo-banner verify-banner" role="status">
      {state === 'sent'
        ? `Enviamos um novo link para ${email}. Confira também a caixa de spam.`
        : `Confirme seu e-mail: enviamos um link para ${email}.`}{' '}
      {state !== 'sent' && (
        <button className="text-button" disabled={state === 'busy'} onClick={() => void resend()}>
          {state === 'busy' ? 'Enviando…' : 'Reenviar link'}
        </button>
      )}
      {error && <span> {error}</span>}
    </div>
  )
}
