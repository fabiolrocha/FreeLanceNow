import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useApp } from '../../app/store'
import { Empty, ErrorMessage, Field, PageTitle, SimulationNotice } from '../../components/ui'
import { futureDate, money, nowIso } from '../../domain/rules'

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
      <SimulationNotice />
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
  const { user, categories, setDemands } = useApp(),
    navigate = useNavigate()
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!user) return
    const d = new FormData(e.currentTarget),
      id = crypto.randomUUID()
    setDemands((ds) => [
      {
        id,
        clientId: user.id,
        title: String(d.get('title')),
        description: String(d.get('description')),
        categoryId: String(d.get('categoryId')),
        budget: Number(d.get('budget')),
        days: Number(d.get('days')),
        city: String(d.get('city')),
        status: 'OPEN',
      },
      ...ds,
    ])
    navigate(`/demandas/${id}`)
  }
  return (
    <>
      <PageTitle
        title="Conte o que você precisa"
        description="Os profissionais da categoria poderão enviar propostas."
      />
      <SimulationNotice />
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
        <div className="row">
          <Link className="button secondary" to="/demandas">
            Cancelar
          </Link>
          <button className="button">Publicar demanda</button>
        </div>
      </form>
    </>
  )
}
export function DemandDetail() {
  const { id } = useParams(),
    { user, demands, proposals, setProposals, setDemands, addContract, notify } = useApp(),
    navigate = useNavigate()
  const [error, setError] = useState('')
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
  function accept(pid: string) {
    const p = proposals.find((p) => p.id === pid)
    if (!p || !user || d!.clientId !== user.id || d!.status !== 'OPEN') {
      setError('Esta proposta não pode ser aceita.')
      return
    }
    const cid = crypto.randomUUID()
    setProposals((ps) =>
      ps.map((x) =>
        x.demandId === id ? { ...x, status: x.id === pid ? 'ACCEPTED' : 'REJECTED' } : x,
      ),
    )
    setDemands((ds) => ds.map((x) => (x.id === id ? { ...x, status: 'CLOSED' } : x)))
    addContract({
      id: cid,
      serviceId: 'proposal-' + p.id,
      title: d!.title,
      freelancerId: p.freelancerId,
      freelancerName: p.freelancerName,
      clientId: user.id,
      clientName: user.name,
      price: p.price,
      date: futureDate(),
      description: d!.description,
      address: d!.city,
      status: 'ACEITO',
      history: [{ status: 'ACEITO', at: nowIso() }],
    })
    notify('Proposta aceita e contratação criada.')
    navigate(`/contratacoes/${cid}`)
  }
  return (
    <>
      <PageTitle title={d.title} description={`${money(d.budget)} · ${d.days} dias · ${d.city}`} />
      <SimulationNotice />
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
              <button className="button" onClick={() => accept(p.id)}>
                Aceitar proposta
              </button>
              <button
                className="button secondary"
                onClick={() =>
                  setProposals((ps) =>
                    ps.map((x) => (x.id === p.id ? { ...x, status: 'REJECTED' } : x)),
                  )
                }
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
    { user, demands, proposals, setProposals } = useApp(),
    navigate = useNavigate(),
    { pathname } = useLocation(),
    [error, setError] = useState('')
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
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (
      proposals.some(
        (p) => p.demandId === id && p.freelancerId === user!.id && p.status === 'PENDING',
      )
    ) {
      setError('Você já enviou uma proposta para esta demanda.')
      return
    }
    const f = new FormData(e.currentTarget)
    setProposals((ps) => [
      ...ps,
      {
        id: crypto.randomUUID(),
        demandId: id!,
        freelancerId: user!.id,
        freelancerName: user!.name,
        price: Number(f.get('price')),
        days: Number(f.get('days')),
        message: String(f.get('message')),
        status: 'PENDING',
      },
    ])
    navigate(`/demandas/${id}/proposta/enviada`)
  }
  return (
    <>
      <PageTitle title="Enviar proposta" description={d.title} />
      <SimulationNotice />
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
        <button className="button">Enviar proposta</button>
      </form>
    </>
  )
}
