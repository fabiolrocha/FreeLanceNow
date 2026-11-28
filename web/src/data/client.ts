import type {
  Category,
  Contract,
  ContractStatus,
  CreateContract,
  CreateDemand,
  CreateProposal,
  AcceptProposal,
  Demand,
  GoogleCredential,
  GoogleNext,
  OwnReport,
  Profile,
  Proposal,
  ProposalAcceptance,
  Register,
  Review,
  SaveService,
  Service,
  ServiceStatus,
  Session,
  User,
} from '../domain/types'
import { categories, demoUsers, professionals, services } from './fixtures'
import { validPassword } from '../domain/rules'
import { clearSession, loadSession, saveSession, timed } from './session'

export const dataMode = import.meta.env.VITE_DATA_MODE || 'mock'
if (!['mock', 'api'].includes(dataMode)) throw new Error('VITE_DATA_MODE deve ser mock ou api.')
export const isMock = dataMode === 'mock'
export const googleClientId = isMock ? undefined : import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim()
const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api/v1'
const googleDeletionPath = '/auth/google/delete-account'
let token = ''
const fieldLabels: Record<string, string> = {
  name: 'nome',
  email: 'e-mail',
  phone: 'telefone',
  password: 'senha',
  role: 'perfil',
  acceptedTerms: 'termos',
  city: 'cidade',
  bio: 'descrição',
  title: 'título',
  description: 'descrição',
  categoryId: 'categoria',
  price: 'valor',
  budget: 'orçamento',
  days: 'prazo',
  deliveryDays: 'prazo',
  message: 'mensagem',
  status: 'status',
  serviceId: 'serviço',
  date: 'data',
  address: 'endereço',
  comment: 'comentário',
  rating: 'nota',
  reply: 'resposta',
  serviceArea: 'área de atendimento',
}
export function setToken(value: string) {
  token = value
}
type SessionListener = (s: Session | null) => void
const sessionListeners = new Set<SessionListener>()
/** Notified when the client renews the session or finds that it can no longer be renewed. */
export function onSessionChange(listener: SessionListener) {
  sessionListeners.add(listener)
  return () => {
    sessionListeners.delete(listener)
  }
}
let renewing: Promise<Session | null> | null = null
/**
 * Exchanges the stored refresh token for a new session. Concurrent callers share one request.
 * Resolves to null (and clears the stored session) when the refresh token is missing or rejected.
 */
export function renewSession(): Promise<Session | null> {
  if (isMock) return Promise.resolve(null)
  renewing ??= (async () => {
    const current = loadSession()
    try {
      if (!current?.refreshToken) throw new Error('Sem sessão para renovar.')
      const next = timed(
        await send<Session>(
          '/auth/refresh',
          { method: 'POST', body: JSON.stringify({ refreshToken: current.refreshToken }) },
          '',
        ),
        current,
      )
      saveSession(next)
      token = next.accessToken
      sessionListeners.forEach((l) => l(next))
      return next
    } catch {
      clearSession()
      token = ''
      sessionListeners.forEach((l) => l(null))
      return null
    } finally {
      renewing = null
    }
  })()
  return renewing
}
/**
 * The free API instance sleeps after 15 minutes without traffic and can take up to a minute to
 * wake, so one attempt may wait that long before it gives up.
 */
const ATTEMPT_TIMEOUT_MS = 60000
/** Pauses between attempts of a read that hit a sleeping or restarting server. */
const RETRY_DELAYS_MS = [1500, 4000]
/** Gateway answers while the instance starts or redeploys; the request never reached the API. */
const RETRYABLE_STATUS = new Set([502, 503, 504])
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Turns browser-level failures (no answer at all) into messages a person can act on. */
function networkError(e: unknown): Error {
  const name = (e as { name?: string })?.name
  if (name === 'TimeoutError')
    return Object.assign(
      new Error(
        'O servidor demorou para responder. Ele pode estar iniciando; aguarde alguns segundos e tente de novo.',
        { cause: e },
      ),
      { retryable: true },
    )
  if (name === 'AbortError') return e as Error
  return Object.assign(
    new Error('Sem conexão com o servidor. Verifique sua internet e tente de novo.', { cause: e }),
    { retryable: true },
  )
}

