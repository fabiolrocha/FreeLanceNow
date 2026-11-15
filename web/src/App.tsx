import { lazy, Suspense, useEffect } from 'react'
import type { ComponentType, ReactElement } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, Link } from 'react-router-dom'
import { Provider, useApp } from './app/store'
import { Layout } from './app/Layout'
import type { Role } from './domain/types'
import { isMock } from './data/client'

function feature<T extends Record<string, unknown>, K extends keyof T>(
  load: () => Promise<T>,
  name: K,
) {
  return lazy(async () => ({
    default: (await load())[name] as ComponentType<
      T[K] extends (props: infer P) => unknown ? P : Record<string, never>
    >,
  }))
}
const auth = () => import('./features/auth/pages'),
  catalog = () => import('./features/catalog/pages'),
  account = () => import('./features/account/pages'),
  freelancer = () => import('./features/freelancer/pages'),
  contracts = () => import('./features/contracts/pages'),
  demands = () => import('./features/demands/pages'),
  extra = () => import('./features/extra/pages'),
  admin = () => import('./features/admin/pages')
const Login = feature(auth, 'Login'),
  Signup = feature(auth, 'Signup'),
  Recovery = feature(auth, 'Recovery'),
  ResetPassword = feature(auth, 'ResetPassword'),
  VerifyEmail = feature(auth, 'VerifyEmail')
const Landing = feature(catalog, 'Landing'),
  Search = feature(catalog, 'SearchServices'),
  Detail = feature(catalog, 'ServiceDetail'),
  Professionals = feature(catalog, 'Professionals'),
  Profile = feature(catalog, 'ProfileDetail')
const Feed = feature(() => import('./features/feed/pages'), 'Feed')
const Dashboard = feature(account, 'Dashboard'),
  OwnProfile = feature(account, 'OwnProfile'),
  EditProfile = feature(account, 'EditProfile'),
  MyReports = feature(account, 'MyReports'),
  SavedServices = feature(account, 'SavedServices')
const MyServices = feature(freelancer, 'MyServices'),
  ServiceForm = feature(freelancer, 'ServiceForm')
const ContractList = feature(contracts, 'ContractList'),
  ContractDetail = feature(contracts, 'ContractDetail'),
  ContractAction = feature(contracts, 'ContractAction'),
  Request = feature(contracts, 'RequestService'),
  Sent = feature(contracts, 'RequestSent'),
  Reviewed = feature(contracts, 'ReviewPublished')
const Demands = feature(demands, 'Demands'),
  DemandForm = feature(demands, 'DemandForm'),
  DemandDetail = feature(demands, 'DemandDetail'),
  ProposalForm = feature(demands, 'ProposalForm'),
  AcceptProposal = feature(demands, 'AcceptProposal'),
  MyProposals = feature(demands, 'MyProposals')
const Help = feature(extra, 'Help'),
  Notifications = feature(extra, 'Notifications'),
  Messages = feature(extra, 'Messages'),
  Wallet = feature(extra, 'Wallet'),
  Payment = feature(extra, 'Payment'),
  Transaction = feature(extra, 'Transaction'),
  Withdraw = feature(extra, 'Withdraw'),
  Report = feature(extra, 'Report')
const Users = feature(admin, 'AdminUsers'),
  Categories = feature(admin, 'AdminCategories'),
  Moderation = feature(admin, 'AdminModeration'),
  Reports = feature(admin, 'AdminReports'),
  Transactions = feature(admin, 'AdminTransactions')
