import { useId, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CalendarDays,
  FileText,
  MapPin,
  Tag,
  UserRound,
  Users,
  Wallet,
} from 'lucide-react'
import { useApp } from '../../app/store'
import { avatarUrl, isMock } from '../../data/client'
import {
  Avatar,
  ConfirmButton,
  Empty,
  ErrorMessage,
  Field,
  PageTitle,
  Stars,
} from '../../components/ui'
import {
  canEditDemand,
  dateLabel,
  demandStatusLabel,
  futureDate,
  money,
  proposalStatusLabel,
  ratingLabel,
  statusTone,
} from '../../domain/rules'
import type { Demand, Proposal, ProposalStatus } from '../../domain/types'
import './demands.css'

const PAGE = 10

const dayLabel = (n: number) => `${n} ${n === 1 ? 'dia' : 'dias'}`
const proposalLabel = (n: number) => `${n} ${n === 1 ? 'proposta' : 'propostas'}`

const relative = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' })
const units: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 86400],
  ['month', 30 * 86400],
  ['week', 7 * 86400],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
]
/** "há 5 horas", "ontem", "agora" — for publication and sending times. */
function timeAgo(iso: string, now = Date.now()) {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  const seconds = Math.round((t - now) / 1000)
  for (const [unit, size] of units)
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit)
  return relative.format(0, 'minute')
}
function Ago({ iso, prefix }: { iso?: string; prefix: string }) {
  const text = iso ? timeAgo(iso) : ''
  return text ? (
    <small>
      <time dateTime={iso} title={dateLabel(iso!)}>
        {prefix} {text}
      </time>
    </small>
  ) : null
}

/** How a price compares with the client's budget, in words. */
function budgetComparison(price: number, budget: number) {
  if (!(price > 0) || !(budget > 0)) return ''
  const pct = Math.round(((price - budget) / budget) * 100)
  if (pct === 0) return 'Igual ao orçamento do cliente'
  return `${Math.abs(pct)}% ${pct < 0 ? 'abaixo' : 'acima'} do orçamento`
}
function daysComparison(days: number, wanted: number) {
  if (!(days > 0) || !(wanted > 0)) return ''
  if (days <= wanted) return `Dentro do prazo pedido (${dayLabel(wanted)})`
  return `${dayLabel(days - wanted)} além do prazo pedido`
}

/**
 * Category name and proposal count of a demand. In mock mode the stored demand objects can be
 * stale, so the count always comes from the proposals in the store; the API sends `proposalCount`
 * (withdrawn proposals excluded), which is the only source a freelancer has for other people's
 * proposals.
 */
function useDemandInfo() {
  const { categories, proposals } = useApp()
  return {
    category: (d: Demand) =>
      d.categoryName || categories.find((c) => c.id === d.categoryId)?.name || 'Sem categoria',
    count: (d: Demand) => {
      const computed = proposals.filter(
        (p) => p.demandId === d.id && p.status !== 'WITHDRAWN',
      ).length
      return isMock ? computed : (d.proposalCount ?? computed)
    },
    pending: (d: Demand) =>
      proposals.filter((p) => p.demandId === d.id && p.status === 'PENDING').length,
  }
}
const clientName = (d: Demand) => d.clientName || 'Cliente'

function StatusBadge({ status, label }: { status: string; label: string }) {
  return <span className={`badge status ${statusTone(status)}`}>{label}</span>
}
function Fact({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div>
      <dt>
        {icon}
        {label}
      </dt>
      <dd>{children}</dd>
    </div>
  )
}

