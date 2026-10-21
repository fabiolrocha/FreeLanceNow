import type { Category, Demand, Service, User } from '../domain/types'
import { isMock, request } from './client'
import { demoUsers } from './fixtures'
export type FeedKind = 'UPDATE' | 'SERVICE' | 'DEMAND'
export interface FeedItem {
  id: string
  type: FeedKind
  author: Pick<User, 'id' | 'name' | 'role' | 'city'>
  title: string
  text: string
  createdAt: string
  category: Pick<Category, 'id' | 'name'> | null
  serviceId: string | null
  price: number | null
  days: number | null
  city: string | null
}
export interface FeedPage {
  items: FeedItem[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}
export interface CreatePost {
  text: string
  categoryId?: string
  serviceId?: string
}
export interface FeedSource {
  user: User
  services: Service[]
  demands: Demand[]
  categories: Category[]
}
interface MockPost extends FeedItem {
  hidden?: boolean
}
function readPosts(): MockPost[] {
  try {
    return JSON.parse(sessionStorage.getItem('fln-feed-posts') || '[]')
  } catch {
    return []
  }
}
function safeAuthor(u: Pick<User, 'id' | 'name' | 'role' | 'city'>) {
  return { id: u.id, name: u.name, role: u.role, city: u.city }
}
export function moderateMockPost(id: string) {
  sessionStorage.setItem(
    'fln-feed-posts',
    JSON.stringify(readPosts().map((p) => (p.id === id ? { ...p, hidden: true } : p))),
  )
}
export const feedApi = {
  async list(source: FeedSource, page = 0, type = '', categoryId = ''): Promise<FeedPage> {
    if (!isMock)
      return request(
        `/feed?${new URLSearchParams({ page: String(page), size: '20', ...(type ? { type } : {}), ...(categoryId ? { categoryId } : {}) })}`,
      )
    const { user, services, demands, categories } = source
    const visibleServices = services.filter((s) => s.status === 'ACTIVE' && !s.moderated)
    const authors: User[] =
      JSON.parse(sessionStorage.getItem('fln-mock-users') || 'null') || demoUsers
    // Dates on legacy fixtures are deliberately fixed in this explicitly fictitious mode.
    const date = '2026-09-30T12:00:00Z'
    const items: FeedItem[] = [
      ...readPosts().filter(
        (p) => !p.hidden && (!p.serviceId || visibleServices.some((s) => s.id === p.serviceId)),
      ),
      ...visibleServices.map((s) => ({
        id: s.id,
        type: 'SERVICE' as const,
        author: safeAuthor(s.freelancer),
        title: s.title,
        text: s.description,
        createdAt: s.createdAt || date,
        category: s.category,
        serviceId: s.id,
        price: s.price,
        days: s.deliveryDays,
        city: s.freelancer.city,
      })),
      ...demands
        .filter((d) => d.status === 'OPEN' && (user.role !== 'CLIENT' || d.clientId === user.id))
        .map((d) => ({
          id: d.id,
          type: 'DEMAND' as const,
          author: safeAuthor(
            authors.find((u) => u.id === d.clientId) || {
              id: d.clientId,
              name: 'Cliente da demonstração',
              role: 'CLIENT' as const,
              city: d.city,
            },
          ),
          title: d.title,
          text: d.description,
          createdAt: d.createdAt || date,
          category: categories.find((c) => c.id === d.categoryId) || null,
          serviceId: null,
          price: d.budget,
          days: d.days,
          city: d.city,
        })),
    ]
      .filter((p) => (!type || p.type === type) && (!categoryId || p.category?.id === categoryId))
      .sort(
        (a, b) =>
          b.createdAt.localeCompare(a.createdAt) ||
          b.id.localeCompare(a.id) ||
          a.type.localeCompare(b.type),
      )
    return {
      items: items.slice(page * 20, page * 20 + 20),
      page,
      size: 20,
      totalElements: items.length,
      totalPages: Math.ceil(items.length / 20),
    }
  },
  async create(source: FeedSource, r: CreatePost): Promise<FeedItem> {
    if (!isMock) return request('/feed/posts', { method: 'POST', body: JSON.stringify(r) })
    if (!r.text.trim() || r.text.length > 500) throw new Error('Escreva entre 1 e 500 caracteres.')
    const service = r.serviceId
      ? source.services.find(
          (s) =>
            s.id === r.serviceId &&
            s.freelancer.id === source.user.id &&
            s.status === 'ACTIVE' &&
            !s.moderated,
        )
      : undefined
    if (r.serviceId && !service) throw new Error('Selecione um serviço seu que esteja publicado.')
    const category =
      service?.category || source.categories.find((c) => c.id === r.categoryId) || null
    const p: FeedItem = {
      id: crypto.randomUUID(),
      type: 'UPDATE',
      author: safeAuthor(source.user),
      title: 'Publicação profissional',
      text: r.text.trim(),
      createdAt: new Date().toISOString(),
      category,
      serviceId: service?.id || null,
      price: null,
      days: null,
      city: null,
    }
    sessionStorage.setItem('fln-feed-posts', JSON.stringify([p, ...readPosts()]))
    return p
  },
  async hide(source: FeedSource, id: string): Promise<void> {
    if (!isMock) {
      await request(`/feed/posts/${id}/hide`, { method: 'PATCH' })
      return
    }
    if (!readPosts().some((p) => p.id === id && p.author.id === source.user.id))
      throw new Error('Você só pode retirar suas publicações.')
    moderateMockPost(id)
  },
}