async function attempt<T>(path: string, options: RequestInit, bearer: string): Promise<T> {
  const timeout = AbortSignal.timeout(ATTEMPT_TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        // FormData sets its own multipart boundary.
        ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        ...options.headers,
      },
      signal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout,
    })
  } catch (e) {
    throw networkError(e)
  }
  if (RETRYABLE_STATUS.has(res.status))
    throw Object.assign(
      new Error('O servidor está iniciando. Aguarde alguns segundos e tente de novo.'),
      { status: res.status, retryable: true },
    )
  if (!res.ok) {
    const problem = await res.json().catch(() => ({}))
    const fields = Object.keys(problem.errors || {}).map((k) => fieldLabels[k] || k)
    // Server errors carry the request id so support can find the log line.
    const requestId = res.status >= 500 ? res.headers.get('X-Request-Id') : null
    const detail =
      (problem.detail || `Não foi possível concluir (${res.status}).`) +
      (requestId ? ` Código do erro: ${requestId.slice(0, 8)}.` : '')
    throw Object.assign(
      new Error(fields.length ? `${detail} Campos: ${fields.join(', ')}.` : detail),
      { status: res.status },
    )
  }
  if (res.status === 204 || res.status === 202) return undefined as T
  return res.json() as Promise<T>
}

/**
 * Reads are retried when the server did not answer or the gateway said it was starting, which is
 * what a cold start looks like. Writes are sent once: a lost answer does not prove that the API
 * skipped the change, and repeating it could create a second contract or payment.
 */
async function send<T>(path: string, options: RequestInit, bearer: string): Promise<T> {
  const method = (options.method || 'GET').toUpperCase()
  const retries = method === 'GET' || method === 'HEAD' ? RETRY_DELAYS_MS : []
  for (let i = 0; ; i++) {
    try {
      return await attempt<T>(path, options, bearer)
    } catch (e) {
      if (i >= retries.length || !(e as { retryable?: boolean }).retryable) throw e
      await sleep(retries[i])
    }
  }
}
export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  try {
    return await send<T>(path, options, token)
  } catch (e) {
    // An expired access token is renewed once with the refresh token, then the call is retried.
    const isPublicAuth = path.startsWith('/auth/') && path !== googleDeletionPath
    if ((e as { status?: number }).status !== 401 || !token || isPublicAuth) throw e
    const renewed = await renewSession()
    if (renewed) return send<T>(path, options, renewed.accessToken)
    // Public endpoints still answer without credentials; private ones report the ended session.
    try {
      return await send<T>(path, options, '')
    } catch (anonymous) {
      if ((anonymous as { status?: number }).status === 401)
        throw new Error('Sua sessão terminou. Entre novamente.', { cause: e })
      throw anonymous
    }
  }
}
function read<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(sessionStorage.getItem(key) || 'null') ?? structuredClone(fallback)
  } catch {
    return structuredClone(fallback)
  }
}
// Public data never carries contact fields, mirroring UserDtos.PublicProfile in the API.
const publicProfile = ({
  id,
  name,
  role,
  city,
  bio,
  averageRating,
  reviewCount,
  serviceArea,
  avatarVersion,
  memberSince,
  specialties,
}: Profile): Profile => ({
  id,
  name,
  role,
  city,
  bio,
  averageRating,
  reviewCount,
  serviceArea,
  avatarVersion,
  memberSince,
  specialties,
})
let listings = read<Service[]>('fln-mock-services', services).map((s) => ({
  ...s,
  freelancer: publicProfile(s.freelancer),
}))
let accounts = read<User[]>('fln-mock-users', demoUsers)
let profiles = read<Profile[]>('fln-mock-profiles', professionals).map(publicProfile)
// Digests only support the mock experience. Real authentication belongs to Spring Security.
const hashes = read<Record<string, { salt: string; digest: string }>>('fln-mock-hashes', {})
async function digest(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(bytes))
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('')
}
function persist() {
  sessionStorage.setItem('fln-mock-services', JSON.stringify(listings))
  sessionStorage.setItem('fln-mock-users', JSON.stringify(accounts))
  sessionStorage.setItem('fln-mock-profiles', JSON.stringify(profiles))
  sessionStorage.setItem('fln-mock-hashes', JSON.stringify(hashes))
}
/** Public photo URL; the version busts the browser cache when the photo changes. */
export const avatarUrl = (userId: string, version?: number | null) =>
  version ? `${baseUrl}/users/${userId}/avatar?v=${version}` : undefined
