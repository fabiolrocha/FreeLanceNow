import type { Contract, User } from '../domain/types'
import { statusLabel } from '../domain/rules'
import { isMock, request } from './client'

export interface AppNotification {
  id: string
  type: string
  title: string
  body: string
  link: string
  createdAt: string
  readAt: string | null
}
export interface Inbox {
  items: AppNotification[]
  unread: number
}
export interface ChatMessage {
  id: string
  contractId: string
  authorId: string
  authorName: string
  text: string
  at: string
}

function read<T>(key: string, fallback: T): T {
  try {
    return (JSON.parse(sessionStorage.getItem(key) || 'null') as T) ?? fallback
  } catch {
    return fallback
  }
}
const READ_KEY = 'fln-mock-notifications-read',
  CHAT_KEY = 'fln-mock-messages'

// The mock has no event log, so each own contract becomes one notice about its current status.
function mockInbox(user: User, contracts: Contract[]): Inbox {
  const readIds = read<string[]>(READ_KEY, [])
  const items = contracts
    .filter((c) => c.clientId === user.id || c.freelancerId === user.id)
    .map((c) => {
      const id = `${c.id}:${c.status}`
      return {
        id,
        type: 'CONTRACT_STATUS',
        title: `${c.title}: ${statusLabel[c.status].toLowerCase()}`,
        body: `Contratação com ${user.id === c.clientId ? c.freelancerName : c.clientName}.`,
        link: `/contratacoes/${c.id}`,
        createdAt: c.history.at(-1)?.at || '',
        readAt: readIds.includes(id) ? c.history.at(-1)?.at || '' : null,
      }
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return { items, unread: items.filter((n) => !n.readAt).length }
}

export const inbox = {
  async list(user: User, contracts: Contract[]): Promise<Inbox> {
    return isMock ? mockInbox(user, contracts) : request('/notifications')
  },
  async unread(user: User, contracts: Contract[]): Promise<number> {
    if (isMock) return mockInbox(user, contracts).unread
    return (await request<{ unread: number }>('/notifications/unread-count')).unread
  },
  async markRead(id: string): Promise<void> {
    if (isMock) {
      const ids = read<string[]>(READ_KEY, [])
      sessionStorage.setItem(READ_KEY, JSON.stringify([...new Set([...ids, id])]))
      return
    }
    await request(`/notifications/${id}/read`, { method: 'POST' })
  },
  async markAllRead(user: User, contracts: Contract[]): Promise<void> {
    if (isMock) {
      const ids = mockInbox(user, contracts).items.map((n) => n.id)
      sessionStorage.setItem(READ_KEY, JSON.stringify(ids))
      return
    }
    await request('/notifications/read-all', { method: 'POST' })
  },
  async messages(contractId: string): Promise<ChatMessage[]> {
    if (isMock) return read<ChatMessage[]>(CHAT_KEY, []).filter((m) => m.contractId === contractId)
    return request(`/contracts/${contractId}/messages`)
  },
  async send(user: User, contractId: string, text: string): Promise<ChatMessage> {
    const clean = text.trim()
    if (!clean || clean.length > 1000)
      throw new Error('Escreva uma mensagem de 1 a 1000 caracteres.')
    if (!isMock)
      return request(`/contracts/${contractId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ text: clean }),
      })
    const message: ChatMessage = {
      id: crypto.randomUUID(),
      contractId,
      authorId: user.id,
      authorName: user.name,
      text: clean,
      at: new Date().toISOString(),
    }
    sessionStorage.setItem(
      CHAT_KEY,
      JSON.stringify([...read<ChatMessage[]>(CHAT_KEY, []), message]),
    )
    return message
  },
}