function Guard({ roles }: { roles?: Role[] }) {
  const { user, signedOut } = useApp(),
    { pathname, search } = useLocation()
  // After an expired session the user returns to the same page; after "Sair" nobody should.
  if (!user)
    return signedOut ? (
      <Navigate to="/" replace />
    ) : (
      <Navigate to="/login" replace state={{ from: pathname + search }} />
    )
  return roles && !roles.includes(user.role) ? (
    <section className="panel">
      <h1>Acesso restrito</h1>
      <p>
        {roles.length === 1 && roles[0] === 'ADMIN'
          ? 'Esta área é exclusiva da administração.'
          : roles.length === 1 && roles[0] === 'CLIENT'
            ? 'Esta área é para contas de cliente.'
            : roles.length === 1 && roles[0] === 'FREELANCER'
              ? 'Esta área é para contas de profissional.'
              : 'Esta área não está disponível para o seu tipo de conta.'}
      </p>
      <Link to={user.role === 'ADMIN' ? '/admin' : '/inicio'}>Voltar ao início</Link>
    </section>
  ) : (
    <Outlet />
  )
}
/**
 * Payments are the last integration. Until then the API build shows what is coming instead of
 * simulated balances; the mock build keeps the full demonstration.
 */
function PaymentsSoon() {
  const { user } = useApp()
  return (
    <section className="panel">
      <span className="badge">Em breve</span>
      <h1>Pagamentos pela plataforma</h1>
      <p>
        {user?.role === 'FREELANCER'
          ? 'Em breve você vai receber pelos serviços concluídos e acompanhar saques por aqui. Por enquanto, combine o pagamento diretamente com o cliente pelas mensagens da contratação.'
          : user?.role === 'ADMIN'
            ? 'O acompanhamento de transações e repasses chega junto com a integração de pagamentos.'
            : 'Em breve você vai pagar com segurança pela plataforma, com o valor liberado ao profissional só depois da sua confirmação. Por enquanto, combine o pagamento diretamente com o profissional pelas mensagens da contratação.'}
      </p>
      <Link to={user?.role === 'ADMIN' ? '/admin' : '/contratacoes'}>
        {user?.role === 'ADMIN' ? 'Voltar ao painel' : 'Ver minhas contratações'}
      </Link>
    </section>
  )
}
const money = (element: ReactElement) => (isMock ? element : <PaymentsSoon />)
/** The feed is for clients and freelancers; the team starts on its own panel. */
function Home() {
  const { user } = useApp()
  return user?.role === 'ADMIN' ? <Navigate to="/admin/usuarios" replace /> : <Feed />
}
const DEFAULT_TITLE = 'FreeLanceNow · Serviços gerais'
function NotFound() {
  const { user } = useApp()
  const home = user ? (user.role === 'ADMIN' ? '/admin' : '/inicio') : '/'
  return (
    <section className="empty not-found">
      <span className="badge">Erro 404</span>
      <h1>Página não encontrada</h1>
      <p>O endereço pode ter mudado, ou o conteúdo saiu do ar.</p>
      <div className="not-found-actions">
        <Link className="button" to={home}>
          Voltar ao início
        </Link>
        {user?.role !== 'ADMIN' && (
          <Link className="button secondary" to="/servicos">
            Buscar serviços
          </Link>
        )}
        <Link className="subtle-link" to="/ajuda">
          Ver a ajuda
        </Link>
      </div>
    </section>
  )
}
function ScrollReset() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  // The tab shows the page's own heading (lazy pages and loaded data included), so history,
  // bookmarks and screen readers can tell pages apart.
  useEffect(() => {
    let frame = 0
    const sync = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const heading = document.querySelector('main h1')?.textContent?.trim()
        const title =
          heading && window.location.pathname !== '/' ? `${heading} · FreeLanceNow` : DEFAULT_TITLE
        if (document.title !== title) document.title = title
      })
    }
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    sync()
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [])
  return null
}
export default function App() {
  return (
    <BrowserRouter>
      <Provider>
        <ScrollReset />
        <Suspense
          fallback={
            <p className="loading" role="status">
              Carregando página…
            </p>
          }
        >
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Landing />} />
              <Route path="login" element={<Login />} />
              <Route path="cadastro" element={<Signup />} />
              <Route path="recuperar-senha" element={<Recovery />} />
              <Route path="redefinir-senha" element={<ResetPassword />} />
              <Route path="verificar-email" element={<VerifyEmail />} />
              <Route path="servicos" element={<Search />} />
              <Route path="servicos/:id" element={<Detail />} />
              <Route path="profissionais" element={<Professionals />} />
              <Route path="profissionais/:id" element={<Profile />} />
              <Route path="ajuda" element={<Help />} />
              <Route path="termos" element={<Help kind="terms" />} />
              <Route path="privacidade" element={<Help kind="privacy" />} />
              <Route element={<Guard />}>
                <Route path="inicio" element={<Home />} />
                <Route path="perfil" element={<OwnProfile />} />
                <Route path="perfil/editar" element={<EditProfile />} />
                <Route path="perfil/completar" element={<EditProfile />} />
                <Route path="contratacoes/:id" element={<ContractDetail />} />
                <Route path="contratacoes/:id/enviada" element={<Sent />} />
                <Route path="contratacoes/:id/avaliacao-publicada" element={<Reviewed />} />
                {['disputa', 'contestar', 'cancelar'].map((p) => (
                  <Route key={p} path={`contratacoes/:id/${p}`} element={<ContractAction />} />
                ))}
                <Route path="demandas/:id" element={<DemandDetail />} />
                <Route path="notificacoes" element={<Notifications />} />
              </Route>
              {/* Marketplace areas: the team works from its own panel. */}
              <Route element={<Guard roles={['CLIENT', 'FREELANCER']} />}>
                <Route path="contratacoes" element={<ContractList />} />
                <Route path="demandas" element={<Demands />} />
                <Route path="mensagens" element={<Messages />} />
                <Route path="carteira" element={money(<Wallet />)} />
                <Route path="transacao" element={money(<Transaction />)} />
                <Route path="denunciar" element={<Report />} />
                <Route path="denunciar/enviada" element={<Report />} />
                <Route path="denuncias" element={<MyReports />} />
              </Route>
              <Route element={<Guard roles={['CLIENT', 'FREELANCER']} />}>
                <Route path="painel" element={<Dashboard />} />
              </Route>
              <Route element={<Guard roles={['CLIENT']} />}>
                <Route path="salvos" element={<SavedServices />} />
                <Route path="servicos/:id/solicitar" element={<Request />} />
                <Route path="demandas/nova" element={<DemandForm />} />
                <Route path="demandas/:id/editar" element={<DemandForm />} />
                <Route path="demandas/:id/propostas/:pid/aceitar" element={<AcceptProposal />} />
                <Route path="pagamento" element={money(<Payment />)} />
                <Route path="pagamento/confirmado" element={money(<Payment />)} />
                {['confirmar', 'avaliar'].map((p) => (
                  <Route key={p} path={`contratacoes/:id/${p}`} element={<ContractAction />} />
                ))}
              </Route>
              <Route element={<Guard roles={['FREELANCER']} />}>
                <Route path="propostas" element={<MyProposals />} />
                <Route path="meus-servicos" element={<MyServices />} />
                <Route path="meus-servicos/novo" element={<ServiceForm />} />
                <Route path="meus-servicos/:id/editar" element={<ServiceForm />} />
                {/* Requests are the "Pendentes" stage of the contract list. */}
                <Route
                  path="solicitacoes"
                  element={<Navigate to="/contratacoes?filtro=pending" replace />}
                />
                <Route path="contratacoes/:id/concluir" element={<ContractAction />} />
                <Route path="demandas/:id/proposta" element={<ProposalForm />} />
                <Route path="demandas/:id/proposta/enviada" element={<ProposalForm />} />
                <Route path="saque" element={money(<Withdraw />)} />
                <Route path="saque/enviado" element={money(<Withdraw />)} />
              </Route>
              <Route element={<Guard roles={['ADMIN']} />}>
                <Route path="admin" element={<Navigate to="/admin/usuarios" replace />} />
                <Route path="admin/usuarios" element={<Users />} />
                <Route path="admin/categorias" element={<Categories />} />
                <Route path="admin/moderacao" element={<Moderation />} />
                <Route path="admin/relatorios" element={<Reports />} />
                <Route path="admin/transacoes" element={money(<Transactions />)} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </Suspense>
      </Provider>
    </BrowserRouter>
  )
}