export function Demands() {
  const { demands, user, proposals, categories } = useApp(),
    info = useDemandInfo()
  const [category, setCategory] = useState(''),
    [city, setCity] = useState(''),
    [shown, setShown] = useState(PAGE)
  const isClient = user?.role === 'CLIENT'
  // The freelancer's latest non-withdrawn proposal per demand, to show instead of the CTA.
  const answered = new Map<string, Proposal>()
  for (const p of proposals)
    if (p.freelancerId === user?.id && p.status !== 'WITHDRAWN') {
      const prev = answered.get(p.demandId)
      if (!prev || (p.createdAt || '') >= (prev.createdAt || '')) answered.set(p.demandId, p)
    }
  const town = city.trim().toLowerCase()
  const visible = demands
    .filter((d) => (isClient ? d.clientId === user?.id : d.status === 'OPEN'))
    .filter((d) => !category || d.categoryId === category)
    .filter((d) => !town || d.city.toLowerCase().includes(town))
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  const filtered = !!(category || town)
  return (
    <>
      <PageTitle
        title={isClient ? 'Minhas demandas' : 'Demandas abertas'}
        description={
          isClient
            ? 'Acompanhe os pedidos que você publicou e compare as propostas recebidas.'
            : 'Pedidos de clientes perto de você esperando proposta. Filtre pela sua especialidade e região.'
        }
        action={
          isClient && (
            <Link className="button" to="/demandas/nova">
              Publicar demanda
            </Link>
          )
        }
      />
      <div className="filters" role="search">
        <label className="field">
          <span>Categoria</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Todas</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <Field
          label="Cidade ou bairro"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Taguatinga"
        />
      </div>
      {visible.length > 0 && (
        <p className="dm-result-count" aria-live="polite">
          {visible.length}{' '}
          {isClient
            ? visible.length === 1
              ? 'demanda publicada'
              : 'demandas publicadas'
            : visible.length === 1
              ? 'demanda aberta'
              : 'demandas abertas'}
          {filtered && ' com esses filtros'}
        </p>
      )}
      <div className="stack">
        {visible
          .slice(0, shown)
          .map((d) =>
            isClient ? (
              <ClientDemandCard key={d.id} d={d} info={info} />
            ) : (
              <OpenDemandCard key={d.id} d={d} info={info} own={answered.get(d.id)} />
            ),
          )}
      </div>
      {visible.length > shown && (
        <button className="button secondary" onClick={() => setShown(shown + PAGE)}>
          Mostrar mais
        </button>
      )}
      {!visible.length && (
        <Empty
          title={
            filtered
              ? 'Nenhuma demanda com esses filtros'
              : isClient
                ? 'Nenhuma demanda publicada'
                : 'Nenhuma demanda aberta'
          }
        >
          {isClient && !filtered && <Link to="/demandas/nova">Publicar a primeira demanda</Link>}
        </Empty>
      )}
    </>
  )
}

type DemandInfo = ReturnType<typeof useDemandInfo>

function OpenDemandCard({ d, info, own }: { d: Demand; info: DemandInfo; own?: Proposal }) {
  const titleId = useId()
  const count = info.count(d)
  return (
    <article className="panel dm-card">
      <div className="dm-card-top">
        <span className="dm-chip">
          <Tag size={13} aria-hidden="true" />
          {info.category(d)}
        </span>
        <Ago iso={d.createdAt} prefix="publicada" />
      </div>
      <h2 id={titleId}>
        <Link to={`/demandas/${d.id}`}>{d.title}</Link>
      </h2>
      <p className="dm-clamp">{d.description}</p>
      <dl className="dm-facts">
        <Fact icon={<Wallet size={15} aria-hidden="true" />} label="Orçamento">
          <strong>{money(d.budget)}</strong>
        </Fact>
        <Fact icon={<CalendarDays size={15} aria-hidden="true" />} label="Prazo">
          {dayLabel(d.days)}
        </Fact>
        <Fact icon={<MapPin size={15} aria-hidden="true" />} label="Local">
          {d.city}
        </Fact>
        <Fact icon={<Users size={15} aria-hidden="true" />} label="Propostas">
          {count ? proposalLabel(count) : 'Nenhuma ainda'}
        </Fact>
      </dl>
      <div className="dm-card-foot">
        <span className="dm-client">
          <Avatar name={clientName(d)} />
          <span>
            <small>Cliente</small>
            {clientName(d)}
          </span>
        </span>
        {own ? (
          <Link
            className={`badge status ${statusTone(own.status)}`}
            to={`/demandas/${d.id}`}
            aria-describedby={titleId}
          >
            {own.status === 'PENDING' ? 'Proposta enviada' : proposalStatusLabel[own.status]}
          </Link>
        ) : (
          <Link className="button" to={`/demandas/${d.id}/proposta`} aria-describedby={titleId}>
            Enviar proposta
          </Link>
        )}
      </div>
    </article>
  )
}

function ClientDemandCard({ d, info }: { d: Demand; info: DemandInfo }) {
  const count = info.count(d),
    pending = info.pending(d)
  return (
    <article className="panel dm-card">
      <div className="dm-card-top">
        <StatusBadge status={d.status} label={demandStatusLabel[d.status]} />
        <Ago iso={d.createdAt} prefix="publicada" />
      </div>
      <h2>
        <Link to={`/demandas/${d.id}`}>{d.title}</Link>
      </h2>
      <p className="dm-clamp">{d.description}</p>
      <dl className="dm-facts">
        <Fact icon={<Tag size={15} aria-hidden="true" />} label="Categoria">
          {info.category(d)}
        </Fact>
        <Fact icon={<Wallet size={15} aria-hidden="true" />} label="Orçamento">
          <strong>{money(d.budget)}</strong>
        </Fact>
        <Fact icon={<CalendarDays size={15} aria-hidden="true" />} label="Prazo">
          {dayLabel(d.days)}
        </Fact>
        <Fact icon={<MapPin size={15} aria-hidden="true" />} label="Local">
          {d.city}
        </Fact>
      </dl>
      <div className="dm-card-foot">
        {d.status === 'OPEN' && pending > 0 ? (
          <Link className="dm-pending" to={`/demandas/${d.id}`}>
            <Users size={16} aria-hidden="true" />
            {pending === 1 ? '1 proposta para analisar' : `${pending} propostas para analisar`}
          </Link>
        ) : (
          <span className="dm-muted">
            {count
              ? `${count} ${count === 1 ? 'proposta recebida' : 'propostas recebidas'}`
              : d.status === 'OPEN'
                ? 'Nenhuma proposta ainda'
                : 'Nenhuma proposta recebida'}
          </span>
        )}
        <Link className="button secondary" to={`/demandas/${d.id}`}>
          Ver demanda
        </Link>
      </div>
    </article>
  )
}

