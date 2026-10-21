/* oxlint-disable react/only-export-components -- provider and its hook share the same context module */
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type {
  Category,
  Contract,
  ContractStatus,
  CreateContract,
  CreateDemand,
  CreateProposal,
  Demand,
  Profile,
  Proposal,
  Service,
  Session,
  User,
} from '../domain/types'
import {
  contracts as initialContracts,
  demands as initialDemands,
  proposals as initialProposals,
} from '../data/fixtures'
import { client, isMock, setToken } from '../data/client'
import { canReview, canTransition, futureDate, nowIso, today } from '../domain/rules'

function saved<T>(key: string, fallback: T) {
  try {
    return (JSON.parse(sessionStorage.getItem(key) || 'null') as T) ?? fallback
  } catch {
    return fallback
  }
}
interface Store {
  user: User | null
  services: Service[]
  categories: Category[]
  professionals: Profile[]
  loading: boolean
  error: string
  contracts: Contract[]
  demands: Demand[]
  proposals: Proposal[]
  signIn: (s: Session) => void
  signOut: () => void
  refresh: () => Promise<void>
  updateUser: (u: User) => void
  setDemands: (fn: (d: Demand[]) => Demand[]) => void
  setProposals: (fn: (p: Proposal[]) => Proposal[]) => void
  addContract: (c: Contract) => void
  createDemand: (r: CreateDemand) => Promise<Demand>
  createProposal: (demandId: string, r: CreateProposal) => Promise<Proposal>
  acceptProposal: (proposalId: string) => Promise<Contract>
  rejectProposal: (proposalId: string) => Promise<void>
  requestContract: (r: CreateContract) => Promise<Contract>
  transition: (id: string, status: ContractStatus, dispute?: string) => Promise<void>
  review: (id: string, rating: number, comment: string) => Promise<void>
  replyReview: (id: string, reply: string) => Promise<void>
  reloadContracts: () => Promise<void>
  toast: string
  notify: (s: string) => void
}
function mockRating(contracts: Contract[], freelancerId: string) {
  const rated = contracts.filter(
    (c) => c.freelancerId === freelancerId && typeof c.rating === 'number',
  )
  if (!rated.length) return { averageRating: null, reviewCount: 0 }
  const sum = rated.reduce((acc, c) => acc + (c.rating || 0), 0)
  return {
    averageRating: Number((sum / rated.length).toFixed(1)),
    reviewCount: rated.length,
  }
}
const Context = createContext<Store | null>(null)
export function Provider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => {
    const s = saved<Session | null>('fln-session', null)
    const valid = s?.expiresAt && s.expiresAt > Date.now() ? s : null
    setToken(valid?.accessToken || '')
    return valid
  })
  const [services, setServices] = useState<Service[]>([]),
    [categories, setCategories] = useState<Category[]>([]),
    [professionals, setProfessionals] = useState<Profile[]>([])
  const [contracts, setContracts] = useState<Contract[]>(() =>
    isMock ? saved('fln-contracts', initialContracts) : saved('fln-api-contracts', []),
  )
  const [demands, setDemands] = useState<Demand[]>(() =>
    isMock ? saved('fln-demands', initialDemands) : saved('fln-api-demands', []),
  )
  const [proposals, setProposals] = useState<Proposal[]>(() =>
    isMock ? saved('fln-proposals', initialProposals) : saved('fln-api-proposals', []),
  )
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [toast, notify] = useState('')
  // Only the first load replaces the page; later refreshes keep the current screen mounted.
  const loaded = useRef(false)
  async function refresh() {
    setError('')
    if (!loaded.current) setLoading(true)
    try {
      const hasToken = !isMock && !!saved<Session | null>('fln-session', null)?.accessToken
      const [s, c, p, ct, dm, pr] = await Promise.all([
        client.services(),
        client.categories(),
        client.professionals(),
        hasToken ? client.contracts() : Promise.resolve(null),
        hasToken ? client.demands() : Promise.resolve(null),
        hasToken ? client.proposals() : Promise.resolve(null),
      ])
      setServices(s)
      setCategories(c)
      setProfessionals(p)
      if (ct) setContracts(ct)
      if (dm) setDemands(dm)
      if (pr) setProposals(pr)
      loaded.current = true
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Falha ao carregar. Verifique a API e tente novamente.',
      )
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    // Initial synchronization with the selected data source also sets loading/error feedback.
    // oxlint-disable-next-line react/set-state-in-effect
    void refresh()
  }, [])
  useEffect(() => {
    if (!session) return
    let active = true
    void client.me(session.user).catch(() => {
      if (active) {
        setSession(null)
        setToken('')
        sessionStorage.removeItem('fln-session')
      }
    })
    if (!isMock) {
      void Promise.all([client.contracts(), client.demands(), client.proposals()])
        .then(([ct, dm, pr]) => {
          if (active) {
            setContracts(ct)
            setDemands(dm)
            setProposals(pr)
          }
        })
        .catch(() => {})
    }
    const timer = setTimeout(
      () => {
        setSession(null)
        setToken('')
        sessionStorage.removeItem('fln-session')
        notify('Sua sessão terminou. Entre novamente.')
      },
      Math.max(0, (session.expiresAt || 0) - Date.now()),
    )
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [session])
  useEffect(() => {
    sessionStorage.setItem(
      isMock ? 'fln-contracts' : 'fln-api-contracts',
      JSON.stringify(contracts),
    )
  }, [contracts])
  useEffect(() => {
    sessionStorage.setItem(isMock ? 'fln-demands' : 'fln-api-demands', JSON.stringify(demands))
  }, [demands])
  useEffect(() => {
    sessionStorage.setItem(
      isMock ? 'fln-proposals' : 'fln-api-proposals',
      JSON.stringify(proposals),
    )
  }, [proposals])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => notify(''), 4500)
    return () => clearTimeout(t)
  }, [toast])
  function signIn(s: Session) {
    const timed = { ...s, expiresAt: s.expiresAt || Date.now() + s.expiresIn * 1000 }
    setToken(timed.accessToken)
    setSession(timed)
    sessionStorage.setItem('fln-session', JSON.stringify(timed))
  }
  async function reloadContracts() {
    if (isMock || !session) return
    try {
      setContracts(await client.contracts())
    } catch {
      // Keep the list already on screen; the next action reports API errors.
    }
  }
  async function requestContract(r: CreateContract): Promise<Contract> {
    const u = session?.user
    if (!u) throw new Error('Entre na sua conta para solicitar um serviço.')
    if (!isMock) {
      const created = await client.createContract(r)
      setContracts((cs) => [created, ...cs.filter((x) => x.id !== created.id)])
      return created
    }
    const s = services.find((x) => x.id === r.serviceId)
    if (!s) throw new Error('Serviço não encontrado.')
    if (r.date <= today()) throw new Error('Selecione uma data futura.')
    if (
      contracts.some(
        (c) => c.clientId === u.id && c.serviceId === r.serviceId && c.status === 'PENDENTE',
      )
    )
      throw new Error('Você já tem uma solicitação pendente para este serviço.')
    const c: Contract = {
      id: crypto.randomUUID(),
      serviceId: s.id,
      title: s.title,
      freelancerId: s.freelancer.id,
      freelancerName: s.freelancer.name,
      clientId: u.id,
      clientName: u.name,
      price: s.price,
      date: r.date,
      description: r.description,
      address: r.address,
      status: 'PENDENTE',
      history: [{ status: 'PENDENTE', at: nowIso() }],
    }
    setContracts((cs) => [c, ...cs])
    return c
  }
  async function transition(id: string, status: ContractStatus, dispute?: string) {
    const c = contracts.find((c) => c.id === id),
      u = session?.user
    if (!u) throw new Error('Esta mudança de status não é permitida para seu perfil.')
    if (!isMock) {
      const updated = await client.transitionContract(id, status, dispute)
      setContracts((cs) => cs.map((x) => (x.id === id ? { ...x, ...updated } : x)))
      notify(`Contratação: ${status.replaceAll('_', ' ').toLowerCase()}.`)
      return
    }
    if (
      !c ||
      !canTransition(c.status, status, u.role) ||
      (u.role === 'CLIENT' && c.clientId !== u.id) ||
      (u.role === 'FREELANCER' && c.freelancerId !== u.id)
    )
      throw new Error('Esta mudança de status não é permitida para seu perfil.')
    const at = new Date().toISOString()
    setContracts((cs) =>
      cs.map((x) =>
        x.id === id
          ? {
              ...x,
              status,
              dispute: status === 'EM_DISPUTA' ? dispute : x.dispute,
              observations: status === 'AGUARDANDO_CONFIRMACAO' ? dispute : x.observations,
              completedAt: status === 'CONCLUIDO' ? at : x.completedAt,
              history: [...x.history, { status, at }],
            }
          : x,
      ),
    )
    notify(`Contratação: ${status.replaceAll('_', ' ').toLowerCase()}.`)
  }
  async function review(id: string, rating: number, comment: string) {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5 || comment.length > 500)
      throw new Error('Informe uma nota de 1 a 5 e um comentário de até 500 caracteres.')
    if (!isMock) {
      const savedReview = await client.reviewContract(id, rating, comment)
      setContracts((cs) =>
        cs.map((x) =>
          x.id === id
            ? {
                ...x,
                rating: savedReview.rating,
                review: savedReview.comment,
                reviewedAt: savedReview.createdAt,
              }
            : x,
        ),
      )
      await refresh()
      notify('Avaliação publicada.')
      return
    }
    const c = contracts.find((c) => c.id === id)
    if (!c || c.clientId !== session?.user.id || c.rating || !canReview(c.status, c.completedAt))
      throw new Error(
        'A avaliação exige uma contratação concluída nos últimos 7 dias e ainda não avaliada.',
      )
    setContracts((cs) =>
      cs.map((x) => (x.id === id ? { ...x, rating, review: comment, reviewedAt: nowIso() } : x)),
    )
    notify('Avaliação publicada.')
  }
  async function replyReview(id: string, reply: string) {
    const trimmed = reply.trim()
    if (!trimmed || trimmed.length > 200)
      throw new Error('A resposta deve ter entre 1 e 200 caracteres.')
    if (!isMock) {
      const updated = await client.replyReview(id, trimmed)
      setContracts((cs) =>
        cs.map((x) => (x.id === id ? { ...x, reviewReply: updated.reply || trimmed } : x)),
      )
      notify('Resposta publicada.')
      return
    }
    const c = contracts.find((c) => c.id === id)
    if (!c || c.freelancerId !== session?.user.id || !c.rating || c.reviewReply)
      throw new Error('Não foi possível responder a esta avaliação.')
    setContracts((cs) => cs.map((x) => (x.id === id ? { ...x, reviewReply: trimmed } : x)))
    notify('Resposta publicada.')
  }
  async function createDemand(r: CreateDemand): Promise<Demand> {
    const u = session?.user
    if (!u || u.role !== 'CLIENT') throw new Error('Somente clientes podem publicar demandas.')
    if (!isMock) {
      const created = await client.createDemand(r)
      setDemands((ds) => [created, ...ds.filter((x) => x.id !== created.id)])
      return created
    }
    const created: Demand = {
      id: crypto.randomUUID(),
      clientId: u.id,
      title: r.title,
      description: r.description,
      categoryId: r.categoryId,
      budget: r.budget,
      days: r.days,
      city: r.city,
      status: 'OPEN',
    }
    setDemands((ds) => [created, ...ds])
    return created
  }
  async function createProposal(demandId: string, r: CreateProposal): Promise<Proposal> {
    const u = session?.user
    if (!u || u.role !== 'FREELANCER')
      throw new Error('Somente freelancers podem enviar propostas.')
    if (!isMock) {
      const created = await client.createProposal(demandId, r)
      setProposals((ps) => [...ps.filter((x) => x.id !== created.id), created])
      return created
    }
    const d = demands.find((x) => x.id === demandId)
    if (!d || d.status !== 'OPEN') throw new Error('Esta demanda não recebe novas propostas.')
    if (
      proposals.some(
        (p) => p.demandId === demandId && p.freelancerId === u.id && p.status === 'PENDING',
      )
    )
      throw new Error('Você já enviou uma proposta para esta demanda.')
    const created: Proposal = {
      id: crypto.randomUUID(),
      demandId,
      freelancerId: u.id,
      freelancerName: u.name,
      price: r.price,
      days: r.days,
      message: r.message,
      status: 'PENDING',
    }
    setProposals((ps) => [...ps, created])
    return created
  }
  async function acceptProposal(proposalId: string): Promise<Contract> {
    const u = session?.user
    if (!u || u.role !== 'CLIENT') throw new Error('Esta proposta não pode ser aceita.')
    if (!isMock) {
      const accepted = await client.acceptProposal(proposalId)
      setDemands((ds) => ds.map((x) => (x.id === accepted.demand.id ? accepted.demand : x)))
      setProposals((ps) =>
        ps.map((x) => {
          if (x.id === accepted.proposal.id) return accepted.proposal
          if (x.demandId === accepted.demand.id && x.status === 'PENDING')
            return { ...x, status: 'REJECTED' }
          return x
        }),
      )
      setContracts((cs) => [
        accepted.contract,
        ...cs.filter((x) => x.id !== accepted.contract.id),
      ])
      notify('Proposta aceita e contratação criada.')
      return accepted.contract
    }
    const p = proposals.find((x) => x.id === proposalId)
    const d = p ? demands.find((x) => x.id === p.demandId) : undefined
    if (!p || !d || d.clientId !== u.id || d.status !== 'OPEN' || p.status !== 'PENDING')
      throw new Error('Esta proposta não pode ser aceita.')
    const cid = crypto.randomUUID()
    setProposals((ps) =>
      ps.map((x) =>
        x.demandId === d.id
          ? {
              ...x,
              status:
                x.id === proposalId ? 'ACCEPTED' : x.status === 'PENDING' ? 'REJECTED' : x.status,
            }
          : x,
      ),
    )
    setDemands((ds) => ds.map((x) => (x.id === d.id ? { ...x, status: 'CLOSED' } : x)))
    const contract: Contract = {
      id: cid,
      serviceId: 'proposal-' + p.id,
      title: d.title,
      freelancerId: p.freelancerId,
      freelancerName: p.freelancerName,
      clientId: u.id,
      clientName: u.name,
      price: p.price,
      date: futureDate(),
      description: d.description,
      address: d.city,
      status: 'ACEITO',
      history: [{ status: 'ACEITO', at: nowIso() }],
    }
    setContracts((cs) => [contract, ...cs])
    notify('Proposta aceita e contratação criada.')
    return contract
  }
  async function rejectProposal(proposalId: string): Promise<void> {
    const u = session?.user
    if (!u || u.role !== 'CLIENT') throw new Error('Esta proposta não pode ser recusada.')
    if (!isMock) {
      const updated = await client.rejectProposal(proposalId)
      setProposals((ps) => ps.map((x) => (x.id === updated.id ? updated : x)))
      notify('Proposta recusada.')
      return
    }
    setProposals((ps) =>
      ps.map((x) => (x.id === proposalId ? { ...x, status: 'REJECTED' } : x)),
    )
  }
  const enrichedProfessionals = isMock
    ? professionals.map((p) => ({ ...p, ...mockRating(contracts, p.id) }))
    : professionals
  const enrichedServices = isMock
    ? services.map((s) => ({
        ...s,
        freelancer: { ...s.freelancer, ...mockRating(contracts, s.freelancer.id) },
      }))
    : services
  return (
    <Context.Provider
      value={{
        user: session?.user || null,
        services: enrichedServices,
        categories,
        professionals: enrichedProfessionals,
        loading,
        error,
        contracts,
        demands,
        proposals,
        signIn,
        signOut: () => {
          setSession(null)
          setToken('')
          sessionStorage.removeItem('fln-session')
          if (!isMock) {
            setContracts([])
            setDemands([])
            setProposals([])
            sessionStorage.removeItem('fln-api-contracts')
            sessionStorage.removeItem('fln-api-demands')
            sessionStorage.removeItem('fln-api-proposals')
          }
        },
        refresh,
        updateUser: (u) => {
          if (session) signIn({ ...session, user: u })
        },
        setDemands,
        setProposals,
        addContract: (c) => setContracts((cs) => [c, ...cs]),
        createDemand,
        createProposal,
        acceptProposal,
        rejectProposal,
        requestContract,
        transition,
        review,
        replyReview,
        reloadContracts,
        toast,
        notify,
      }}
    >
      {children}
      <div role="status" className={`toast ${toast ? 'visible' : ''}`}>
        {toast}
      </div>
      {!isMock && <span className="sr-only">Modo API</span>}
    </Context.Provider>
  )
}
export function useApp() {
  const app = useContext(Context)
  if (!app) throw new Error('Provider ausente')
  return app
}
