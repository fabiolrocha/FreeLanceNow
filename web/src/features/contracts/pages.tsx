import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Clock, MessageSquare, Star } from 'lucide-react'
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
  canReview,
  contractDeadline,
  dateLabel,
  disputeOf,
  futureDate,
  money,
  nextStepHint,
  statusLabel,
  today,
  statusTone,
} from '../../domain/rules'
import type { Contract, ContractStatus, Role } from '../../domain/types'

const actorLabel: Record<Role, string> = {
  CLIENT: 'cliente',
  FREELANCER: 'profissional',
  ADMIN: 'administração',
}
const decisionLabel: Partial<Record<ContractStatus, string>> = {
  CONCLUIDO: 'Conclusão confirmada',
  EM_ANDAMENTO: 'Serviço volta para execução',
  CANCELADO: 'Contratação cancelada',
}
const dateBR = (date: string) => new Date(date + 'T12:00:00').toLocaleDateString('pt-BR')

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
const contractFilters: [string, string, Contract['status'][] | null][] = [
  ['all', 'Todas', null],
  ['pending', 'Pendentes', ['PENDENTE']],
  ['active', 'Em andamento', ['ACEITO', 'EM_ANDAMENTO', 'AGUARDANDO_CONFIRMACAO']],
  ['done', 'Concluídas', ['CONCLUIDO']],
  ['dispute', 'Em disputa', ['EM_DISPUTA']],
  ['closed', 'Recusadas/canceladas', ['RECUSADO', 'CANCELADO']],
]
export function ContractList() {
  const { contracts, user, professionals } = useApp(),
    [params, setParams] = useSearchParams(),
    filter = contractFilters.some(([v]) => v === params.get('filtro'))
      ? params.get('filtro')!
      : 'all',
    [q, setQ] = useState('')
  const setFilter = (v: string) => setParams(v === 'all' ? {} : { filtro: v }, { replace: true })
  useFreshContracts()
  const freelancer = user?.role === 'FREELANCER'
  const mine = contracts.filter((c) =>
    user?.role === 'CLIENT' ? c.clientId === user.id : c.freelancerId === user?.id,
  )
  const term = q.trim().toLocaleLowerCase('pt-BR')
  const statuses = contractFilters.find(([v]) => v === filter)?.[2]
  const own = mine.filter(
    (c) =>
      (!statuses || statuses.includes(c.status)) &&
      (!term ||
        `${c.title} ${c.clientName} ${c.freelancerName}`.toLocaleLowerCase('pt-BR').includes(term)),
  )
  return (
    <>
      <PageTitle
        title="Minhas contratações"
        description={
          freelancer
            ? 'Solicitações recebidas ficam em "Pendentes": responda em até 48 horas.'
            : 'Acompanhe cada etapa do serviço, do pedido à avaliação.'
        }
      />
      <div className="tabs" role="group" aria-label="Filtrar contratações">
        {contractFilters.map(([v, label, st]) => (
          <button
            key={v}
            aria-pressed={filter === v}
            className={filter === v ? 'active' : ''}
            onClick={() => setFilter(v)}
          >
            {v === 'pending' && freelancer ? 'Solicitações' : label} (
            {st ? mine.filter((c) => st.includes(c.status)).length : mine.length})
          </button>
        ))}
      </div>
      {mine.length > 3 && (
        <label className="search-input">
          <span className="sr-only">Buscar contratação</span>
          <input
            aria-label="Buscar contratação"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por serviço ou pessoa"
          />
        </label>
      )}
      {own.length ? (
        <div className="stack">
          {own.map((c) => (
            <Link className="panel contract-row" key={c.id} to={`/contratacoes/${c.id}`}>
              {user?.role === 'CLIENT' ? (
                <Avatar
                  name={c.freelancerName}
                  src={avatarUrl(
                    c.freelancerId,
                    professionals.find((p) => p.id === c.freelancerId)?.avatarVersion,
                  )}
                />
              ) : (
                <Avatar name={c.clientName} />
              )}
              <div>
                <h2>{c.title}</h2>
                <p>
                  {user?.role === 'CLIENT' ? c.freelancerName : c.clientName} ·{' '}
                  {new Date(c.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                </p>
                {contractDeadline(c) && (
                  <small>
                    {contractDeadline(c)!.text} {dateLabel(contractDeadline(c)!.at)}
                  </small>
                )}
              </div>
              <span className={`badge status ${statusTone(c.status)}`}>
                {statusLabel[c.status]}
              </span>
              <strong>{money(c.price)}</strong>
              <span>Ver detalhes</span>
            </Link>
          ))}
        </div>
      ) : (
        <Empty title="Nenhuma contratação nesta lista">
          {freelancer ? (
            <>
              <p>Pedidos de clientes para seus serviços aparecem aqui.</p>
              <Link to="/demandas">Ver demandas abertas</Link>
            </>
          ) : (
            <>
              <p>Ao solicitar um serviço ou aceitar uma proposta, a contratação aparece aqui.</p>
              <Link to="/servicos">Explorar serviços</Link>
            </>
          )}
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
  const deadline = contractDeadline(c),
    isParticipant = user?.id === c.clientId || user?.id === c.freelancerId
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
          <span className={`badge status ${statusTone(c.status)}`}>{statusLabel[c.status]}</span>
          {deadline && (
            <p className="deadline" role="status">
              <Clock size={18} aria-hidden />
              <span>
                {deadline.text} <strong>{dateLabel(deadline.at)}</strong>.
              </span>
            </p>
          )}
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
                <small>
                  {new Date(h.at).toLocaleString('pt-BR')}
                  {i > 0 && (h.actorRole ? ` · por ${actorLabel[h.actorRole]}` : ' · automático')}
                </small>
                {i > 0 && h.comment && <p>{h.comment}</p>}
              </li>
            ))}
          </ol>
          {c.observations && <p>Observações finais: {c.observations}</p>}
          {c.rating && (
            <div className="notice">
              <p className="success">
                <Stars rating={c.rating} /> Avaliação registrada: {c.rating} de 5. {c.review}
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
          {user?.role !== 'ADMIN' && (
            <Link className="button secondary full" to={`/mensagens?contratacao=${c.id}`}>
              <MessageSquare size={18} /> Conversar com{' '}
              {user?.id === c.clientId ? c.freelancerName : c.clientName}
            </Link>
          )}
          <h2>Próximo passo</h2>
          {user?.role === 'FREELANCER' && c.status === 'PENDENTE' && (
            <>
              <ConfirmButton
                className="button full"
                disabled={busy}
                label="Aceitar solicitação"
                title="Aceitar esta solicitação?"
                message={`Você se compromete a atender ${c.clientName} em ${dateBR(c.date)}. Depois do aceite, a contratação só pode ser cancelada com motivo, antes de iniciar o serviço.`}
                confirmLabel="Sim, aceitar"
                onConfirm={() => void action('ACEITO')}
              />
              <ConfirmButton
                className="button secondary full"
                disabled={busy}
                label="Recusar solicitação"
                title="Recusar esta solicitação?"
                message={`${c.clientName} será avisado e a solicitação será encerrada. Não é possível desfazer.`}
                confirmLabel="Sim, recusar"
                danger
                onConfirm={() => void action('RECUSADO')}
              />
            </>
          )}
          {user?.role === 'CLIENT' && c.status === 'PENDENTE' && (
            <ConfirmButton
              className="button secondary full"
              disabled={busy}
              label="Cancelar solicitação"
              title="Cancelar esta solicitação?"
              message={`${c.freelancerName} será avisado e a solicitação será encerrada. Não é possível desfazer.`}
              confirmLabel="Sim, cancelar"
              danger
              onConfirm={() => void action('CANCELADO')}
            />
          )}
          {user?.role === 'FREELANCER' && c.status === 'ACEITO' && (
            <ConfirmButton
              className="button full"
              disabled={busy}
              label="Iniciar serviço"
              title="Iniciar o serviço agora?"
              message="Depois de iniciado, o serviço não pode mais ser cancelado. Se houver um problema, qualquer uma das partes pode abrir uma disputa."
              confirmLabel="Sim, iniciar"
              onConfirm={() => void action('EM_ANDAMENTO')}
            />
          )}
          {user?.role === 'FREELANCER' && c.status === 'EM_ANDAMENTO' && (
            <Link className="button full" to={`/contratacoes/${c.id}/concluir`}>
              Marcar como concluído
            </Link>
          )}
          {isParticipant && c.status === 'ACEITO' && (
            <Link className="button secondary full" to={`/contratacoes/${c.id}/cancelar`}>
              Cancelar contratação
            </Link>
          )}
          {isParticipant && c.status === 'EM_ANDAMENTO' && (
            <Link className="subtle-link" to={`/contratacoes/${c.id}/contestar`}>
              Abrir disputa
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
          {isParticipant && disputeOf(c) && (
            <Link to={`/contratacoes/${c.id}/disputa`}>
              {c.status === 'EM_DISPUTA' ? 'Acompanhar disputa' : 'Ver disputa encerrada'}
            </Link>
          )}
          <p>
            {nextStepHint(
              c.status,
              user?.role,
              user?.id === c.clientId ? c.freelancerName : c.clientName,
            )}
          </p>
          {user?.role === 'CLIENT' && (isMock || c.serviceId) && (
            <Link
              className="subtle-link"
              to={`/denunciar?type=SERVICE&id=${c.serviceId || ''}&alvo=${encodeURIComponent(c.title)}`}
            >
              Denunciar anúncio
            </Link>
          )}
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
    kind = pathname.split('/').at(-1) || ''
  if (!c)
    return <Empty title={syncing ? 'Carregando contratação…' : 'Contratação não encontrada'} />
  const role = user?.role,
    other = role === 'CLIENT' ? c.freelancerName : c.clientName,
    dispute = disputeOf(c),
    duringWork = c.status === 'EM_ANDAMENTO'
  const available: Record<string, boolean> = {
    concluir: role === 'FREELANCER' && c.status === 'EM_ANDAMENTO',
    confirmar: role === 'CLIENT' && c.status === 'AGUARDANDO_CONFIRMACAO',
    contestar: duringWork || (role === 'CLIENT' && c.status === 'AGUARDANDO_CONFIRMACAO'),
    cancelar: c.status === 'ACEITO',
    avaliar: role === 'CLIENT' && canReview(c.status, c.completedAt) && !c.rating,
    disputa: !!dispute,
  }
  const back = <Link to={`/contratacoes/${c.id}`}>Voltar à contratação</Link>
  if (!available[kind] && !busy)
    return (
      <Empty title={kind === 'disputa' ? 'Esta contratação não tem disputa' : 'Ação indisponível'}>
        <p>
          {kind === 'disputa'
            ? 'Nenhuma das partes abriu disputa nesta contratação.'
            : `A contratação está como "${statusLabel[c.status]}" e esta ação não se aplica agora.`}
        </p>
        {back}
      </Empty>
    )
  const titles: Record<string, string> = {
    concluir: 'Marcar como concluído',
    confirmar: 'Confirmar recebimento',
    contestar: duringWork ? 'Abrir disputa' : 'Contestar conclusão',
    cancelar: 'Cancelar contratação',
    disputa: 'Disputa da contratação',
    avaliar: 'Como foi o serviço?',
  }
  async function run(comment: string) {
    setBusy(true)
    setError('')
    try {
      if (kind === 'avaliar') {
        await review(c!.id, rating, comment)
        navigate(`/contratacoes/${c!.id}/avaliacao-publicada`)
      } else {
        const next: Record<string, ContractStatus> = {
          concluir: 'AGUARDANDO_CONFIRMACAO',
          contestar: 'EM_DISPUTA',
          cancelar: 'CANCELADO',
          confirmar: 'CONCLUIDO',
        }
        await transition(c!.id, next[kind], comment)
        navigate(`/contratacoes/${c!.id}`)
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    void run(String(new FormData(e.currentTarget).get('comment') || ''))
  }
  if (kind === 'disputa' && dispute)
    return (
      <>
        <PageTitle title={titles.disputa} description={`${c.title} · ${money(c.price)}`} />
        <section className="panel">
          <span className={`badge ${dispute.decision ? 'green' : 'red'}`}>
            {dispute.decision ? 'Disputa encerrada' : 'Em análise pela administração'}
          </span>
          <h2>Motivo da disputa</h2>
          <p>{dispute.reason || 'Motivo não informado.'}</p>
          <small>
            Aberta {dispute.by ? `pelo ${actorLabel[dispute.by]} ` : ''}em{' '}
            {new Date(dispute.at).toLocaleString('pt-BR')}
          </small>
          {dispute.decision ? (
            <>
              <h2>Decisão da administração</h2>
              <p>
                <strong>
                  {decisionLabel[dispute.decision.status] || statusLabel[dispute.decision.status]}
                </strong>{' '}
                · {new Date(dispute.decision.at).toLocaleString('pt-BR')}
              </p>
              {dispute.decision.note && <p>{dispute.decision.note}</p>}
            </>
          ) : (
            <p>
              A administração analisa o motivo e o histórico da contratação e pode confirmar a
              conclusão, devolver o serviço à execução ou cancelar a contratação. Você recebe um
              aviso quando houver decisão. Até lá, a avaliação fica suspensa.
            </p>
          )}
          {back}
        </section>
      </>
    )
  const notices: Record<string, string> = {
    concluir: 'O cliente terá 5 dias corridos para confirmar ou contestar a conclusão.',
    contestar: duringWork
      ? 'Use a disputa quando não houver acordo depois do início do serviço. A administração analisa o caso e pode devolver o serviço à execução, confirmar a conclusão ou cancelar a contratação.'
      : 'Informe o problema para a mediação administrativa.',
    cancelar: `O cancelamento encerra a contratação e não pode ser desfeito. ${other} será avisado com o motivo informado.`,
    confirmar:
      'Confirme somente se o serviço foi concluído conforme o combinado. Depois disso não é possível contestar.',
  }
  const fieldLabels: Record<string, string> = {
    contestar: duringWork ? 'Motivo da disputa *' : 'Motivo da contestação *',
    cancelar: 'Motivo do cancelamento *',
    concluir: 'Observações finais',
    avaliar: 'Comentário',
  }
  const submitLabels: Record<string, string> = {
    avaliar: 'Enviar avaliação',
    concluir: 'Confirmar conclusão',
    contestar: duringWork ? 'Abrir disputa' : 'Enviar contestação',
    cancelar: 'Cancelar contratação',
  }
  const reasonRequired = kind === 'contestar' || kind === 'cancelar'
  return (
    <>
      <PageTitle
        title={titles[kind] || 'Contratação'}
        description={`${c.title} · ${money(c.price)}`}
      />
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
          <p className="notice">{notices[kind]}</p>
        )}
        {kind !== 'confirmar' && (
          <label className="field">
            <span>{fieldLabels[kind]}</span>
            <textarea
              name="comment"
              required={reasonRequired}
              maxLength={reasonRequired ? 300 : 500}
              rows={5}
            />
          </label>
        )}
        <ErrorMessage message={error} />
        <div className="row">
          <Link className="button secondary" to={`/contratacoes/${c.id}`}>
            Voltar
          </Link>
          {kind === 'confirmar' ? (
            <ConfirmButton
              disabled={busy}
              label="Confirmar recebimento"
              title="Confirmar o recebimento do serviço?"
              message="A contratação será concluída e não poderá mais ser contestada. Você terá 7 dias para avaliar o profissional."
              confirmLabel="Sim, confirmar"
              onConfirm={() => void run('')}
            />
          ) : (
            <button className={kind === 'cancelar' ? 'button danger' : 'button'} disabled={busy}>
              {submitLabels[kind]}
            </button>
          )}
        </div>
        {kind === 'confirmar' && (
          <Link className="subtle-link" to={`/contratacoes/${c.id}/contestar`}>
            Contestar conclusão
          </Link>
        )}
      </form>
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