export function DemandForm() {
  const { id } = useParams(),
    { user, categories, demands, proposals, createDemand, updateDemand } = useApp(),
    navigate = useNavigate(),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const existing = id ? demands.find((d) => d.id === id && d.clientId === user?.id) : undefined
  if (id && !existing) return <Empty title="Demanda não encontrada" />
  if (existing && !canEditDemand(existing, proposals))
    return (
      <Empty title="Esta demanda não pode mais ser editada">
        <p>Depois da primeira proposta o texto fica fixo para que todos comparem o mesmo pedido.</p>
        <Link to={`/demandas/${existing.id}`}>Voltar à demanda</Link>
      </Empty>
    )
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!user) return
    const d = new FormData(e.currentTarget)
    const body = {
      title: String(d.get('title')),
      description: String(d.get('description')),
      categoryId: String(d.get('categoryId')),
      budget: Number(d.get('budget')),
      days: Number(d.get('days')),
      city: String(d.get('city')),
    }
    setBusy(true)
    setError('')
    try {
      const saved = existing ? await updateDemand(existing.id, body) : await createDemand(body)
      navigate(`/demandas/${saved.id}`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <PageTitle
        title={existing ? 'Editar demanda' : 'Conte o que você precisa'}
        description={
          existing
            ? 'Você pode ajustar o pedido até chegar a primeira proposta.'
            : 'Os profissionais da categoria poderão enviar propostas.'
        }
      />
      <form className="form-panel" onSubmit={submit}>
        <Field
          label="Título da demanda"
          name="title"
          required
          maxLength={80}
          defaultValue={existing?.title}
        />
        <label className="field">
          <span>Descrição *</span>
          <textarea
            name="description"
            required
            maxLength={500}
            rows={5}
            defaultValue={existing?.description}
          />
        </label>
        <label className="field">
          <span>Categoria *</span>
          <select name="categoryId" required defaultValue={existing?.categoryId}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <div className="form-columns">
          <Field
            label="Orçamento (R$)"
            name="budget"
            type="number"
            required
            min="1"
            step="0.01"
            defaultValue={existing?.budget}
          />
          <Field
            label="Prazo (dias)"
            name="days"
            type="number"
            required
            min="1"
            max="365"
            defaultValue={existing?.days}
          />
        </div>
        <Field
          label="Cidade e UF"
          name="city"
          required
          maxLength={100}
          defaultValue={existing?.city || user?.city}
        />
        <ErrorMessage message={error} />
        <div className="row">
          <Link
            className="button secondary"
            to={existing ? `/demandas/${existing.id}` : '/demandas'}
          >
            Cancelar
          </Link>
          <button className="button" disabled={busy}>
            {existing ? 'Salvar alterações' : 'Publicar demanda'}
          </button>
        </div>
      </form>
    </>
  )
}

/** Rating line of a freelancer, from the proposal or, in mock mode, the loaded profiles. */
function useFreelancerSummary(p: Proposal) {
  const { professionals } = useApp()
  const profile = professionals.find((x) => x.id === p.freelancerId)
  return {
    rating: p.freelancerAverageRating ?? profile?.averageRating ?? null,
    reviews: p.freelancerReviewCount ?? profile?.reviewCount ?? 0,
    avatar: avatarUrl(p.freelancerId, p.freelancerAvatarVersion ?? profile?.avatarVersion),
  }
}
function RatingLine({ rating, reviews }: { rating: number | null; reviews: number }) {
  return rating ? (
    <small className="dm-rating">
      <Stars rating={rating} /> {ratingLabel(rating)} · {reviews}{' '}
      {reviews === 1 ? 'avaliação' : 'avaliações'}
    </small>
  ) : (
    <small>Ainda sem avaliações</small>
  )
}