/** Public URL served by the API; `<img>` tags cannot send the bearer token. */
export const serviceImageUrl = (serviceId: string, imageId: string) =>
  `${baseUrl}/services/${serviceId}/images/${imageId}`
const session = (user: User): Session => ({
  accessToken: `mock-${user.id}`,
  tokenType: 'Bearer',
  expiresIn: 900,
  user,
})
export const client = {
  async login(email: string, password: string, signal?: AbortSignal): Promise<Session> {
    if (!isMock)
      return request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        signal,
      })
    const user = accounts.find((u) => u.email === email.trim().toLowerCase())
    const hash = user && hashes[user.id]
    const valid = hash
      ? (await digest(hash.salt + password)) === hash.digest
      : password === 'Demo12345'
    if (!user || !valid) throw new Error('E-mail ou senha incorretos. Verifique e tente novamente.')
    return session(user)
  },
  googleSignIn(proof: GoogleCredential, signal: AbortSignal): Promise<GoogleNext> {
    return send('/auth/google', { method: 'POST', body: JSON.stringify(proof), signal }, '')
  },
  googleRegister(
    form: GoogleCredential & Omit<Register, 'email' | 'password'>,
    signal: AbortSignal,
  ): Promise<Session> {
    return send('/auth/google/register', { method: 'POST', body: JSON.stringify(form), signal }, '')
  },
  googleLink(proof: GoogleCredential, password: string, signal: AbortSignal): Promise<Session> {
    return send(
      '/auth/google/link',
      { method: 'POST', body: JSON.stringify({ ...proof, password }), signal },
      '',
    )
  },
  async register(r: Register, signal?: AbortSignal): Promise<Session> {
    if (!isMock)
      return request('/auth/register', { method: 'POST', body: JSON.stringify(r), signal })
    if (!validPassword(r.password) || !r.acceptedTerms)
      throw new Error('Confira a senha e aceite os termos da demonstração.')
    if (accounts.some((u) => u.email === r.email.trim().toLowerCase()))
      throw new Error('Este e-mail já está cadastrado. Deseja fazer login?')
    const user: User = {
      id: crypto.randomUUID(),
      name: r.name,
      email: r.email.trim().toLowerCase(),
      phone: r.phone,
      role: r.role,
      city: '',
      bio: '',
    }
    const salt = crypto.randomUUID()
    hashes[user.id] = { salt, digest: await digest(salt + r.password) }
    accounts.push(user)
    if (user.role === 'FREELANCER') profiles.push(publicProfile(user))
    persist()
    return session(user)
  },
  async forgotPassword(email: string): Promise<void> {
    if (isMock) return
    await request('/auth/password/forgot', { method: 'POST', body: JSON.stringify({ email }) })
  },
  async verifyEmail(verifyToken: string): Promise<void> {
    if (isMock) throw new Error('A confirmação por e-mail só funciona com a API ligada.')
    await request('/auth/email/verify', {
      method: 'POST',
      body: JSON.stringify({ token: verifyToken }),
    })
  },
  async notificationSettings(emailNotifications: boolean): Promise<User> {
    return request('/users/me/notification-settings', {
      method: 'PUT',
      body: JSON.stringify({ emailNotifications }),
    })
  },
  async resendVerification(): Promise<void> {
    if (isMock) return
    await request('/users/me/email-verification', { method: 'POST' })
  },
  async resetPassword(resetToken: string, password: string): Promise<void> {
    if (isMock) throw new Error('A redefinição por e-mail só funciona com a API ligada.')
    await request('/auth/password/reset', {
      method: 'POST',
      body: JSON.stringify({ token: resetToken, password }),
    })
  },
  async changePassword(u: User, currentPassword: string, newPassword: string): Promise<Session> {
    if (!isMock)
      return request('/users/me/password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword }),
      })
    if (!validPassword(newPassword))
      throw new Error('Use pelo menos 8 caracteres com letras e números, até 72 bytes.')
    const hash = hashes[u.id]
    const valid = hash
      ? (await digest(hash.salt + currentPassword)) === hash.digest
      : currentPassword === 'Demo12345'
    if (!valid) throw new Error('A senha atual não confere.')
    if (currentPassword === newPassword)
      throw new Error('A nova senha deve ser diferente da atual.')
    const salt = crypto.randomUUID()
    hashes[u.id] = { salt, digest: await digest(salt + newPassword) }
    persist()
    return session(u)
  },
  async me(user: User): Promise<User> {
    return isMock ? accounts.find((u) => u.id === user.id) || user : request('/users/me')
  },
  async updateProfile(u: User): Promise<User> {
    if (!isMock)
      return request('/users/me', {
        method: 'PUT',
        body: JSON.stringify({
          name: u.name,
          phone: u.phone,
          city: u.city,
          bio: u.bio,
          serviceArea: u.serviceArea || '',
        }),
      })
    accounts = accounts.map((x) => (x.id === u.id ? u : x))
    profiles = profiles.map((x) => (x.id === u.id ? publicProfile(u) : x))
    listings = listings.map((x) =>
      x.freelancer.id === u.id ? { ...x, freelancer: publicProfile(u) } : x,
    )
    persist()
    return u
  },
  async uploadAvatar(file: File): Promise<User> {
    if (isMock) throw new Error('A foto de perfil funciona somente com a API.')
    const body = new FormData()
    body.append('file', file)
    return request('/users/me/avatar', { method: 'PUT', body })
  },
  async deleteAvatar(): Promise<User> {
    if (isMock) throw new Error('A foto de perfil funciona somente com a API.')
    return request('/users/me/avatar', { method: 'DELETE' })
  },
  /** Anonymizes the account; the API refuses while a contract is still open. */
  async deleteAccount(u: User, password: string): Promise<void> {
    if (!isMock)
      return request('/users/me', { method: 'DELETE', body: JSON.stringify({ password }) })
    const hash = hashes[u.id]
    const valid = hash
      ? (await digest(hash.salt + password)) === hash.digest
      : password === 'Demo12345'
    if (!valid) throw new Error('A senha não confere.')
    accounts = accounts.filter((x) => x.id !== u.id)
    profiles = profiles.filter((x) => x.id !== u.id)
    listings = listings.map((s) =>
      s.freelancer.id === u.id ? { ...s, status: 'INACTIVE' as const } : s,
    )
    delete hashes[u.id]
    persist()
  },
  deleteAccountWithGoogle(proof: GoogleCredential): Promise<void> {
    return request(googleDeletionPath, {
      method: 'POST',
      body: JSON.stringify(proof),
    })
  },
  async categories(): Promise<Category[]> {
    return isMock ? categories : request('/categories')
  },
  async services(): Promise<Service[]> {
    if (isMock) return listings.filter((s) => s.status === 'ACTIVE')
    const first = await request<{ items: Service[]; totalPages: number }>('/services?size=50')
    const pages = await Promise.all(
      Array.from({ length: Math.max(0, first.totalPages - 1) }, (_, i) =>
        request<{ items: Service[] }>(`/services?size=50&page=${i + 1}`),
      ),
    )
    return [first, ...pages].flatMap((p) => p.items)
  },
  async professionals(): Promise<Profile[]> {
    return isMock ? profiles : request('/freelancers')
  },
  async mine(u: User): Promise<Service[]> {
    return isMock
      ? listings.filter((s) => s.freelancer.id === u.id)
      : request('/freelancer/services')
  },
  async saveService(u: User, r: SaveService, id?: string): Promise<Service> {
    if (!isMock)
      return request(`/services${id ? `/${id}` : ''}`, {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify(r),
      })
    if (u.role !== 'FREELANCER') throw new Error('Somente freelancers podem publicar serviços.')
    if (id && listings.some((s) => s.id === id && s.freelancer.id !== u.id))
      throw new Error('Este serviço pertence a outro profissional.')
    if (
      r.status === 'ACTIVE' &&
      listings.filter((s) => s.freelancer.id === u.id && s.status === 'ACTIVE' && s.id !== id)
        .length >= 20
    )
      throw new Error('O limite é de 20 serviços ativos por freelancer.')
    const category = categories.find((c) => c.id === r.categoryId)
    if (!category) throw new Error('Selecione uma categoria.')
    const service: Service = {
      ...r,
      createdAt: listings.find((s) => s.id === id)?.createdAt || new Date().toISOString(),
      id: id || crypto.randomUUID(),
      freelancer: publicProfile(u),
      category,
    }
    listings = id ? listings.map((s) => (s.id === id ? service : s)) : [service, ...listings]
    persist()
    return service
  },
  async status(u: User, service: Service, status: ServiceStatus): Promise<Service> {
    if (!isMock)
      return request(`/services/${service.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
    return this.saveService(u, { ...service, categoryId: service.category.id, status }, service.id)
  },
  /** Only drafts or paused listings that were never hired can be deleted. */
  async deleteService(u: User, service: Service): Promise<void> {
    if (!isMock) return request(`/services/${service.id}`, { method: 'DELETE' })
    if (service.freelancer.id !== u.id)
      throw new Error('Este serviço pertence a outro profissional.')
    if (service.status === 'ACTIVE') throw new Error('Pause o anúncio antes de excluí-lo.')
    listings = listings.filter((s) => s.id !== service.id)
    persist()
  },
  async uploadServiceImages(serviceId: string, files: File[]): Promise<Service> {
    if (isMock) throw new Error('O envio de fotos funciona somente com a API.')
    const body = new FormData()
    files.forEach((f) => body.append('files', f))
    return request(`/services/${serviceId}/images`, { method: 'POST', body })
  },
  async deleteServiceImage(serviceId: string, imageId: string): Promise<Service> {
    if (isMock) throw new Error('O envio de fotos funciona somente com a API.')
    return request(`/services/${serviceId}/images/${imageId}`, { method: 'DELETE' })
  },
  async contracts(): Promise<Contract[]> {
    return request('/contracts')
  },
  async createContract(r: CreateContract): Promise<Contract> {
    return request('/contracts', {
      method: 'POST',
      body: JSON.stringify(r),
    })
  },
  async transitionContract(
    id: string,
    status: ContractStatus,
    comment?: string,
  ): Promise<Contract> {
    return request(`/contracts/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, comment }),
    })
  },
  async reviewContract(id: string, rating: number, comment: string): Promise<Review> {
    return request(`/contracts/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ rating, comment }),
    })
  },
  async replyReview(id: string, reply: string): Promise<Review> {
    return request(`/contracts/${id}/review/reply`, {
      method: 'POST',
      body: JSON.stringify({ reply }),
    })
  },
  async freelancerReviews(freelancerId: string): Promise<Review[]> {
    return request(`/freelancers/${freelancerId}/reviews`)
  },
  async serviceReviews(serviceId: string): Promise<Review[]> {
    return request(`/services/${serviceId}/reviews`)
  },
  async demands(): Promise<Demand[]> {
    return request('/demands')
  },
  async createDemand(r: CreateDemand): Promise<Demand> {
    return request('/demands', {
      method: 'POST',
      body: JSON.stringify(r),
    })
  },
  async proposals(): Promise<Proposal[]> {
    return request('/proposals')
  },
  async createProposal(demandId: string, r: CreateProposal): Promise<Proposal> {
    return request(`/demands/${demandId}/proposals`, {
      method: 'POST',
      body: JSON.stringify(r),
    })
  },
  async updateDemand(id: string, r: CreateDemand): Promise<Demand> {
    return request(`/demands/${id}`, { method: 'PUT', body: JSON.stringify(r) })
  },
  async cancelDemand(id: string): Promise<Demand> {
    return request(`/demands/${id}/cancel`, { method: 'POST' })
  },
  async acceptProposal(proposalId: string, r: AcceptProposal = {}): Promise<ProposalAcceptance> {
    return request(`/proposals/${proposalId}/accept`, {
      method: 'POST',
      body: JSON.stringify(r),
    })
  },
  async withdrawProposal(proposalId: string): Promise<Proposal> {
    return request(`/proposals/${proposalId}/withdraw`, { method: 'POST' })
  },
  async myReports(u: User): Promise<OwnReport[]> {
    if (!isMock) return request('/reports/mine')
    return read<(OwnReport & { reporterId?: string; target?: string })[]>('fln-reports', [])
      .filter((r) => r.reporterId === u.id)
      .map((r) => ({ ...r, targetTitle: r.targetTitle || r.target || 'Conteúdo denunciado' }))
      .reverse()
  },
  async rejectProposal(proposalId: string): Promise<Proposal> {
    return request(`/proposals/${proposalId}/reject`, {
      method: 'POST',
    })
  },
}
