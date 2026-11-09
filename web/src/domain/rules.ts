import type { Contract, ContractStatus, Role } from './types'
export const nowIso = () => new Date().toISOString()

export const money = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
export const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .filter((_, i, a) => i === 0 || i === a.length - 1)
    .join('')
    .toUpperCase()
export const statusLabel: Record<ContractStatus, string> = {
  PENDENTE: 'Pendente',
  ACEITO: 'Aceito',
  EM_ANDAMENTO: 'Em andamento',
  AGUARDANDO_CONFIRMACAO: 'Aguardando confirmação',
  CONCLUIDO: 'Concluído',
  EM_DISPUTA: 'Em disputa',
  RECUSADO: 'Recusado',
  CANCELADO: 'Cancelado',
}
const transitions: Partial<Record<ContractStatus, Partial<Record<Role, ContractStatus[]>>>> = {
  PENDENTE: { CLIENT: ['CANCELADO'], FREELANCER: ['ACEITO', 'RECUSADO'] },
  ACEITO: { FREELANCER: ['EM_ANDAMENTO'] },
  EM_ANDAMENTO: { FREELANCER: ['AGUARDANDO_CONFIRMACAO'] },
  AGUARDANDO_CONFIRMACAO: { CLIENT: ['CONCLUIDO', 'EM_DISPUTA'] },
  EM_DISPUTA: { ADMIN: ['CONCLUIDO', 'EM_ANDAMENTO'] },
}
export function canTransition(from: ContractStatus, to: ContractStatus, role: Role) {
  return transitions[from]?.[role]?.includes(to) ?? false
}
export function canReview(status: ContractStatus, completedAt?: string, now = Date.now()) {
  return (
    status === 'CONCLUIDO' &&
    !!completedAt &&
    now >= Date.parse(completedAt) &&
    now <= Date.parse(completedAt) + 7 * 86400000
  )
}
export function dateLabel(iso: string) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? ''
    : new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d)
}
const HOUR = 3600000
// Mirrors the API jobs: 48h to answer a request, 5 days to confirm, 7 days to review.
export function contractDeadline(
  c: Pick<Contract, 'status' | 'history' | 'completedAt' | 'rating'>,
): { text: string; at: string } | null {
  const since = c.history.at(-1)?.at
  const plus = (iso: string | undefined, hours: number) =>
    iso && !Number.isNaN(Date.parse(iso))
      ? new Date(Date.parse(iso) + hours * HOUR).toISOString()
      : null
  if (c.status === 'PENDENTE') {
    const at = plus(since, 48)
    return at ? { text: 'Sem resposta, a solicitação é cancelada em', at } : null
  }
  if (c.status === 'AGUARDANDO_CONFIRMACAO') {
    const at = plus(since, 5 * 24)
    return at ? { text: 'Sem resposta do cliente, a conclusão é confirmada em', at } : null
  }
  if (c.status === 'CONCLUIDO' && !c.rating) {
    const at = plus(c.completedAt, 7 * 24)
    return at ? { text: 'A avaliação pode ser enviada até', at } : null
  }
  return null
}
export function validPassword(password: string) {
  return (
    /\p{L}/u.test(password) &&
    /\d/.test(password) &&
    password.length >= 8 &&
    new TextEncoder().encode(password).length <= 72
  )
}
export function today() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}
export function futureDate(days = 7) {
  const d = new Date(Date.now() + days * 86400000)
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}