function ProposalCard({
  p,
  d,
  busy,
  onReject,
}: {
  p: Proposal
  d: Demand
  busy: boolean
  onReject: () => void
}) {
  const { user } = useApp()
  const { rating, reviews, avatar } = useFreelancerSummary(p)
  const comparison = budgetComparison(p.price, d.budget)
  return (
    <article className={`panel dm-proposal ${p.status === 'PENDING' ? '' : 'decided'}`}>
      <div className="dm-proposal-head">
        <div className="person">
          <Avatar name={p.freelancerName} src={avatar} />
          <div>
            <h3>
              <Link to={`/profissionais/${p.freelancerId}`}>{p.freelancerName}</Link>
            </h3>
            <RatingLine rating={rating} reviews={reviews} />
          </div>
        </div>
        <StatusBadge status={p.status} label={proposalStatusLabel[p.status]} />
      </div>
      <dl className="dm-terms">
        <div>
          <dt>Valor</dt>
          <dd className="dm-price">{money(p.price)}</dd>
          {comparison && <dd className="dm-compare">{comparison}</dd>}
        </div>
        <div>
          <dt>Prazo</dt>
          <dd className="dm-price">{dayLabel(p.days)}</dd>
          <dd className="dm-compare">{daysComparison(p.days, d.days)}</dd>
        </div>
      </dl>
      <p className="dm-message">{p.message}</p>
      <div className="dm-proposal-foot">
        <Ago iso={p.createdAt} prefix="Enviada" />
        {p.status === 'ACCEPTED' && p.contractId && (
          <Link className="button secondary" to={`/contratacoes/${p.contractId}`}>
            Ver contratação
          </Link>
        )}
        {user?.id === d.clientId && p.status === 'PENDING' && d.status === 'OPEN' && (
          <div className="row">
            <ConfirmButton
              className="button secondary"
              disabled={busy}
              label="Recusar"
              title={`Recusar a proposta de ${p.freelancerName}?`}
              message={`${p.freelancerName} será avisado. A proposta recusada não pode ser reaberta.`}
              confirmLabel="Sim, recusar"
              danger
              onConfirm={onReject}
            />
            <Link className="button" to={`/demandas/${d.id}/propostas/${p.id}/aceitar`}>
              Aceitar proposta
            </Link>
          </div>
        )}
      </div>
    </article>
  )
}

/** The freelancer's own proposal, shown in the side column of the demand. */
function OwnProposal({
  p,
  busy,
  onWithdraw,
}: {
  p: Proposal
  busy: boolean
  onWithdraw: () => void
}) {
  const { user } = useApp()
  return (
    <div className="dm-own">
      <div className="dm-own-head">
        <h3>Sua proposta</h3>
        <StatusBadge status={p.status} label={proposalStatusLabel[p.status]} />
      </div>
      <dl className="dm-own-terms">
        <div>
          <dt>Valor</dt>
          <dd>{money(p.price)}</dd>
        </div>
        <div>
          <dt>Prazo</dt>
          <dd>{dayLabel(p.days)}</dd>
        </div>
      </dl>
      <p className="dm-message">{p.message}</p>
      <Ago iso={p.createdAt} prefix="Enviada" />
      {p.status === 'ACCEPTED' && p.contractId && (
        <Link className="button full" to={`/contratacoes/${p.contractId}`}>
          Ver contratação
        </Link>
      )}
      {p.freelancerId === user?.id && p.status === 'PENDING' && (
        <ConfirmButton
          className="button secondary full"
          disabled={busy}
          label="Retirar proposta"
          title="Retirar sua proposta?"
          message="O cliente deixa de ver a proposta. Enquanto a demanda estiver aberta você pode enviar outra."
          confirmLabel="Sim, retirar"
          danger
          onConfirm={onWithdraw}
        />
      )}
    </div>
  )
}

type SortKey = 'price' | 'days' | 'rating' | 'recent'
const sortLabels: Record<SortKey, string> = {
  price: 'Menor valor',
  days: 'Menor prazo',
  rating: 'Melhor avaliação',
  recent: 'Mais recentes',
}
const statusOrder: Record<ProposalStatus, number> = {
  PENDING: 0,
  ACCEPTED: 0,
  REJECTED: 1,
  WITHDRAWN: 2,
}

