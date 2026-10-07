import type {
  Category,
  Profile,
  Register,
  SaveService,
  Service,
  ServiceStatus,
  Session,
  User,
} from '../domain/types'
import { categories, demoUsers, professionals, services } from './fixtures'
import { validPassword } from '../domain/rules'

export const dataMode = import.meta.env.VITE_DATA_MODE || 'mock'
if (!['mock', 'api'].includes(dataMode)) throw new Error('VITE_DATA_MODE deve ser mock ou api.')
export const isMock = dataMode === 'mock'
const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api/v1'
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
  deliveryDays: 'prazo',
  status: 'status',
}
export function setToken(value: string) {
  token = value
}
export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) {
    const problem = await res.json().catch(() => ({}))
    const fields = Object.keys(problem.errors || {}).map((k) => fieldLabels[k] || k)
    const detail = problem.detail || `Não foi possível concluir (${res.status}).`
    throw new Error(fields.length ? `${detail} Campos: ${fields.join(', ')}.` : detail)
  }
  return res.json() as Promise<T>
}
function read<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(sessionStorage.getItem(key) || 'null') ?? structuredClone(fallback)
  } catch {
    return structuredClone(fallback)
  }
}
// Public data never carries contact fields, mirroring UserDtos.PublicProfile in the API.
const publicProfile = ({ id, name, role, city, bio }: Profile): Profile => ({
  id,
  name,
  role,
  city,
  bio,
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
const session = (user: User): Session => ({
  accessToken: `mock-${user.id}`,
  tokenType: 'Bearer',
  expiresIn: 900,
  user,
})
export const client = {
  async login(email: string, password: string): Promise<Session> {
    if (!isMock)
      return request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
    const user = accounts.find((u) => u.email === email.trim().toLowerCase())
    const hash = user && hashes[user.id]
    const valid = hash
      ? (await digest(hash.salt + password)) === hash.digest
      : password === 'Demo12345'
    if (!user || !valid) throw new Error('E-mail ou senha incorretos. Verifique e tente novamente.')
    return session(user)
  },
  async register(r: Register): Promise<Session> {
    if (!isMock) return request('/auth/register', { method: 'POST', body: JSON.stringify(r) })
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
  async me(user: User): Promise<User> {
    return isMock ? accounts.find((u) => u.id === user.id) || user : request('/users/me')
  },
  async updateProfile(u: User): Promise<User> {
    if (!isMock)
      return request('/users/me', {
        method: 'PUT',
        body: JSON.stringify({ name: u.name, phone: u.phone, city: u.city, bio: u.bio }),
      })
    accounts = accounts.map((x) => (x.id === u.id ? u : x))
    profiles = profiles.map((x) => (x.id === u.id ? publicProfile(u) : x))
    listings = listings.map((x) =>
      x.freelancer.id === u.id ? { ...x, freelancer: publicProfile(u) } : x,
    )
    persist()
    return u
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
}
