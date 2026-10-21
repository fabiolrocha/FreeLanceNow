import { useEffect, useState, useCallback } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../../app/store'
import { adminApi } from '../../data/admin'
import type { AdminCategory, ContentReport, Metrics } from '../../data/admin'
import { exportCsv } from '../../data/exportCsv'
import { ErrorMessage, Field, PageTitle, Empty } from '../../components/ui'

function useResource<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T>(),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true)
  const reload = useCallback(async () => {
    setError('')
    try {
      setData(await load())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [load])
  useEffect(() => {
    let alive = true
    void load()
      .then((d) => {
        if (alive) setData(d)
      })
      .catch((e) => {
        if (alive) setError(e.message)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [load])
  return { data, setData, error, setError, loading, reload }
}
function Feedback({
  loading,
  error,
  retry,
}: {
  loading: boolean
  error: string
  retry: () => void
}) {
  return (
    <>
      <ErrorMessage message={error} />
      {error && (
        <button className="button secondary" onClick={retry}>
          Tentar novamente
        </button>
      )}
      {loading && <p role="status">Carregando…</p>}
    </>
  )
}
export function ApiAdminUsers() {
  const r = useResource(adminApi.users),
    { refresh } = useApp()
  const [q, setQ] = useState(''),
    [role, setRole] = useState(''),
    [status, setStatus] = useState(''),
    [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [reason, setReason] = useState(''),
    [busy, setBusy] = useState('')
  const items = (r.data || []).filter(
    (u) =>
      `${u.name} ${u.email}`.toLowerCase().includes(q.toLowerCase()) &&
      (!role || u.role === role) &&
      (!status || String(u.active) === status) &&
      (!from || u.createdAt.slice(0, 10) >= from) &&
      (!to || u.createdAt.slice(0, 10) <= to),
  )
  async function toggle(id: string, active: boolean) {
    if (!reason.trim()) {
      r.setError('Informe o motivo da alteração.')
      return
    }
    setBusy(id)
    r.setError('')
    try {
      const u = await adminApi.status(id, active, reason)
      r.setData((us) => us?.map((x) => (x.id === id ? u : x)))
      await refresh()
    } catch (e) {
      r.setError((e as Error).message)
    } finally {
      setBusy('')
    }
  }
  return (
    <>
      <PageTitle
        title="Gerenciamento de usuários"
        description="Contas persistidas. Suspensão preserva o histórico e bloqueia o acesso."
        action={
          <button
            className="button secondary"
            onClick={() =>
              exportCsv('usuarios.csv', [
                ['Nome', 'E-mail', 'Perfil', 'Status'],
                ...items.map((u) => [u.name, u.email, u.role, u.active ? 'Ativo' : 'Suspenso']),
              ])
            }
          >
            Exportar CSV
          </button>
        }
      />
      <Feedback loading={r.loading} error={r.error} retry={() => void r.reload()} />
      <section className="panel stack">
        <Field label="Buscar por nome ou e-mail" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="form-columns">
          <label className="field">
            <span>Tipo de conta</span>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="">Todos</option>
              <option value="CLIENT">Cliente</option>
              <option value="FREELANCER">Freelancer</option>
              <option value="ADMIN">Admin</option>
            </select>
          </label>
          <label className="field">
            <span>Status da conta</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Todos</option>
              <option value="true">Ativo</option>
              <option value="false">Suspenso</option>
            </select>
          </label>
          <Field
            label="Cadastro desde"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <Field
            label="Cadastro até"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <Field
          label="Motivo da alteração"
          value={reason}
          maxLength={1000}
          onChange={(e) => setReason(e.target.value)}
          hint="Obrigatório para suspender ou reativar; ficará na auditoria."
        />
      </section>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Usuário</th>
              <th>Perfil</th>
              <th>Status</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            {items.map((u) => (
              <tr key={u.id}>
                <td>
                  <strong>{u.name}</strong>
                  <small>{u.email}</small>
                  <details>
                    <summary>Ver perfil</summary>
                    <p>
                      {u.phone} · {u.city || 'Cidade não informada'}
                    </p>
                    <p>{u.bio || 'Sem descrição.'}</p>
                    <small>Cadastro: {new Date(u.createdAt).toLocaleDateString('pt-BR')}</small>
                  </details>
                </td>
                <td>{u.role}</td>
                <td>{u.active ? 'Ativo' : 'Suspenso'}</td>
                <td>
                  {u.role !== 'ADMIN' && (
                    <button
                      className="text-button"
                      disabled={!!busy}
                      onClick={() => void toggle(u.id, !u.active)}
                    >
                      {u.active ? 'Suspender' : 'Reativar'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!r.loading && !items.length && <Empty title="Nenhum usuário encontrado" />}
    </>
  )
}
function CategoryRow({
  category: c,
  save,
  busy,
}: {
  category: AdminCategory
  save: (c: AdminCategory) => Promise<void>
  busy: boolean
}) {
  const [name, setName] = useState(c.name)
  return (
    <tr>
      <td>
        <strong>{c.name}</strong>
        <input
          aria-label={`Novo nome de ${c.name}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
        />
      </td>
      <td>{c.active ? 'Ativa' : 'Desativada'}</td>
      <td>
        <div className="row">
          <button
            className="text-button"
            disabled={busy || !name.trim()}
            onClick={() => void save({ ...c, name })}
          >
            Salvar nome
          </button>
          <button
            className="text-button"
            disabled={busy}
            onClick={() => void save({ ...c, active: !c.active })}
          >
            {c.active ? 'Desativar' : 'Reativar'}
          </button>
        </div>
      </td>
    </tr>
  )
}
export function ApiAdminCategories() {
  const r = useResource(adminApi.categories),
    { refresh } = useApp(),
    [name, setName] = useState(''),
    [busy, setBusy] = useState(false)
  async function save(c?: AdminCategory) {
    setBusy(true)
    r.setError('')
    try {
      if (c) await adminApi.updateCategory(c)
      else {
        await adminApi.createCategory(name)
        setName('')
      }
      await r.reload()
      await refresh()
    } catch (e) {
      r.setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <PageTitle
        title="Categorias de serviço"
        description="Cadastro persistente; desativar impede novos anúncios sem apagar os existentes."
      />
      <Feedback loading={r.loading} error={r.error} retry={() => void r.reload()} />
      <form
        className="panel row"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <Field
          label="Nome da nova categoria"
          required
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="button" disabled={busy}>
          Adicionar categoria
        </button>
      </form>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Categoria</th>
              <th>Status</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            {r.data?.map((c) => (
              <CategoryRow key={c.id} category={c} save={save} busy={busy} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
const reportLabels = { PENDING: 'Pendente', KEPT: 'Mantido', REMOVED: 'Removido' }
function ReportCard({
  report: r,
  decide,
  busy,
}: {
  report: ContentReport
  decide: (id: string, status: 'KEPT' | 'REMOVED', note: string) => Promise<void>
  busy: boolean
}) {
  const [note, setNote] = useState('')
  return (
    <article className="panel">
      <span className="badge">{reportLabels[r.status]}</span>
      <h2>{r.targetTitle}</h2>
      <p>
        {r.targetType === 'SERVICE' ? 'Anúncio' : 'Avaliação'} · Reportado por {r.reporterName}
      </p>
      <h3>{r.reason}</h3>
      <p>{r.comment}</p>
      <details>
        <summary>Conteúdo no momento da denúncia</summary>
        <p>{r.targetContent}</p>
      </details>
      {r.status === 'PENDING' ? (
        <>
          <label className="field">
            <span>Justificativa da decisão</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={1000}
              rows={3}
            />
          </label>
          <div className="row">
            <button
              className="button secondary"
              disabled={busy || !note.trim()}
              onClick={() => void decide(r.id, 'KEPT', note)}
            >
              Manter conteúdo
            </button>
            <button
              className="button"
              disabled={busy || !note.trim()}
              onClick={() => void decide(r.id, 'REMOVED', note)}
            >
              Remover conteúdo
            </button>
          </div>
        </>
      ) : (
        <p>
          {r.decisionNote} · {r.decidedByName}
        </p>
      )}
    </article>
  )
}
export function ApiAdminModeration() {
  const r = useResource(adminApi.reports),
    { contracts, reloadContracts, refresh, transition } = useApp(),
    [busy, setBusy] = useState(false),
    [note, setNote] = useState('')
  const disputes = contracts.filter((c) => c.status === 'EM_DISPUTA')
  async function decide(id: string, status: 'KEPT' | 'REMOVED', note: string) {
    setBusy(true)
    r.setError('')
    try {
      await adminApi.decide(id, status, note)
      await r.reload()
      await refresh()
    } catch (e) {
      r.setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  async function dispute(id: string, status: 'CONCLUIDO' | 'EM_ANDAMENTO') {
    setBusy(true)
    r.setError('')
    try {
      await transition(id, status, note)
      await reloadContracts()
    } catch (e) {
      r.setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <PageTitle
        title="Fila de moderação"
        description="Denúncias e disputas persistidas; decisões registradas na auditoria."
        action={
          <button
            className="button secondary"
            onClick={() => {
              void r.reload()
              void reloadContracts()
            }}
          >
            Atualizar fila
          </button>
        }
      />
      <Feedback loading={r.loading} error={r.error} retry={() => void r.reload()} />
      <section className="stack">
        {r.data?.map((report) => (
          <ReportCard key={report.id} report={report} decide={decide} busy={busy} />
        ))}
      </section>
      <PageTitle title="Disputas de contratação" />
      {!!disputes.length && (
        <Field
          label="Justificativa da mediação"
          value={note}
          maxLength={500}
          onChange={(e) => setNote(e.target.value)}
        />
      )}
      {disputes.map((c) => (
        <article className="panel" key={c.id}>
          <h2>{c.title}</h2>
          <p>{c.dispute}</p>
          <Link to={`/contratacoes/${c.id}`}>Consultar histórico</Link>
          <div className="row">
            <button
              className="button"
              disabled={busy || !note.trim()}
              onClick={() => void dispute(c.id, 'CONCLUIDO')}
            >
              Confirmar conclusão
            </button>
            <button
              className="button secondary"
              disabled={busy || !note.trim()}
              onClick={() => void dispute(c.id, 'EM_ANDAMENTO')}
            >
              Voltar para execução
            </button>
          </div>
        </article>
      ))}
      {!r.loading && !r.data?.length && !disputes.length && <Empty title="Fila vazia" />}
    </>
  )
}
const metricLabels: Record<keyof Metrics, string> = {
  users: 'Usuários',
  services: 'Serviços cadastrados',
  contracts: 'Contratações',
  reviews: 'Avaliações',
  reports: 'Denúncias',
  pendingReports: 'Denúncias pendentes',
  disputes: 'Disputas',
}
export function ApiAdminReports() {
  const audit = useResource(adminApi.audit),
    [metrics, setMetrics] = useState<Metrics>(),
    [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [error, setError] = useState('')
  useEffect(() => {
    let active = true
    void adminApi
      .metrics()
      .then((m) => {
        if (active) setMetrics(m)
      })
      .catch((e) => {
        if (active) setError(e.message)
      })
    return () => {
      active = false
    }
  }, [])
  async function filter(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      setMetrics(await adminApi.metrics(from, to))
      await audit.reload()
    } catch (e) {
      setError((e as Error).message)
    }
  }
  return (
    <>
      <PageTitle
        title="Relatórios da plataforma"
        description="Totais persistidos por data de criação. A auditoria exibe as 200 ações mais recentes, sem filtro de período."
        action={
          <button
            className="button secondary"
            disabled={!metrics}
            onClick={() =>
              exportCsv('metricas.csv', [
                ['Indicador', 'Quantidade'],
                ...Object.entries(metrics || {}).map(([k, v]) => [
                  metricLabels[k as keyof Metrics],
                  String(v),
                ]),
              ])
            }
          >
            Exportar CSV
          </button>
        }
      />
      <ErrorMessage message={error} />
      <form className="panel row" onSubmit={(e) => void filter(e)}>
        <Field
          label="Período desde"
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <Field label="Período até" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <button className="button">Aplicar período</button>
      </form>
      <div className="stats">
        {metrics &&
          Object.entries(metrics).map(([k, v]) => (
            <div key={k}>
              <span>{metricLabels[k as keyof Metrics]}</span>
              <strong>{v}</strong>
            </div>
          ))}
      </div>
      <PageTitle title="Auditoria administrativa" />
      <Feedback loading={audit.loading} error={audit.error} retry={() => void audit.reload()} />
      <div className="stack">
        {audit.data?.map((e) => (
          <article className="panel" key={e.id}>
            <strong>{e.action}</strong>
            <p>
              {e.actorName} · {new Date(e.createdAt).toLocaleString('pt-BR')}
            </p>
            <p>
              {e.targetType} · {e.targetId}
            </p>
            <p>
              {e.beforeValue || '—'} → {e.afterValue}
            </p>
            {e.reason && <p>{e.reason}</p>}
          </article>
        ))}
      </div>
    </>
  )
}
