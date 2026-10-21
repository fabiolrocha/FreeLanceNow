import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, Star } from 'lucide-react'
import { useApp } from '../../app/store'
import { isMock } from '../../data/client'
import { Empty, ErrorMessage, Field, PageTitle, SimulationNotice } from '../../components/ui'
import { canReview, futureDate, money, statusLabel, today } from '../../domain/rules'
import type { Contract } from '../../domain/types'

// In API mode, refetch on open so new requests and direct links appear without a manual reload.
function useFreshContracts() {
  // Kept in a ref so the effect runs once per page open; the provider recreates the function.
  const reload = useRef(useApp().reloadContracts),
    [syncing, setSyncing] = useState(!isMock)
  useEffect(() => {
    let active = true
    void reload.current().finally(() => {
      if (active) setSyncing(false)
    })
    return () => {
      active = false
    }
  }, [])
  return syncing
}
export function RequestService() {
  const { id } = useParams(),
    { services, user, requestContract } = useApp(),
    navigate = useNavigate(),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const s = services.find((s) => s.id === id)
  if (!s || !user) return <Empty title="Serviço não encontrado" />
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!s || !user) return
    const d = new FormData(e.currentTarget),
      date = String(d.get('date'))
    if (date <= today()) {
      setError('Selecione uma data futura.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const c = await requestContract({
        serviceId: s.id,
        date,
        description: String(d.get('description')),
        address: String(d.get('address') || ''),
      })
      navigate(`/contratacoes/${c.id}/enviada`)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <PageTitle
        title="Solicitar serviço"
        description={`${s.title} · ${s.freelancer.name} · ${money(s.price)}`}
      />
      <form className="form-panel" onSubmit={submit}>
        <Field
          label="Data desejada"
          name="date"
          type="date"
          required
          min={futureDate(1)}
          defaultValue={futureDate()}
        />
        <label className="field">
          <span>Descrição da demanda *</span>
          <textarea
            name="description"
            required
            maxLength={300}
            rows={5}
            placeholder="Conte o que precisa e quais materiais já possui."
          />
        </label>
        <Field
          label="Endereço"
          name="address"
          maxLength={200}
          hint="Opcional. Informe se o serviço for presencial."
        />
        <p className="notice">
          O profissional tem até 48 horas para aceitar ou recusar. Uma solicitação pendente por
          serviço é permitida.
        </p>
        <ErrorMessage message={error} />
        <div className="row">
          <Link to={`/servicos/${s.id}`} className="button secondary">
            Cancelar
          </Link>
          <button className="button" disabled={busy}>
            {busy ? 'Enviando…' : 'Confirmar solicitação'}
          </button>
        </div>
      </form>
    </>
  )
}
export function RequestSent() {
  const { id } = useParams()
  return (
    <div className="form-panel confirmation">
      <CheckCircle2 size={52} />
      <h1>Solicitação enviada</h1>
      <p>
        A solicitação foi registrada. O profissional poderá aceitar ou recusar em sua conta em até
        48 horas.
      </p>
      <Link to={`/contratacoes/${id}`} className="button">
        Acompanhar contratação
      </Link>
    </div>
  )
}
export function ContractList({ requests = false }: { requests?: boolean }) {
  const { contracts, user } = useApp(),
    [filter, setFilter] = useState('all')
  useFreshContracts()
  const own = contracts.filter(
    (c) =>
      (user?.role === 'CLIENT' ? c.clientId === user.id : c.freelancerId === user?.id) &&
      (!requests || c.status === 'PENDENTE') &&
      (filter === 'all' || c.status === filter),
  )
  return (
    <>
      <PageTitle
        title={requests ? 'Solicitações recebidas' : 'Minhas contratações'}
        description={
          requests
            ? 'Você tem até 48 horas para responder.'
            : 'Acompanhe cada etapa do serviço, do pedido à avaliação.'
        }
      />
      <div className="tabs" role="group" aria-label="Filtrar contratações">
        {[
          ['all', 'Todas'],
          ['EM_ANDAMENTO', 'Em andamento'],
          ['CONCLUIDO', 'Concluídas'],
        ].map(([v, label]) => (
          <button
            key={v}
            aria-pressed={filter === v}
            className={filter === v ? 'active' : ''}
            onClick={() => setFilter(v)}
          >
            {label}
          </button>
        ))}
      </div>
      {own.length ? (
        <div className="stack">
          {own.map((c) => (
            <Link className="panel contract-row" key={c.id} to={`/contratacoes/${c.id}`}>
              <div>
                <h2>{c.title}</h2>
                <p>
                  {user?.role === 'CLIENT' ? c.freelancerName : c.clientName} ·{' '}
                  {new Date(c.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                </p>
              </div>
              <span
                className={`badge ${c.status === 'CONCLUIDO' ? 'green' : c.status === 'EM_DISPUTA' ? 'red' : ''}`}
              >
                {statusLabel[c.status]}
              </span>
              <strong>{money(c.price)}</strong>
              <span>Ver detalhes</span>
            </Link>
          ))}
        </div>
      ) : (
        <Empty title="Nenhuma contratação nesta lista">
          <p>Novas solicitações aparecem aqui.</p>
          <Link to="/servicos">Explorar serviços</Link>
        </Empty>
      )}
    </>
  )
}
export function ContractDetail() {
  const { id } = useParams(),
    { contracts, user, transition, replyReview } = useApp(),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    syncing = useFreshContracts()
  const c = contracts.find(
    (c) =>
      c.id === id &&
      (user?.role === 'ADMIN' || c.clientId === user?.id || c.freelancerId === user?.id),
  )
  if (!c)
    return <Empty title={syncing ? 'Carregando contratação…' : 'Contratação não encontrada'} />
  async function action(status: Contract['status']) {
    setBusy(true)
    setError('')
    try {
      await transition(c!.id, status)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  async function submitReply(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const d = new FormData(e.currentTarget),
      reply = String(d.get('reply') || '')
    setBusy(true)
    setError('')
    try {
      await replyReview(c!.id, reply)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <PageTitle
        title={c.title}
        description={`Contratação #${c.id.slice(0, 8)} · ${user?.role === 'CLIENT' ? c.freelancerName : c.clientName}`}
      />
      <ErrorMessage message={error} />
      <div className="detail-grid">
        <section className="panel">
          <span className="badge">{statusLabel[c.status]}</span>
          <h2>Escopo combinado</h2>
          <p>{c.description}</p>
          <dl className="details">
            <dt>Data desejada</dt>
            <dd>{new Date(c.date + 'T12:00:00').toLocaleDateString('pt-BR')}</dd>
            <dt>Endereço</dt>
            <dd>{c.address || 'Não informado'}</dd>
            <dt>Valor estimado</dt>
            <dd>{money(c.price)}</dd>
          </dl>
          <h2>Histórico da contratação</h2>
          <ol className="timeline">
            {c.history.map((h, i) => (
              <li key={i}>
                <strong>{statusLabel[h.status]}</strong>
                <small>{new Date(h.at).toLocaleString('pt-BR')}</small>
              </li>
            ))}
          </ol>
          {c.observations && <p>Observações finais: {c.observations}</p>}
          {c.dispute && (
            <div className="notice">
              <h3>Contestação</h3>
              <p>{c.dispute}</p>
            </div>
          )}
          {c.rating && (
            <div className="notice">
              <p className="success">
                Avaliação registrada: {c.rating} de 5. {c.review}
              </p>
              {c.reviewReply ? (
                <p>Resposta do profissional: {c.reviewReply}</p>
              ) : (
                user?.role === 'FREELANCER' &&
                c.freelancerId === user.id && (
                  <form onSubmit={submitReply}>
                    <label className="field">
                      <span>Responder avaliação (até 200 caracteres)</span>
                      <textarea name="reply" required maxLength={200} rows={2} />
                    </label>
                    <button className="button secondary" disabled={busy}>
                      Responder avaliação
                    </button>
                  </form>
                )
              )}
            </div>
          )}
        </section>
        <aside className="panel booking-panel">
          <h2>Próximo passo</h2>
          {user?.role === 'FREELANCER' && c.status === 'PENDENTE' && (
            <>
              <button className="button full" disabled={busy} onClick={() => void action('ACEITO')}>
                Aceitar solicitação
              </button>
              <button
                className="button secondary full"
                disabled={busy}
                onClick={() => void action('RECUSADO')}
              >
                Recusar solicitação
              </button>
            </>
          )}
          {user?.role === 'CLIENT' && c.status === 'PENDENTE' && (
            <button
              className="button secondary full"
              disabled={busy}
              onClick={() => void action('CANCELADO')}
            >
              Cancelar solicitação
            </button>
          )}
          {user?.role === 'FREELANCER' && c.status === 'ACEITO' && (
            <button
              className="button full"
              disabled={busy}
              onClick={() => void action('EM_ANDAMENTO')}
            >
              Iniciar serviço
            </button>
          )}
          {user?.role === 'FREELANCER' && c.status === 'EM_ANDAMENTO' && (
            <Link className="button full" to={`/contratacoes/${c.id}/concluir`}>
              Marcar como concluído
            </Link>
          )}
          {user?.role === 'CLIENT' && c.status === 'AGUARDANDO_CONFIRMACAO' && (
            <Link className="button full" to={`/contratacoes/${c.id}/confirmar`}>
              Confirmar ou contestar
            </Link>
          )}
          {user?.role === 'CLIENT' && canReview(c.status, c.completedAt) && !c.rating && (
            <Link className="button full" to={`/contratacoes/${c.id}/avaliar`}>
              Avaliar serviço
            </Link>
          )}
          {c.status === 'EM_DISPUTA' && (
            <Link to={`/contratacoes/${c.id}/disputa`}>Acompanhar disputa</Link>
          )}
          <p>
            O início depende do aceite do profissional. Pagamentos em sandbox serão integrados na
            etapa financeira.
          </p>
          <Link className="subtle-link" to={`/denunciar?alvo=${encodeURIComponent(c.title)}`}>
            Denunciar contratação
          </Link>
        </aside>
      </div>
    </>
  )
}
export function ContractAction() {
  const { id } = useParams(),
    { pathname } = useLocation(),
    { contracts, user, transition, review } = useApp(),
    navigate = useNavigate()
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [rating, setRating] = useState(5),
    syncing = useFreshContracts()
  const c = contracts.find(
      (c) => c.id === id && (c.clientId === user?.id || c.freelancerId === user?.id),
    ),
    kind = pathname.split('/').at(-1)
  if (!c)
    return <Empty title={syncing ? 'Carregando contratação…' : 'Contratação não encontrada'} />
  const titles: Record<string, string> = {
    concluir: 'Marcar como concluído',
    confirmar: 'Confirmar recebimento',
    contestar: 'Contestar conclusão',
    disputa: 'Acompanhar disputa',
    avaliar: 'Como foi o serviço?',
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const d = new FormData(e.currentTarget)
    setBusy(true)
    setError('')
    try {
      if (kind === 'avaliar') {
        await review(c!.id, rating, String(d.get('comment') || ''))
        navigate(`/contratacoes/${c!.id}/avaliacao-publicada`)
      } else {
        await transition(
          c!.id,
          kind === 'concluir'
            ? 'AGUARDANDO_CONFIRMACAO'
            : kind === 'contestar'
              ? 'EM_DISPUTA'
              : 'CONCLUIDO',
          String(d.get('comment') || ''),
        )
        navigate(`/contratacoes/${c!.id}`)
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <PageTitle
        title={titles[kind || ''] || 'Contratação'}
        description={`${c.title} · ${money(c.price)}`}
      />
      {kind === 'disputa' && <SimulationNotice />}
      {kind === 'disputa' ? (
        <section className="panel">
          <span className="badge red">Em disputa</span>
          <h2>Motivo da contestação</h2>
          <p>{c.dispute || 'Nenhuma contestação registrada.'}</p>
          <p>
            A avaliação fica suspensa até a decisão administrativa. A mediação nesta etapa é
            simulada.
          </p>
          <Link to={`/contratacoes/${c.id}`}>Voltar à contratação</Link>
        </section>
      ) : (
        <form className="form-panel" onSubmit={submit}>
          {kind === 'avaliar' ? (
            <>
              <div className="rating" role="group" aria-label="Nota do serviço">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={n <= rating ? 'selected' : ''}
                    aria-label={`${n} ${n === 1 ? 'estrela' : 'estrelas'}`}
                    aria-pressed={rating === n}
                    onClick={() => setRating(n)}
                  >
                    <Star fill={n <= rating ? 'currentColor' : 'none'} size={36} />
                  </button>
                ))}
              </div>
              <p>{rating} de 5 estrelas</p>
              <p>
                Você pode avaliar em até 7 dias após a conclusão. A avaliação não pode ser editada.
              </p>
            </>
          ) : (
            <p className="notice">
              {kind === 'concluir'
                ? 'O cliente terá 5 dias corridos para confirmar ou contestar a conclusão.'
                : kind === 'contestar'
                  ? 'Informe o problema para a mediação administrativa.'
                  : 'Confirme somente se o serviço foi concluído conforme o combinado.'}
            </p>
          )}
          {kind !== 'confirmar' && (
            <label className="field">
              <span>
                {kind === 'contestar'
                  ? 'Motivo da contestação *'
                  : kind === 'concluir'
                    ? 'Observações finais'
                    : 'Comentário'}
              </span>
              <textarea
                name="comment"
                required={kind === 'contestar'}
                maxLength={kind === 'contestar' ? 300 : 500}
                rows={5}
              />
            </label>
          )}
          <ErrorMessage message={error} />
          <div className="row">
            <Link className="button secondary" to={`/contratacoes/${c.id}`}>
              Cancelar
            </Link>
            <button className="button" disabled={busy}>
              {kind === 'avaliar'
                ? 'Enviar avaliação'
                : kind === 'concluir'
                  ? 'Confirmar conclusão'
                  : kind === 'contestar'
                    ? 'Enviar contestação'
                    : 'Confirmar recebimento'}
            </button>
          </div>
          {kind === 'confirmar' && (
            <Link className="subtle-link" to={`/contratacoes/${c.id}/contestar`}>
              Contestar conclusão
            </Link>
          )}
        </form>
      )}
    </>
  )
}
export function ReviewPublished() {
  const { id } = useParams()
  return (
    <div className="form-panel confirmation">
      <CheckCircle2 size={52} />
      <h1>Avaliação publicada</h1>
      <p>Seu comentário já aparece no histórico da contratação e no perfil do profissional.</p>
      <Link className="button" to={`/contratacoes/${id}`}>
        Ver contratação
      </Link>
    </div>
  )
}