export function DemandDetail() {
  const { id } = useParams(),
    { user, demands, proposals, professionals, rejectProposal, withdrawProposal, cancelDemand } =
      useApp(),
    info = useDemandInfo()
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [sort, setSort] = useState<SortKey>('price')
  // Clients see only their own demands; freelancers see open ones or those they already answered.
  const d = demands.find(
    (d) =>
      d.id === id &&
      (user?.role === 'ADMIN' ||
        d.clientId === user?.id ||
        (user?.role === 'FREELANCER' &&
          (d.status === 'OPEN' ||
            proposals.some((p) => p.demandId === d.id && p.freelancerId === user.id)))),
  )
  if (!d) return <Empty title="Demanda não encontrada" />
  const isOwner = user?.role === 'ADMIN' || d.clientId === user?.id
  const isClientOwner = d.clientId === user?.id
  const visibleProposals = proposals.filter(
    (p) => p.demandId === id && (isOwner || p.freelancerId === user?.id),
  )
  const mine = proposals.some(
    (p) => p.demandId === d.id && p.freelancerId === user?.id && p.status === 'PENDING',
  )
  const count = info.count(d),
    pending = info.pending(d)
  const rating = (p: Proposal) =>
    p.freelancerAverageRating ??
    professionals.find((x) => x.id === p.freelancerId)?.averageRating ??
    0
  const sorted = [...visibleProposals].sort(
    (a, b) =>
      statusOrder[a.status] - statusOrder[b.status] ||
      (sort === 'price'
        ? a.price - b.price
        : sort === 'days'
          ? a.days - b.days
          : sort === 'rating'
            ? rating(b) - rating(a)
            : (b.createdAt || '').localeCompare(a.createdAt || '')),
  )
  const own = [...visibleProposals]
    .filter((p) => !isOwner && p.freelancerId === user?.id)
    .sort(
      (a, b) =>
        statusOrder[a.status] - statusOrder[b.status] ||
        (b.createdAt || '').localeCompare(a.createdAt || ''),
    )
  async function run(work: () => Promise<void>) {
    setBusy(true)
    setError('')
    try {
      await work()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <Link className="subtle-link dm-back" to="/demandas">
        <ArrowLeft size={16} aria-hidden="true" />
        {isClientOwner ? 'Minhas demandas' : 'Demandas abertas'}
      </Link>
      <div className="dm-detail">
        <section className="panel dm-project" aria-labelledby="dm-title">
          <div className="dm-card-top">
            <StatusBadge status={d.status} label={demandStatusLabel[d.status]} />
            <Ago iso={d.createdAt} prefix="Publicada" />
          </div>
          <h1 id="dm-title">{d.title}</h1>
          <p className="dm-description">{d.description}</p>
          <dl className="dm-grid">
            <Fact icon={<Tag size={15} aria-hidden="true" />} label="Categoria">
              {info.category(d)}
            </Fact>
            <Fact icon={<Wallet size={15} aria-hidden="true" />} label="Orçamento">
              <strong>{money(d.budget)}</strong>
            </Fact>
            <Fact icon={<CalendarDays size={15} aria-hidden="true" />} label="Prazo">
              {dayLabel(d.days)}
            </Fact>
            <Fact icon={<MapPin size={15} aria-hidden="true" />} label="Local">
              {d.city}
            </Fact>
            <Fact icon={<Users size={15} aria-hidden="true" />} label="Propostas">
              {count ? proposalLabel(count) : 'Nenhuma ainda'}
            </Fact>
          </dl>
        </section>

        <aside
          className="dm-aside"
          aria-label={isClientOwner ? 'Sua demanda' : 'Cliente e proposta'}
        >
          {isClientOwner ? (
            <section className="panel dm-side">
              <h2>Sua demanda</h2>
              <p className="dm-muted">
                {d.status === 'OPEN'
                  ? pending
                    ? `${pending === 1 ? '1 proposta aguarda' : `${pending} propostas aguardam`} sua decisão. Ao aceitar, você escolhe a data e o endereço.`
                    : 'A demanda está visível para os profissionais da categoria.'
                  : d.status === 'CLOSED'
                    ? 'Você já escolheu uma proposta. Acompanhe pela contratação.'
                    : 'Esta demanda foi cancelada e não recebe propostas.'}
              </p>
              {d.status === 'OPEN' && (
                <div className="dm-side-actions">
                  {canEditDemand(d, proposals) ? (
                    <Link className="button secondary full" to={`/demandas/${d.id}/editar`}>
                      Editar demanda
                    </Link>
                  ) : (
                    <small>O texto fica fixo depois da primeira proposta.</small>
                  )}
                  <ConfirmButton
                    className="text-button danger-text"
                    disabled={busy}
                    label="Cancelar demanda"
                    title="Cancelar esta demanda?"
                    message="A demanda sai da lista de pedidos abertos e as propostas pendentes são recusadas, com aviso aos profissionais. Não é possível reabrir."
                    confirmLabel="Sim, cancelar demanda"
                    danger
                    onConfirm={() => void run(() => cancelDemand(d.id))}
                  />
                </div>
              )}
            </section>
          ) : (
            <section className="panel dm-side">
              <h2>Sobre o cliente</h2>
              <div className="person">
                <Avatar name={clientName(d)} />
                <div>
                  <strong>{clientName(d)}</strong>
                  <small>
                    <MapPin size={12} aria-hidden="true" />
                    {d.city}
                  </small>
                </div>
              </div>
              {user?.role === 'FREELANCER' && (
                <div className="dm-side-cta">
                  {own[0] && (
                    <OwnProposal
                      p={own[0]}
                      busy={busy}
                      onWithdraw={() => void run(() => withdrawProposal(own[0].id))}
                    />
                  )}
                  {d.status === 'OPEN' && !mine && (
                    <>
                      <p className="dm-muted">
                        {own[0]
                          ? 'Sua proposta anterior não está mais ativa. Você pode enviar outra enquanto a demanda estiver aberta.'
                          : count
                            ? `${proposalLabel(count)} até agora. Diga ao cliente como fará o serviço, o valor e o prazo.`
                            : 'Ninguém respondeu ainda. Diga ao cliente como fará o serviço, o valor e o prazo.'}
                      </p>
                      <Link className="button full" to={`/demandas/${d.id}/proposta`}>
                        Enviar proposta
                      </Link>
                    </>
                  )}
                  {d.status !== 'OPEN' && !own[0] && (
                    <p className="dm-muted">Esta demanda não recebe novas propostas.</p>
                  )}
                </div>
              )}
            </section>
          )}
        </aside>

        <div className="dm-proposals">
          <ErrorMessage message={error} />
          {isOwner && (
            <section aria-labelledby="dm-proposals-title">
              <div className="dm-section-head">
                <div>
                  <h2 id="dm-proposals-title">Propostas recebidas</h2>
                  <p className="dm-muted">
                    {d.status === 'OPEN'
                      ? 'Compare valor, prazo e avaliações. Ao aceitar, você escolhe a data e o endereço.'
                      : `${proposalLabel(count)} nesta demanda.`}
                  </p>
                </div>
                {visibleProposals.length > 1 && (
                  <label className="field dm-sort">
                    <span>Ordenar por</span>
                    <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                      {Object.entries(sortLabels).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              <div className="stack">
                {sorted.map((p) => (
                  <ProposalCard
                    key={p.id}
                    p={p}
                    d={d}
                    busy={busy}
                    onReject={() => void run(() => rejectProposal(p.id))}
                  />
                ))}
              </div>
              {!visibleProposals.length && (
                <Empty title="Nenhuma proposta ainda">
                  <p>A demanda está disponível para os profissionais da categoria.</p>
                </Empty>
              )}
            </section>
          )}
          {!isOwner && own.length > 1 && (
            <section aria-labelledby="dm-history-title">
              <h2 id="dm-history-title" className="dm-history-title">
                Propostas anteriores
              </h2>
              <ul className="dm-history">
                {own.slice(1).map((p) => (
                  <li key={p.id}>
                    <span>
                      {money(p.price)} · {dayLabel(p.days)}
                    </span>
                    <StatusBadge status={p.status} label={proposalStatusLabel[p.status]} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </>
  )
}

export function AcceptProposal() {
  const { id, pid } = useParams(),
    { user, demands, proposals, acceptProposal } = useApp(),
    navigate = useNavigate(),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const d = demands.find((x) => x.id === id && x.clientId === user?.id)
  const p = proposals.find((x) => x.id === pid && x.demandId === id)
  if (!d || !p) return <Empty title="Proposta não encontrada" />
  if (d.status !== 'OPEN' || p.status !== 'PENDING')
    return (
      <Empty title="Esta proposta não pode mais ser aceita">
        <Link to={`/demandas/${d.id}`}>Voltar à demanda</Link>
      </Empty>
    )
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setBusy(true)
    setError('')
    try {
      const contract = await acceptProposal(p!.id, {
        date: String(f.get('date')),
        address: String(f.get('address')),
      })
      navigate(`/contratacoes/${contract.id}`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <PageTitle title="Confirmar contratação" description={d.title} />
      <div className="dm-split">
        <form className="form-panel" onSubmit={submit}>
          <h2>Quando e onde</h2>
          <Field
            label="Data para o serviço"
            name="date"
            type="date"
            required
            min={futureDate(1)}
            defaultValue={futureDate(Math.max(1, p.days))}
          />
          <Field
            label="Endereço"
            name="address"
            maxLength={200}
            defaultValue={d.city}
            hint="O endereço só aparece para o profissional contratado."
          />
          <p className="notice">
            Ao confirmar, a demanda é encerrada, as outras propostas são recusadas e a contratação é
            criada já aceita. Não é possível desfazer.
          </p>
          <ErrorMessage message={error} />
          <div className="row">
            <Link className="button secondary" to={`/demandas/${d.id}`}>
              Voltar
            </Link>
            <button className="button" disabled={busy}>
              {busy ? 'Contratando…' : 'Confirmar contratação'}
            </button>
          </div>
        </form>
        <AcceptedSummary p={p} d={d} />
      </div>
    </>
  )
}

function AcceptedSummary({ p, d }: { p: Proposal; d: Demand }) {
  const { rating, reviews, avatar } = useFreelancerSummary(p)
  const comparison = budgetComparison(p.price, d.budget)
  return (
    <aside className="panel dm-summary" aria-labelledby="dm-accept-title">
      <h2 id="dm-accept-title">Proposta escolhida</h2>
      <div className="person">
        <Avatar name={p.freelancerName} src={avatar} />
        <div>
          <Link to={`/profissionais/${p.freelancerId}`}>
            <strong>{p.freelancerName}</strong>
          </Link>
          <RatingLine rating={rating} reviews={reviews} />
        </div>
      </div>
      <dl className="dm-own-terms">
        <div>
          <dt>Valor</dt>
          <dd>{money(p.price)}</dd>
        </div>
        <div>
          <dt>Prazo</dt>
          <dd>{dayLabel(p.days)}</dd>
        </div>
      </dl>
      {comparison && <p className="dm-compare">{comparison}</p>}
      <p className="dm-message">{p.message}</p>
    </aside>
  )
}

const proposalTabs: [ProposalStatus | '', string][] = [
  ['', 'Todas'],
  ['PENDING', 'Aguardando decisão'],
  ['ACCEPTED', 'Aceitas'],
  ['REJECTED', 'Não selecionadas'],
  ['WITHDRAWN', 'Retiradas'],
]

export function MyProposals() {
  const { user, proposals, demands, withdrawProposal } = useApp(),
    [status, setStatus] = useState<ProposalStatus | ''>(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState('')
  const all = proposals.filter((p) => p.freelancerId === user?.id)
  const mine = all
    .filter((p) => !status || p.status === status)
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  async function withdraw(id: string) {
    setBusy(id)
    setError('')
    try {
      await withdrawProposal(id)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy('')
    }
  }
  return (
    <>
      <PageTitle
        title="Minhas propostas"
        description="Tudo o que você enviou para demandas de clientes e em que pé está."
        action={
          <Link className="button secondary" to="/demandas">
            Ver demandas abertas
          </Link>
        }
      />
      <div className="tabs" role="group" aria-label="Filtrar propostas por situação">
        {proposalTabs.map(([v, label]) => (
          <button
            key={v || 'all'}
            type="button"
            aria-pressed={status === v}
            className={status === v ? 'active' : ''}
            onClick={() => setStatus(v)}
          >
            {label} ({v ? all.filter((p) => p.status === v).length : all.length})
          </button>
        ))}
      </div>
      <ErrorMessage message={error} />
      <div className="stack">
        {mine.map((p) => {
          const d = demands.find((x) => x.id === p.demandId)
          const demandStatus = p.demandStatus || d?.status
          return (
            <article className="panel dm-row" key={p.id}>
              <div className="dm-row-main">
                <div className="dm-card-top">
                  <StatusBadge status={p.status} label={proposalStatusLabel[p.status]} />
                  {demandStatus && demandStatus !== 'OPEN' && (
                    <small>Demanda {demandStatusLabel[demandStatus].toLowerCase()}</small>
                  )}
                </div>
                <h2>
                  <Link to={`/demandas/${p.demandId}`}>
                    {p.demandTitle || d?.title || 'Demanda'}
                  </Link>
                </h2>
                <p className="dm-clamp">{p.message}</p>
                <Ago iso={p.createdAt} prefix="Enviada" />
              </div>
              <div className="dm-row-side">
                <dl className="dm-own-terms">
                  <div>
                    <dt>Valor</dt>
                    <dd>{money(p.price)}</dd>
                  </div>
                  <div>
                    <dt>Prazo</dt>
                    <dd>{dayLabel(p.days)}</dd>
                  </div>
                </dl>
                {p.status === 'ACCEPTED' && p.contractId && (
                  <Link className="button" to={`/contratacoes/${p.contractId}`}>
                    Ver contratação
                  </Link>
                )}
                {p.status === 'PENDING' && (
                  <ConfirmButton
                    className="button secondary"
                    disabled={busy === p.id}
                    label="Retirar proposta"
                    title="Retirar sua proposta?"
                    message="O cliente deixa de ver a proposta. Enquanto a demanda estiver aberta você pode enviar outra."
                    confirmLabel="Sim, retirar"
                    danger
                    onConfirm={() => void withdraw(p.id)}
                  />
                )}
              </div>
            </article>
          )
        })}
      </div>
      {!mine.length && (
        <Empty
          title={status ? 'Nenhuma proposta nessa situação' : 'Você ainda não enviou propostas'}
        >
          <Link to="/demandas">Encontrar demandas abertas</Link>
        </Empty>
      )}
    </>
  )
}

function DemandSummary({ d }: { d: Demand }) {
  const info = useDemandInfo()
  const count = info.count(d)
  return (
    <aside className="panel dm-summary" aria-labelledby="dm-summary-title">
      <h2 id="dm-summary-title">
        <FileText size={18} aria-hidden="true" />
        Resumo da demanda
      </h2>
      <p className="dm-summary-name">
        <Link to={`/demandas/${d.id}`}>{d.title}</Link>
      </p>
      <p className="dm-clamp long">{d.description}</p>
      <dl className="dm-facts stacked">
        <Fact icon={<Wallet size={15} aria-hidden="true" />} label="Orçamento">
          <strong>{money(d.budget)}</strong>
        </Fact>
        <Fact icon={<CalendarDays size={15} aria-hidden="true" />} label="Prazo">
          {dayLabel(d.days)}
        </Fact>
        <Fact icon={<MapPin size={15} aria-hidden="true" />} label="Local">
          {d.city}
        </Fact>
        <Fact icon={<UserRound size={15} aria-hidden="true" />} label="Cliente">
          {clientName(d)}
        </Fact>
        <Fact icon={<Users size={15} aria-hidden="true" />} label="Propostas">
          {count ? proposalLabel(count) : 'Nenhuma ainda'}
        </Fact>
      </dl>
    </aside>
  )
}

export function ProposalForm() {
  const { id } = useParams(),
    { user, demands, proposals, createProposal, withdrawProposal } = useApp(),
    navigate = useNavigate(),
    { pathname } = useLocation(),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [price, setPrice] = useState(''),
    [days, setDays] = useState('')
  const d = demands.find((d) => d.id === id)
  if (!d || !user) return <Empty title="Demanda não encontrada" />
  if (pathname.endsWith('/enviada'))
    return (
      <div className="form-panel confirmation">
        <h1>Proposta enviada</h1>
        <p>O cliente compara as propostas recebidas e você recebe um aviso quando ele decidir.</p>
        <div className="row">
          <Link className="button" to="/propostas">
            Minhas propostas
          </Link>
          <Link className="button secondary" to="/demandas">
            Outras demandas
          </Link>
        </div>
      </div>
    )
  if (d.status !== 'OPEN')
    return (
      <Empty title="Demanda encerrada">
        <p>Esta demanda não recebe novas propostas.</p>
        <Link to="/demandas">Ver demandas abertas</Link>
      </Empty>
    )
  // Same rule as the API and the store: one pending proposal per freelancer and demand. Without
  // this check the form was shown again and only failed after it was filled in and sent.
  const pending = proposals.find(
    (p) => p.demandId === d.id && p.freelancerId === user.id && p.status === 'PENDING',
  )
  async function withdraw(proposalId: string) {
    setBusy(true)
    setError('')
    try {
      await withdrawProposal(proposalId)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }
  if (pending)
    return (
      <>
        <PageTitle title="Proposta já enviada" description={d.title} />
        <div className="dm-split">
          <section className="form-panel dm-already" aria-labelledby="dm-already-title">
            <h2 id="dm-already-title">Você já enviou uma proposta para esta demanda.</h2>
            <p className="dm-muted">
              Ela aguarda a decisão do cliente. Se quiser mudar valor ou prazo, retire a proposta
              atual e envie outra enquanto a demanda estiver aberta.
            </p>
            <dl className="dm-own-terms">
              <div>
                <dt>Valor</dt>
                <dd>{money(pending.price)}</dd>
              </div>
              <div>
                <dt>Prazo</dt>
                <dd>{dayLabel(pending.days)}</dd>
              </div>
            </dl>
            <ErrorMessage message={error} />
            <div className="row">
              <Link className="button" to={`/demandas/${d.id}`}>
                Ver demanda
              </Link>
              <Link className="button secondary" to="/propostas">
                Minhas propostas
              </Link>
              <ConfirmButton
                className="text-button danger-text"
                disabled={busy}
                label="Retirar proposta"
                title="Retirar sua proposta?"
                message="O cliente deixa de ver a proposta. Enquanto a demanda estiver aberta você pode enviar outra."
                confirmLabel="Sim, retirar"
                danger
                onConfirm={() => void withdraw(pending.id)}
              />
            </div>
          </section>
          <DemandSummary d={d} />
        </div>
      </>
    )
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setBusy(true)
    setError('')
    try {
      await createProposal(id!, {
        price: Number(f.get('price')),
        days: Number(f.get('days')),
        message: String(f.get('message')),
      })
      navigate(`/demandas/${id}/proposta/enviada`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const priceHint = budgetComparison(Number(price), d.budget),
    daysHint = daysComparison(Number(days), d.days)
  return (
    <>
      <PageTitle title="Enviar proposta" description={d.title} />
      <div className="dm-split">
        <form className="form-panel" onSubmit={submit}>
          <div className="form-columns">
            <div>
              <Field
                label="Valor da proposta (R$)"
                name="price"
                type="number"
                min="1"
                step="0.01"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
              <p className="dm-live" aria-live="polite">
                {priceHint || `Orçamento do cliente: ${money(d.budget)}`}
              </p>
            </div>
            <div>
              <Field
                label="Prazo de execução (dias)"
                name="days"
                type="number"
                min="1"
                max="365"
                required
                value={days}
                onChange={(e) => setDays(e.target.value)}
              />
              <p className="dm-live" aria-live="polite">
                {daysHint || `Prazo pedido: ${dayLabel(d.days)}`}
              </p>
            </div>
          </div>
          <label className="field">
            <span>Mensagem ao cliente *</span>
            <textarea
              name="message"
              required
              maxLength={600}
              rows={6}
              placeholder="Conte como fará o serviço, o que está incluído e sua disponibilidade."
            />
          </label>
          <ErrorMessage message={error} />
          <div className="row">
            <Link className="button secondary" to={`/demandas/${d.id}`}>
              Cancelar
            </Link>
            <button className="button" disabled={busy}>
              Enviar proposta
            </button>
          </div>
        </form>
        <DemandSummary d={d} />
      </div>
    </>
  )
}
