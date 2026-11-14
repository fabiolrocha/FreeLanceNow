import { useState } from 'react'
import { isMock } from '../../data/client'
import { moderateMockPost } from '../../data/feed'
import { ApiAdminUsers, ApiAdminCategories, ApiAdminModeration, ApiAdminReports } from './api-pages'
import { Link } from 'react-router-dom'
import { useApp } from '../../app/store'
import { demoUsers, professionals } from '../../data/fixtures'
import { Avatar, ConfirmButton, Field, PageTitle, Empty } from '../../components/ui'
import { exportCsv } from '../../data/exportCsv'

function MockAdminUsers() {
  const [users, setUsers] = useState(
      [
        ...demoUsers,
        ...professionals
          .filter((p) => p.id !== 'marcos')
          .map((p) => ({ ...p, email: `${p.id}@demo.freelancenow.test`, phone: '61999990000' })),
      ].map((u) => ({ ...u, active: true })),
    ),
    [q, setQ] = useState('')
  return (
    <>
      <PageTitle
        title="Gerenciamento de usuários"
        description="Painel administrativo simulado. Ações não alteram o banco da API."
        action={
          <button
            className="button secondary"
            onClick={() =>
              exportCsv('usuarios-demo.csv', [
                ['Nome', 'Perfil', 'Status'],
                ...users.map((u) => [u.name, u.role, u.active ? 'Ativo' : 'Suspenso']),
              ])
            }
          >
            Exportar CSV
          </button>
        }
      />
      <Field label="Buscar por nome ou e-mail" value={q} onChange={(e) => setQ(e.target.value)} />
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
            {users
              .filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(q.toLowerCase()))
              .map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="person">
                      <Avatar name={u.name} />
                      <div>
                        <strong>{u.name}</strong>
                        <small>{u.email}</small>
                      </div>
                    </div>
                  </td>
                  <td>{u.role}</td>
                  <td>
                    <span className={`badge ${u.active ? 'green' : 'red'}`}>
                      {u.active ? 'Ativo' : 'Suspenso'}
                    </span>
                  </td>
                  <td>
                    {u.role !== 'ADMIN' && (
                      <button
                        className="text-button"
                        onClick={() =>
                          setUsers((us) =>
                            us.map((x) => (x.id === u.id ? { ...x, active: !x.active } : x)),
                          )
                        }
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
      <p>
        Contas com histórico serão suspensas, preservando o registro das contratações. A exclusão
        definitiva ainda não está implementada.
      </p>
    </>
  )
}
function MockAdminCategories() {
  const { categories } = useApp(),
    [items, setItems] = useState(categories.map((c) => ({ ...c, active: true }))),
    [name, setName] = useState('')
  return (
    <>
      <PageTitle
        title="Categorias de serviço"
        description="Gestão visual de categorias; alterações valem apenas nesta tela."
      />
      <form
        className="panel row"
        onSubmit={(e) => {
          e.preventDefault()
          if (!name.trim()) return
          setItems((cs) => [
            ...cs,
            { id: crypto.randomUUID(), name: name.trim(), slug: 'demo', active: true },
          ])
          setName('')
        }}
      >
        <input
          aria-label="Nome da nova categoria"
          required
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome da categoria"
        />
        <button className="button">Adicionar categoria</button>
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
            {items.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.active ? 'Ativa' : 'Desativada'}</td>
                <td>
                  <button
                    className="text-button"
                    onClick={() =>
                      setItems((cs) =>
                        cs.map((x) => (x.id === c.id ? { ...x, active: !x.active } : x)),
                      )
                    }
                  >
                    {c.active ? 'Desativar' : 'Reativar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
interface ReportRecord {
  targetType?: string
  targetId?: string
  id: string
  target: string
  reason: string
  comment: string
  status: string
}
function MockAdminModeration() {
  const { contracts, transition } = useApp(),
    [note, setNote] = useState(''),
    [reports, setReports] = useState<ReportRecord[]>(() => {
      try {
        return JSON.parse(sessionStorage.getItem('fln-reports') || '[]')
      } catch {
        return []
      }
    })
  const disputes = contracts.filter((c) => c.status === 'EM_DISPUTA')
  function decide(id: string, status: string) {
    const report = reports.find((r) => r.id === id)
    if (status === 'Remoção simulada' && report?.targetType === 'POST' && report.targetId)
      moderateMockPost(report.targetId)
    const next = reports.map((r) => (r.id === id ? { ...r, status } : r))
    setReports(next)
    sessionStorage.setItem('fln-reports', JSON.stringify(next))
  }
  return (
    <>
      <PageTitle
        title="Fila de moderação"
        description="Denúncias e disputas registradas na demonstração."
      />
      <div className="stack">
        {reports.map((r) => (
          <article className="panel" key={r.id}>
            <span className="badge">{r.status === 'PENDING' ? 'Pendente' : r.status}</span>
            <h2>{r.target}</h2>
            <strong>{r.reason}</strong>
            <p>{r.comment}</p>
            {r.status === 'PENDING' && (
              <div className="row">
                <button className="button secondary" onClick={() => decide(r.id, 'Mantido')}>
                  Manter conteúdo
                </button>
                <button className="button" onClick={() => decide(r.id, 'Remoção simulada')}>
                  Simular remoção
                </button>
              </div>
            )}
          </article>
        ))}
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
            <span className="badge red">Disputa</span>
            <h2>{c.title}</h2>
            <p>{c.dispute}</p>
            <Link to={`/contratacoes/${c.id}`}>Consultar histórico</Link>
            <div className="row">
              <button
                className="button"
                disabled={!note.trim()}
                onClick={() => void transition(c.id, 'CONCLUIDO', note).then(() => setNote(''))}
              >
                Confirmar conclusão
              </button>
              <button
                className="button secondary"
                disabled={!note.trim()}
                onClick={() => void transition(c.id, 'EM_ANDAMENTO', note).then(() => setNote(''))}
              >
                Voltar para execução
              </button>
              <ConfirmButton
                className="button danger"
                disabled={!note.trim()}
                label="Cancelar contratação"
                title="Cancelar esta contratação?"
                message="A contratação será encerrada como cancelada para cliente e profissional. A decisão não pode ser desfeita."
                confirmLabel="Sim, cancelar"
                danger
                onConfirm={() => void transition(c.id, 'CANCELADO', note).then(() => setNote(''))}
              />
            </div>
          </article>
        ))}
        {!reports.length && !disputes.length && (
          <Empty title="Fila vazia">
            <p>Nenhuma denúncia ou disputa aguardando análise.</p>
          </Empty>
        )}
      </div>
    </>
  )
}
function MockAdminReports() {
  const { services, contracts, professionals } = useApp()
  return (
    <>
      <PageTitle
        title="Relatórios da demonstração"
        description="Indicadores calculados a partir dos dados fictícios desta sessão."
        action={
          <button
            className="button secondary"
            onClick={() =>
              exportCsv('metricas-demo.csv', [
                ['Indicador', 'Quantidade'],
                ['Serviços ativos', String(services.length)],
                ['Contratações', String(contracts.length)],
                ['Profissionais', String(professionals.length)],
              ])
            }
          >
            Exportar CSV
          </button>
        }
      />
      <div className="stats">
        <div>
          <span>Profissionais</span>
          <strong>{professionals.length}</strong>
        </div>
        <div>
          <span>Serviços ativos</span>
          <strong>{services.length}</strong>
        </div>
        <div>
          <span>Contratações</span>
          <strong>{contracts.length}</strong>
        </div>
      </div>
      <section className="panel">
        <h2>Status das contratações</h2>
        {[
          'PENDENTE',
          'ACEITO',
          'EM_ANDAMENTO',
          'AGUARDANDO_CONFIRMACAO',
          'CONCLUIDO',
          'EM_DISPUTA',
        ].map((status) => (
          <div className="metric-row" key={status}>
            <span>{status.replaceAll('_', ' ').toLowerCase()}</span>
            <strong>{contracts.filter((c) => c.status === status).length}</strong>
          </div>
        ))}
      </section>
    </>
  )
}
export function AdminTransactions() {
  return (
    <>
      <PageTitle
        title="Transações e custódia"
        description="Área financeira planejada para integração futura."
      />
      <section className="panel">
        <h2>Fluxo financeiro de demonstração</h2>
        <p>
          Taxa ilustrativa de 10% sobre o repasse ao profissional. Custódia, reembolso, webhook e
          conciliação serão implementados com um gateway.
        </p>
        <Link className="button secondary" to="/transacao">
          Abrir transação ilustrativa
        </Link>
      </section>
    </>
  )
}

export function AdminUsers() {
  return isMock ? <MockAdminUsers /> : <ApiAdminUsers />
}

export function AdminCategories() {
  return isMock ? <MockAdminCategories /> : <ApiAdminCategories />
}

export function AdminModeration() {
  return isMock ? <MockAdminModeration /> : <ApiAdminModeration />
}

export function AdminReports() {
  return isMock ? <MockAdminReports /> : <ApiAdminReports />
}
