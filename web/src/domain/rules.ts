import type {
  Contract,
  ContractStatus,
  Demand,
  DemandStatus,
  Proposal,
  ProposalStatus,
  ReportStatus,
  Role,
} from './types'
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
  ACEITO: 'Aceita',
  EM_ANDAMENTO: 'Em andamento',
  AGUARDANDO_CONFIRMACAO: 'Aguardando confirmação',
  CONCLUIDO: 'Concluída',
  EM_DISPUTA: 'Em disputa',
  RECUSADO: 'Recusada',
  CANCELADO: 'Cancelada',
}
/** Explains, to whoever is looking, what happens next in a contract. */
export function nextStepHint(status: ContractStatus, role: Role | undefined, other: string) {
  const client = role === 'CLIENT'
  switch (status) {
    case 'PENDENTE':
      return client
        ? `${other} tem até 48 horas para aceitar ou recusar. Sem resposta, a solicitação é cancelada.`
        : `Aceite ou recuse em até 48 horas. Sem resposta, a solicitação é cancelada.`
    case 'ACEITO':
      return client
        ? `${other} inicia o serviço na data combinada. Até lá, qualquer parte pode cancelar com motivo.`
        : `Inicie o serviço na data combinada. Até lá, qualquer parte pode cancelar com motivo.`
    case 'EM_ANDAMENTO':
      return client
        ? `Quando terminar, ${other} marca a conclusão e você confirma a entrega.`
        : `Quando terminar, marque a conclusão com uma observação para ${other} confirmar.`
    case 'AGUARDANDO_CONFIRMACAO':
      return client
        ? 'Confirme a entrega ou conteste em até 5 dias. Sem resposta, a conclusão é confirmada.'
        : `${other} tem até 5 dias para confirmar ou contestar. Sem resposta, a conclusão é confirmada.`
    case 'CONCLUIDO':
      return client
        ? 'Serviço concluído. Você pode avaliar o profissional em até 7 dias.'
        : 'Serviço concluído. Se o cliente avaliar, você pode responder uma vez.'
    case 'EM_DISPUTA':
      return 'A administração analisa o caso e decide. Você recebe um aviso quando houver decisão.'
    case 'RECUSADO':
      return 'A solicitação foi recusada. Nenhuma outra ação é necessária.'
    case 'CANCELADO':
      return 'A contratação foi cancelada. Nenhuma outra ação é necessária.'
  }
}
/** Ratings in Brazilian format: 4,5. */
export const ratingLabel = (value: number) =>
  value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const transitions: Partial<Record<ContractStatus, Partial<Record<Role, ContractStatus[]>>>> = {
  PENDENTE: { CLIENT: ['CANCELADO'], FREELANCER: ['ACEITO', 'RECUSADO'] },
  // Either party cancels (with a reason) until the work starts; afterwards only a dispute remains.
  ACEITO: { CLIENT: ['CANCELADO'], FREELANCER: ['EM_ANDAMENTO', 'CANCELADO'] },
  EM_ANDAMENTO: { CLIENT: ['EM_DISPUTA'], FREELANCER: ['AGUARDANDO_CONFIRMACAO', 'EM_DISPUTA'] },
  AGUARDANDO_CONFIRMACAO: { CLIENT: ['CONCLUIDO', 'EM_DISPUTA'] },
  EM_DISPUTA: { ADMIN: ['CONCLUIDO', 'EM_ANDAMENTO', 'CANCELADO'] },
}
/** Dispute opening and the administrator's decision, read from the contract history. */
export function disputeOf(c: Contract) {
  const i = c.history.findLastIndex((h) => h.status === 'EM_DISPUTA')
  if (i < 0) return null
  const opened = c.history[i],
    decision = c.history[i + 1]
  return {
    reason: opened.comment || c.dispute || '',
    at: opened.at,
    by: opened.actorRole,
    decision: decision && {
      status: decision.status,
      at: decision.at,
      note: decision.comment || '',
    },
  }
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
export const MAX_SERVICE_IMAGES = 5
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
/** Client-side mirror of RN08; the API re-checks the file signature and size. */
export function imageSelectionError(files: { type: string; size: number }[], current = 0) {
  if (current + files.length > MAX_SERVICE_IMAGES)
    return `Cada anúncio pode ter no máximo ${MAX_SERVICE_IMAGES} imagens.`
  if (files.some((f) => f.type !== 'image/jpeg' && f.type !== 'image/png'))
    return 'Envie apenas imagens JPG ou PNG.'
  if (files.some((f) => f.size > MAX_IMAGE_BYTES)) return 'Cada imagem pode ter no máximo 5 MB.'
  return ''
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
/** Only same-app paths are accepted as post-login destinations (no external or auth pages). */
export function safeRedirect(from: unknown, fallback: string) {
  if (typeof from !== 'string' || !from.startsWith('/') || from.startsWith('//')) return fallback
  if (
    from.includes('\\') ||
    /^\/(login|cadastro|recuperar-senha|redefinir-senha)(\/|\?|$)/.test(from)
  )
    return fallback
  return from
}
/** Returns an error message, or '' when the new password and its confirmation are valid. */
export function checkNewPassword(d: FormData) {
  const password = String(d.get('password'))
  if (!validPassword(password))
    return 'Use pelo menos 8 caracteres com letras e números, até 72 bytes.'
  if (password !== String(d.get('confirm'))) return 'As senhas não conferem.'
  return ''
}
export const roleLabel: Record<Role, string> = {
  CLIENT: 'Cliente',
  FREELANCER: 'Profissional',
  ADMIN: 'Administração',
}
export const accountStatusLabel = (u: { active: boolean; deleted?: boolean }) =>
  u.deleted ? 'Excluída' : u.active ? 'Ativa' : 'Suspensa'
const auditActions: Record<string, string> = {
  ACCOUNT_DELETED: 'Conta excluída pelo titular',
  ADMIN_CREATED: 'Conta de administração criada',
  CATEGORY_CREATED: 'Categoria criada',
  CATEGORY_UPDATED: 'Categoria atualizada',
  DISPUTE_DECIDED: 'Disputa decidida',
  REPORT_DECIDED: 'Denúncia decidida',
  USER_STATUS: 'Status de conta alterado',
}
const auditTargets: Record<string, string> = {
  CATEGORY: 'Categoria',
  CONTRACT: 'Contratação',
  REPORT: 'Denúncia',
  USER: 'Conta',
}
export const auditActionLabel = (code: string) => auditActions[code] || code
export const auditTargetLabel = (code: string) => auditTargets[code] || code
/** Turns stored before/after codes (statuses, flags) into words for the audit log. */
export function auditValueLabel(value: string | null | undefined) {
  if (!value) return '—'
  const words: Record<string, string> = {
    true: 'Ativa',
    false: 'Inativa',
    PENDING: 'Pendente',
    KEPT: 'Mantido',
    REMOVED: 'Removido',
    ...roleLabel,
    ...statusLabel,
  }
  const category = /^(.*) \/ active=(true|false)$/.exec(value)
  if (category) return `${category[1]} · ${category[2] === 'true' ? 'ativa' : 'inativa'}`
  return words[value] || value
}
export const demandStatusLabel: Record<DemandStatus, string> = {
  OPEN: 'Aberta',
  CLOSED: 'Encerrada',
  CANCELLED: 'Cancelada',
}
export const proposalStatusLabel: Record<ProposalStatus, string> = {
  PENDING: 'Aguardando decisão',
  ACCEPTED: 'Aceita',
  REJECTED: 'Não selecionada',
  WITHDRAWN: 'Retirada',
}
export const reportStatusLabel: Record<ReportStatus, string> = {
  PENDING: 'Em análise',
  KEPT: 'Conteúdo mantido',
  REMOVED: 'Conteúdo removido',
}
/** The text of a demand is locked once the first proposal arrives, as in the API. */
export function canEditDemand(
  d: Pick<Demand, 'id' | 'status'>,
  proposals: Pick<Proposal, 'demandId'>[],
) {
  return d.status === 'OPEN' && !proposals.some((p) => p.demandId === d.id)
}
/** Open demands a freelancer can still answer, best matches (their categories and city) first. */
export function compatibleDemands(
  demands: Demand[],
  proposals: Pick<Proposal, 'demandId' | 'freelancerId' | 'status'>[],
  freelancerId: string,
  categoryIds: string[],
  city: string,
) {
  const answered = new Set(
    proposals
      .filter((p) => p.freelancerId === freelancerId && p.status !== 'WITHDRAWN')
      .map((p) => p.demandId),
  )
  const town = city.split(',')[0].trim().toLowerCase()
  const score = (d: Demand) =>
    (categoryIds.includes(d.categoryId) ? 2 : 0) +
    (town && d.city.toLowerCase().includes(town) ? 1 : 0)
  return demands
    .filter((d) => d.status === 'OPEN' && !answered.has(d.id))
    .sort((a, b) => score(b) - score(a) || (b.createdAt || '').localeCompare(a.createdAt || ''))
}
