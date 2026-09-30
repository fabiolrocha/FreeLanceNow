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
} from 'lucide-react'
import { useApp } from './store'
import { isMock } from '../data/client'
import { Avatar } from '../components/ui'

export function Brand() {
  return (
    <Link to="/" className="brand">
      <span className="brand-icon">F</span>
      <span>
        FreeLance<span className="brand-accent">Now</span>
      </span>
    </Link>
  )
}
export function Layout() {
  const { user, signOut, loading, error, refresh } = useApp(),
    navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const links =
    user?.role === 'ADMIN'
      ? ([
          ['/admin/usuarios', 'Usuários', Users],
          ['/admin/categorias', 'Categorias', BriefcaseBusiness],
          ['/admin/moderacao', 'Moderação', Shield],
          ['/admin/relatorios', 'Relatórios', ClipboardList],
          ['/admin/transacoes', 'Transações', Wallet],
        ] as const)
      : ([
          ['/inicio', 'Início', Home],
          ['/servicos', 'Buscar serviços', Search],
          ['/profissionais', 'Profissionais', Users],
          [
            '/demandas',
            user?.role === 'FREELANCER' ? 'Demandas abertas' : 'Minhas demandas',
            ClipboardList,
          ],
          ['/contratacoes', 'Contratações', BriefcaseBusiness],
          ...(user?.role === 'FREELANCER'
            ? ([
                ['/meus-servicos', 'Meus serviços', Plus],
                ['/solicitacoes', 'Solicitações', ClipboardList],
                ['/painel', 'Meu painel', Home],
              ] as const)
            : []),
          ['/mensagens', 'Mensagens', MessageSquare],
          ['/notificacoes', 'Notificações', Bell],
          ['/carteira', user?.role === 'FREELANCER' ? 'Carteira' : 'Pagamentos', Wallet],
          ['/perfil/editar', 'Meu perfil', Settings],
        ] as const)
  return (
    <>
      <a className="skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>
      <div className="demo-banner">
        {isMock
          ? 'Demonstração acadêmica · dados fictícios · nenhum pagamento real'
          : 'Ambiente acadêmico · cadastro, login, perfis e serviços conectados à API'}
      </div>
      <header className="topbar">
        <Brand />
        <nav className="public-links" aria-label="Menu principal">
          {!user && (
            <>
              <Link to="/servicos">Encontrar serviços</Link>
              <Link to="/cadastro?tipo=freelancer">Para profissionais</Link>
            </>
          )}
        </nav>
        <div className="top-actions">
          {user ? (
            <>
              <Link className="icon-link" to="/notificacoes" aria-label="Notificações">
                <Bell size={20} />
              </Link>
              <span className="user-top">
                <Avatar name={user.name} />
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
              </span>
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
      <div className={user ? 'app-shell' : 'public-shell'}>
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
              <button
                className="text-button"
                onClick={() => {
                  signOut()
                  setOpen(false)
                  navigate('/')
                }}
              >
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
