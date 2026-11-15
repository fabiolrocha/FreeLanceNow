import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useApp } from '../../app/store'
import { avatarUrl } from '../../data/client'
import { Avatar, ConfirmButton, Empty, ErrorMessage, Field, PageTitle } from '../../components/ui'
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
import type { Demand, Proposal } from '../../domain/types'

const PAGE = 10

function useDemandMeta() {
  const { categories } = useApp()
  return (d: Demand) => {
    const category = d.categoryName || categories.find((c) => c.id === d.categoryId)?.name
    return [category, money(d.budget), `${d.days} ${d.days === 1 ? 'dia' : 'dias'}`, d.city]
      .filter(Boolean)
      .join(' · ')
  }
}
function StatusBadge({ d }: { d: Demand }) {
  return (
    <span className={`badge status ${statusTone(d.status)}`}>{demandStatusLabel[d.status]}</span>
  )
}

export function Demands() {
  const { demands, user, proposals, categories } = useApp(),
    meta = useDemandMeta()
  const [category, setCategory] = useState(''),
    [city, setCity] = useState(''),
    [shown, setShown] = useState(PAGE)
  const isClient = user?.role === 'CLIENT'
  const answered = new Set(
    proposals
      .filter((p) => p.freelancerId === user?.id && p.status !== 'WITHDRAWN')
      .map((p) => p.demandId),
  )
  const town = city.trim().toLowerCase()
  const visible = demands
    .filter((d) => (isClient ? d.clientId === user?.id : d.status === 'OPEN'))
    .filter((d) => !category || d.categoryId === category)
    .filter((d) => !town || d.city.toLowerCase().includes(town))
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  return (
    <>
      <PageTitle
        title={isClient ? 'Minhas demandas' : 'Demandas abertas'}
        description={
          isClient
            ? 'Acompanhe os pedidos que você publicou e as propostas recebidas.'
            : 'Pedidos de clientes esperando proposta. Filtre pela sua especialidade e região.'
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
      <div className="stack">
        {visible.slice(0, shown).map((d) => {
          const count = proposals.filter((p) => p.demandId === d.id).length
          return (
            <article className="panel" key={d.id}>
              <div className="row">
                <StatusBadge d={d} />
                {!isClient && answered.has(d.id) && (
                  <span className="badge">Você já enviou proposta</span>
                )}
              </div>
              <h2>{d.title}</h2>
              <p>{d.description}</p>
              <p className="meta">
                {meta(d)}
                {d.createdAt && ` · publicada em ${dateLabel(d.createdAt)}`}
              </p>
              <Link to={`/demandas/${d.id}`}>
                {isClient
                  ? `${count} ${count === 1 ? 'proposta recebida' : 'propostas recebidas'}`
                  : answered.has(d.id)
                    ? 'Ver demanda e sua proposta'
                    : 'Ver demanda e enviar proposta'}
              </Link>
            </article>
          )
        })}
      </div>
      {visible.length > shown && (
        <button className="button secondary" onClick={() => setShown(shown + PAGE)}>
          Mostrar mais
        </button>
      )}
      {!visible.length && (
        <Empty
          title={
            category || town
              ? 'Nenhuma demanda com esses filtros'
              : isClient
                ? 'Nenhuma demanda publicada'
                : 'Nenhuma demanda aberta'
          }
        >
          {isClient && !category && !town && (
            <Link to="/demandas/nova">Publicar a primeira demanda</Link>
          )}
        </Empty>
      )}
    </>
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

function ProposalCard({
  p,
  d,
  owner,
  busy,
  onReject,
  onWithdraw,
}: {
  p: Proposal
  d: Demand
  owner: boolean
  busy: boolean
  onReject: () => void
  onWithdraw: () => void
}) {
  const { professionals, user } = useApp()
  const profile = professionals.find((x) => x.id === p.freelancerId)
  const rating = p.freelancerAverageRating ?? profile?.averageRating
  const reviews = p.freelancerReviewCount ?? profile?.reviewCount ?? 0
  const version = p.freelancerAvatarVersion ?? profile?.avatarVersion
  return (
    <article className="panel">
      <div className="person">
        <Avatar name={p.freelancerName} src={avatarUrl(p.freelancerId, version)} />
        <div>
          <h2>
            {owner ? (
              <Link to={`/profissionais/${p.freelancerId}`}>{p.freelancerName}</Link>
            ) : (
              'Sua proposta'
            )}
          </h2>
          {owner && (
            <small>
              {rating
                ? `★ ${ratingLabel(rating)} · ${reviews} ${reviews === 1 ? 'avaliação' : 'avaliações'}`
                : 'Ainda sem avaliações'}
            </small>
          )}
        </div>
      </div>
      <p>
        {money(p.price)} · {p.days} {p.days === 1 ? 'dia' : 'dias'}
        {p.createdAt && ` · enviada em ${dateLabel(p.createdAt)}`}
      </p>
      <p>{p.message}</p>
      <span className={`badge status ${statusTone(p.status)}`}>
        {proposalStatusLabel[p.status]}
      </span>
      {p.status === 'ACCEPTED' && p.contractId && (
        <p>
          <Link to={`/contratacoes/${p.contractId}`}>Ver contratação</Link>
        </p>
      )}
      {owner && user?.id === d.clientId && p.status === 'PENDING' && d.status === 'OPEN' && (
        <div className="row">
          <Link className="button" to={`/demandas/${d.id}/propostas/${p.id}/aceitar`}>
            Aceitar proposta
          </Link>
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
        </div>
      )}
      {!owner && p.freelancerId === user?.id && p.status === 'PENDING' && (
        <ConfirmButton
          className="button secondary"
          disabled={busy}
          label="Retirar proposta"
          title="Retirar sua proposta?"
          message="O cliente deixa de ver a proposta. Enquanto a demanda estiver aberta você pode enviar outra."
          confirmLabel="Sim, retirar"
          danger
          onConfirm={onWithdraw}
        />
      )}
    </article>
  )
}

export function DemandDetail() {
  const { id } = useParams(),
    { user, demands, proposals, rejectProposal, withdrawProposal, cancelDemand } = useApp(),
    meta = useDemandMeta()
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
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
  const visibleProposals = proposals.filter(
    (p) => p.demandId === id && (isOwner || p.freelancerId === user?.id),
  )
  const mine = proposals.some(
    (p) => p.demandId === d.id && p.freelancerId === user?.id && p.status === 'PENDING',
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
      <PageTitle title={d.title} description={meta(d)} />
      <section className="panel">
        <p>{d.description}</p>
        <div className="row">
          <StatusBadge d={d} />
          {d.createdAt && <span className="meta">Publicada em {dateLabel(d.createdAt)}</span>}
        </div>
        {d.clientId === user?.id && d.status === 'OPEN' && (
          <div className="row">
            {canEditDemand(d, proposals) && (
              <Link className="button secondary" to={`/demandas/${d.id}/editar`}>
                Editar demanda
              </Link>
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
      <ErrorMessage message={error} />
      {user?.role === 'FREELANCER' && d.status === 'OPEN' && !mine && (
        <Link className="button" to={`/demandas/${d.id}/proposta`}>
          Enviar proposta
        </Link>
      )}
      <PageTitle
        title={isOwner ? 'Propostas recebidas' : 'Sua proposta'}
        description={
          isOwner && d.status === 'OPEN'
            ? 'Compare valor, prazo e avaliações. Ao aceitar, você escolhe a data e o endereço.'
            : undefined
        }
      />
      {visibleProposals.map((p) => (
        <ProposalCard
          key={p.id}
          p={p}
          d={d}
          owner={isOwner}
          busy={busy}
          onReject={() => void run(() => rejectProposal(p.id))}
          onWithdraw={() => void run(() => withdrawProposal(p.id))}
        />
      ))}
      {!visibleProposals.length && (
        <Empty title={isOwner ? 'Nenhuma proposta ainda' : 'Você ainda não enviou proposta'}>
          {isOwner && <p>A demanda está disponível para os profissionais da categoria.</p>}
        </Empty>
      )}
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
      <form className="form-panel" onSubmit={submit}>
        <p>
          Proposta de <strong>{p.freelancerName}</strong>: {money(p.price)} · {p.days}{' '}
          {p.days === 1 ? 'dia' : 'dias'}.
        </p>
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
        <p>
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
    </>
  )
}

export function MyProposals() {
  const { user, proposals, demands, withdrawProposal } = useApp(),
    [status, setStatus] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState('')
  const mine = proposals
    .filter((p) => p.freelancerId === user?.id)
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
        action={<Link to="/demandas">Ver demandas abertas</Link>}
      />
      <div className="filters">
        <label className="field">
          <span>Situação</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todas</option>
            {Object.entries(proposalStatusLabel).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>
      <ErrorMessage message={error} />
      <div className="stack">
        {mine.map((p) => {
          const d = demands.find((x) => x.id === p.demandId)
          const demandStatus = p.demandStatus || d?.status
          return (
            <article className="panel" key={p.id}>
              <span className={`badge status ${statusTone(p.status)}`}>
                {proposalStatusLabel[p.status]}
              </span>
              <h2>
                <Link to={`/demandas/${p.demandId}`}>{p.demandTitle || d?.title || 'Demanda'}</Link>
              </h2>
              <p className="meta">
                {money(p.price)} · {p.days} {p.days === 1 ? 'dia' : 'dias'}
                {p.createdAt && ` · enviada em ${dateLabel(p.createdAt)}`}
                {demandStatus &&
                  demandStatus !== 'OPEN' &&
                  ` · demanda ${demandStatusLabel[demandStatus].toLowerCase()}`}
              </p>
              <p>{p.message}</p>
              <div className="row">
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

export function ProposalForm() {
  const { id } = useParams(),
    { user, demands, createProposal } = useApp(),
    navigate = useNavigate(),
    { pathname } = useLocation(),
    meta = useDemandMeta(),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
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
  return (
    <>
      <PageTitle title="Enviar proposta" description={`${d.title} · ${meta(d)}`} />
      <form className="form-panel" onSubmit={submit}>
        <Field
          label="Valor da proposta (R$)"
          name="price"
          type="number"
          min="1"
          step="0.01"
          required
          hint={`Orçamento do cliente: ${money(d.budget)}.`}
        />
        <Field
          label="Prazo de execução (dias)"
          name="days"
          type="number"
          min="1"
          max="365"
          required
        />
        <label className="field">
          <span>Mensagem ao cliente *</span>
          <textarea
            name="message"
            required
            maxLength={600}
            rows={5}
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
    </>
  )
}
