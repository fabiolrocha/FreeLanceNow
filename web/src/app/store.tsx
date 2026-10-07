/* oxlint-disable react/only-export-components -- provider and its hook share the same context module */
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type {
  Category,
  Contract,
  ContractStatus,
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
import { canReview, canTransition } from '../domain/rules'

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
  transition: (id: string, status: ContractStatus, dispute?: string) => void
  review: (id: string, rating: number, comment: string) => void
  toast: string
  notify: (s: string) => void
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
    saved('fln-contracts', initialContracts),
  )
  const [demands, setDemands] = useState<Demand[]>(() => saved('fln-demands', initialDemands))
  const [proposals, setProposals] = useState<Proposal[]>(() =>
    saved('fln-proposals', initialProposals),
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
      const [s, c, p] = await Promise.all([
        client.services(),
        client.categories(),
        client.professionals(),
      ])
      setServices(s)
      setCategories(c)
      setProfessionals(p)
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
    sessionStorage.setItem('fln-contracts', JSON.stringify(contracts))
  }, [contracts])
  useEffect(() => {
    sessionStorage.setItem('fln-demands', JSON.stringify(demands))
  }, [demands])
  useEffect(() => {
    sessionStorage.setItem('fln-proposals', JSON.stringify(proposals))
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
  function transition(id: string, status: ContractStatus, dispute?: string) {
    const c = contracts.find((c) => c.id === id),
      u = session?.user
    if (
      !c ||
      !u ||
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
  function review(id: string, rating: number, comment: string) {
    const c = contracts.find((c) => c.id === id)
    if (!c || c.clientId !== session?.user.id || c.rating || !canReview(c.status, c.completedAt))
      throw new Error(
        'A avaliação exige uma contratação concluída nos últimos 7 dias e ainda não avaliada.',
      )
    if (!Number.isInteger(rating) || rating < 1 || rating > 5 || comment.length > 500)
      throw new Error('Informe uma nota de 1 a 5 e um comentário de até 500 caracteres.')
    setContracts((cs) => cs.map((x) => (x.id === id ? { ...x, rating, review: comment } : x)))
    notify('Avaliação publicada.')
  }
  return (
    <Context.Provider
      value={{
        user: session?.user || null,
        services,
        categories,
        professionals,
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
        },
        refresh,
        updateUser: (u) => {
          if (session) signIn({ ...session, user: u })
        },
        setDemands,
        setProposals,
        addContract: (c) => setContracts((cs) => [c, ...cs]),
        transition,
        review,
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
