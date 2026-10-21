import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useApp } from '../../app/store'
import { Empty, ErrorMessage, Field, PageTitle } from '../../components/ui'
import { money } from '../../domain/rules'

export function Demands() {
  const { demands, user, proposals } = useApp()
  const visible = demands.filter((d) =>
    user?.role === 'CLIENT' ? d.clientId === user.id : d.status === 'OPEN',
  )
  return (
    <>
      <PageTitle
        title={user?.role === 'CLIENT' ? 'Minhas demandas' : 'Demandas abertas'}
        description="Um pedido bem descrito encontra o profissional certo."
        action={
          user?.role === 'CLIENT' && (
            <Link className="button" to="/demandas/nova">
              Publicar demanda
            </Link>
          )
        }
      />
      <div className="stack">
        {visible.map((d) => (
          <article className="panel" key={d.id}>
            <span className="badge">{d.status === 'OPEN' ? 'Aberta' : 'Encerrada'}</span>
            <h2>{d.title}</h2>
            <p>{d.description}</p>
            <p>
              {money(d.budget)} · {d.days} dias · {d.city}
            </p>
            <Link to={`/demandas/${d.id}`}>
              {user?.role === 'CLIENT'
                ? `${proposals.filter((p) => p.demandId === d.id).length} propostas recebidas`
                : 'Ver demanda e enviar proposta'}
            </Link>
          </article>
        ))}
      </div>
      {!visible.length && (
        <Empty
          title={user?.role === 'CLIENT' ? 'Nenhuma demanda publicada' : 'Nenhuma demanda aberta'}
        />
      )}
    </>
  )
}
export function DemandForm() {
  const { user, categories, createDemand } = useApp(),
    navigate = useNavigate(),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!user) return
    const d = new FormData(e.currentTarget)
    setBusy(true)
    setError('')
    try {
      const created = await createDemand({
        title: String(d.get('title')),
        description: String(d.get('description')),
        categoryId: String(d.get('categoryId')),
        budget: Number(d.get('budget')),
        days: Number(d.get('days')),
        city: String(d.get('city')),
      })
      navigate(`/demandas/${created.id}`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <PageTitle
        title="Conte o que você precisa"
        description="Os profissionais da categoria poderão enviar propostas."
      />
      <form className="form-panel" onSubmit={submit}>
        <Field label="Título da demanda" name="title" required maxLength={80} />
        <label className="field">
          <span>Descrição *</span>
          <textarea name="description" required maxLength={500} rows={5} />
        </label>
        <label className="field">
          <span>Categoria *</span>
          <select name="categoryId" required>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <div className="form-columns">
          <Field label="Orçamento (R$)" name="budget" type="number" required min="1" step="0.01" />
          <Field label="Prazo (dias)" name="days" type="number" required min="1" max="365" />
        </div>
        <Field label="Cidade e UF" name="city" required maxLength={100} defaultValue={user?.city} />
        <ErrorMessage message={error} />
        <div className="row">
          <Link className="button secondary" to="/demandas">
            Cancelar
          </Link>
          <button className="button" disabled={busy}>
            Publicar demanda
          </button>
        </div>
      </form>
    </>
  )
}
export function DemandDetail() {
  const { id } = useParams(),
    { user, demands, proposals, acceptProposal, rejectProposal } = useApp(),
    navigate = useNavigate()
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
  async function accept(pid: string) {
    setBusy(true)
    setError('')
    try {
      const contract = await acceptProposal(pid)
      navigate(`/contratacoes/${contract.id}`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }
  async function reject(pid: string) {
    setBusy(true)
    setError('')
    try {
      await rejectProposal(pid)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <PageTitle title={d.title} description={`${money(d.budget)} · ${d.days} dias · ${d.city}`} />
      <section className="panel">
        <p>{d.description}</p>
        <span className="badge">{d.status === 'OPEN' ? 'Aberta' : 'Encerrada'}</span>
      </section>
      <ErrorMessage message={error} />
      {user?.role === 'FREELANCER' && d.status === 'OPEN' && (
        <Link className="button" to={`/demandas/${d.id}/proposta`}>
          Enviar proposta
        </Link>
      )}
      <PageTitle title={isOwner ? 'Propostas recebidas' : 'Sua proposta'} />
      {visibleProposals.map((p) => (
        <article className="panel" key={p.id}>
          <h2>{p.freelancerName}</h2>
          <p>
            {money(p.price)} · {p.days} dias
          </p>
          <p>{p.message}</p>
          <span className="badge">
            {p.status === 'PENDING'
              ? 'Aguardando decisão'
              : p.status === 'ACCEPTED'
                ? 'Aceita'
                : 'Recusada'}
          </span>
          {user?.id === d.clientId && p.status === 'PENDING' && d.status === 'OPEN' && (
            <div className="row">
              <button className="button" disabled={busy} onClick={() => void accept(p.id)}>
                Aceitar proposta
              </button>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => void reject(p.id)}
              >
                Recusar
              </button>
            </div>
          )}
        </article>
      ))}
      {!visibleProposals.length && (
        <Empty title="Nenhuma proposta ainda">
          <p>A demanda está disponível para os profissionais da categoria.</p>
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
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const d = demands.find((d) => d.id === id)
  if (!d || !user) return <Empty title="Demanda não encontrada" />
  if (pathname.endsWith('/enviada'))
    return (
      <div className="form-panel confirmation">
        <h1>Proposta enviada</h1>
        <p>O cliente poderá comparar sua proposta com as demais na demonstração.</p>
        <Link className="button" to={`/demandas/${id}`}>
          Ver demanda
        </Link>
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
      <PageTitle title="Enviar proposta" description={d.title} />
      <form className="form-panel" onSubmit={submit}>
        <Field
          label="Valor da proposta (R$)"
          name="price"
          type="number"
          min="1"
          step="0.01"
          required
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
          <textarea name="message" required maxLength={600} rows={5} />
        </label>
        <ErrorMessage message={error} />
        <button className="button" disabled={busy}>
          Enviar proposta
        </button>
      </form>
    </>
  )
}
