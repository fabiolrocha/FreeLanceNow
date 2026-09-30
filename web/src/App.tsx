import { lazy, Suspense, useEffect } from 'react'
import type { ComponentType } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, Link } from 'react-router-dom'
import { Provider, useApp } from './app/store'
import { Layout } from './app/Layout'
import type { Role } from './domain/types'

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
  Recovery = feature(auth, 'Recovery')
const Landing = feature(catalog, 'Landing'),
  Search = feature(catalog, 'SearchServices'),
  Detail = feature(catalog, 'ServiceDetail'),
  Professionals = feature(catalog, 'Professionals'),
  Profile = feature(catalog, 'ProfileDetail')
const Dashboard = feature(account, 'Dashboard'),
  OwnProfile = feature(account, 'OwnProfile'),
  EditProfile = feature(account, 'EditProfile')
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
  ProposalForm = feature(demands, 'ProposalForm')
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
  const { user } = useApp()
  if (!user) return <Navigate to="/login" replace />
  return roles && !roles.includes(user.role) ? (
    <section className="panel">
      <h1>Acesso restrito</h1>
      <p>Esta área exige outro tipo de conta.</p>
      <Link to="/inicio">Voltar ao início</Link>
    </section>
  ) : (
    <Outlet />
  )
}
function ScrollReset() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
    document.title = 'FreeLanceNow · Serviços gerais'
  }, [pathname])
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
              <Route path="servicos" element={<Search />} />
              <Route path="servicos/:id" element={<Detail />} />
              <Route path="profissionais" element={<Professionals />} />
              <Route path="profissionais/:id" element={<Profile />} />
              <Route path="ajuda" element={<Help />} />
              <Route path="termos" element={<Help kind="terms" />} />
              <Route path="privacidade" element={<Help kind="privacy" />} />
              <Route element={<Guard />}>
                <Route path="inicio" element={<Dashboard />} />
                <Route path="perfil" element={<OwnProfile />} />
                <Route path="perfil/editar" element={<EditProfile />} />
                <Route path="perfil/completar" element={<EditProfile />} />
                <Route path="contratacoes" element={<ContractList />} />
                <Route path="contratacoes/:id" element={<ContractDetail />} />
                <Route path="contratacoes/:id/enviada" element={<Sent />} />
                <Route path="contratacoes/:id/avaliacao-publicada" element={<Reviewed />} />
                <Route path="contratacoes/:id/disputa" element={<ContractAction />} />
                <Route path="demandas" element={<Demands />} />
                <Route path="demandas/:id" element={<DemandDetail />} />
                <Route path="notificacoes" element={<Notifications />} />
                <Route path="mensagens" element={<Messages />} />
                <Route path="carteira" element={<Wallet />} />
                <Route path="transacao" element={<Transaction />} />
                <Route path="denunciar" element={<Report />} />
                <Route path="denunciar/enviada" element={<Report />} />
              </Route>
              <Route element={<Guard roles={['CLIENT']} />}>
                <Route path="servicos/:id/solicitar" element={<Request />} />
                <Route path="demandas/nova" element={<DemandForm />} />
                <Route path="pagamento" element={<Payment />} />
                <Route path="pagamento/confirmado" element={<Payment />} />
                {['confirmar', 'contestar', 'avaliar'].map((p) => (
                  <Route key={p} path={`contratacoes/:id/${p}`} element={<ContractAction />} />
                ))}
              </Route>
              <Route element={<Guard roles={['FREELANCER']} />}>
                <Route path="painel" element={<Dashboard />} />
                <Route path="meus-servicos" element={<MyServices />} />
                <Route path="meus-servicos/novo" element={<ServiceForm />} />
                <Route path="meus-servicos/:id/editar" element={<ServiceForm />} />
                <Route path="solicitacoes" element={<ContractList requests />} />
                <Route path="contratacoes/:id/concluir" element={<ContractAction />} />
                <Route path="demandas/:id/proposta" element={<ProposalForm />} />
                <Route path="demandas/:id/proposta/enviada" element={<ProposalForm />} />
                <Route path="saque" element={<Withdraw />} />
                <Route path="saque/enviado" element={<Withdraw />} />
              </Route>
              <Route element={<Guard roles={['ADMIN']} />}>
                <Route path="admin" element={<Navigate to="/admin/usuarios" replace />} />
                <Route path="admin/usuarios" element={<Users />} />
                <Route path="admin/categorias" element={<Categories />} />
                <Route path="admin/moderacao" element={<Moderation />} />
                <Route path="admin/relatorios" element={<Reports />} />
                <Route path="admin/transacoes" element={<Transactions />} />
              </Route>
              <Route
                path="*"
                element={
                  <section className="empty">
                    <h1>Página não encontrada</h1>
                    <Link className="button" to="/">
                      Voltar ao início
                    </Link>
                  </section>
                }
              />
            </Route>
          </Routes>
        </Suspense>
      </Provider>
    </BrowserRouter>
  )
}
