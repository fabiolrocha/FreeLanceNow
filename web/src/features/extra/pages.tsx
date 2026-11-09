import { useEffect, useRef, useState } from 'react'
import { isMock } from '../../data/client'
import { inbox } from '../../data/inbox'
import type { AppNotification, ChatMessage, Inbox } from '../../data/inbox'
import { ApiReport } from './report-api'
import { exportCsv } from '../../data/exportCsv'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Bell, Send, ShieldCheck } from 'lucide-react'
import { useApp } from '../../app/store'
import { publishUnread } from '../../app/useUnread'
import {
  Avatar,
  Empty,
  ErrorMessage,
  Field,
  PageTitle,
  SimulationNotice,
} from '../../components/ui'
import { dateLabel, money, statusLabel } from '../../domain/rules'
import type { Contract } from '../../domain/types'

export function Notifications() {
  const { contracts, user } = useApp(),
    navigate = useNavigate(),
    [data, setData] = useState<Inbox | null>(null),
    [error, setError] = useState(''),
    [version, setVersion] = useState(0)
  useEffect(() => {
    if (!user) return
    let active = true
    inbox
      .list(user, contracts)
      .then((d) => {
        if (!active) return
        setData(d)
        setError('')
        publishUnread(d.unread)
      })
      .catch((e: Error) => active && setError(e.message))
    return () => {
      active = false
    }
    // Reload when the user acts on the list; contracts only feed the mock inbox.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [user, version, isMock ? contracts : null])
  async function open(n: AppNotification) {
    try {
      if (!n.readAt) {
        await inbox.markRead(n.id)
        publishUnread(Math.max(0, (data?.unread ?? 1) - 1))
      }
    } catch {
      /* opening the link matters more than the read flag */
    }
    if (n.link) navigate(n.link)
    else setVersion((v) => v + 1)
  }
  async function readAll() {
    if (!user) return
    try {
      await inbox.markAllRead(user, contracts)
      publishUnread(0)
      setVersion((v) => v + 1)
    } catch (e) {
      setError((e as Error).message)
    }
  }
  return (
    <>
      <PageTitle
        title="Seus avisos"
        description={
          data
            ? `${data.unread} ${data.unread === 1 ? 'não lido' : 'não lidos'}`
            : 'Carregando avisos…'
        }
        action={
          <button
            className="button secondary"
            disabled={!data?.unread}
            onClick={() => void readAll()}
          >
            Marcar todos como lidos
          </button>
        }
      />
      {isMock && <SimulationNotice />}
      <ErrorMessage message={error} />
      <div className="stack">
        {data?.items.map((n) => (
          <article className={`panel notification-row ${n.readAt ? 'read' : 'unread'}`} key={n.id}>
            <Bell size={20} />
            <div>
              <h2>
                {!n.readAt && <span className="unread-dot" aria-label="Não lido" />}
                {n.title}
              </h2>
              {n.body && <p>{n.body}</p>}
              <small>{n.createdAt && dateLabel(n.createdAt)}</small>
              <button className="text-button" onClick={() => void open(n)}>
                {n.link ? 'Ver aviso' : 'Marcar como lido'}
              </button>
            </div>
          </article>
        ))}
        {data && !data.items.length && (
          <Empty title="Nenhum aviso por enquanto">
            <p>Solicitações, propostas, avaliações e mensagens aparecem aqui.</p>
          </Empty>
        )}
      </div>
    </>
  )
}
const CHAT_POLL_MS = 10000
export function Messages() {
  const { contracts, user, reloadContracts } = useApp(),
    [params, setParams] = useSearchParams(),
    [thread, setThread] = useState<ChatMessage[]>([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    reload = useRef(reloadContracts)
  const own = contracts.filter((c) => c.clientId === user?.id || c.freelancerId === user?.id),
    selected = own.find((c) => c.id === params.get('contratacao')) || null,
    closed = !!selected && ['RECUSADO', 'CANCELADO'].includes(selected.status),
    selectedId = selected?.id
  useEffect(() => {
    void reload.current()
  }, [])
  useEffect(() => {
    if (!selectedId) return
    let active = true
    const load = () =>
      inbox
        .messages(selectedId)
        .then((ms) => active && setThread(ms))
        .catch((e: Error) => active && setError(e.message))
    void load()
    const timer = isMock ? undefined : setInterval(load, CHAT_POLL_MS)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [selectedId])
  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!selected || !user) return
    const form = e.currentTarget,
      text = String(new FormData(form).get('message') || '')
    setBusy(true)
    setError('')
    try {
      const m = await inbox.send(user, selected.id, text)
      setThread((ms) => [...ms, m])
      form.reset()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const other = (c: Contract) => (user?.id === c.clientId ? c.freelancerName : c.clientName)
  return (
    <>
      <PageTitle title="Mensagens" description="Converse com quem participa de cada contratação." />
      {isMock && <SimulationNotice />}
      <div className="chat-layout">
        <nav className="conversation-list" aria-label="Conversas">
          {own.map((c) => (
            <a
              key={c.id}
              href={`?contratacao=${c.id}`}
              className={selected?.id === c.id ? 'active' : ''}
              aria-current={selected?.id === c.id ? 'true' : undefined}
              onClick={(e) => {
                e.preventDefault()
                setThread([])
                setParams({ contratacao: c.id })
              }}
            >
              <Avatar name={other(c)} />
              <span>
                <strong>{other(c)}</strong>
                <small>
                  {c.title} · {statusLabel[c.status]}
                </small>
              </span>
            </a>
          ))}
          {!own.length && (
            <Empty title="Nenhuma conversa">
              <p>As conversas começam a partir de uma contratação.</p>
              <Link to="/servicos">Encontrar um serviço</Link>
            </Empty>
          )}
        </nav>
        <section className="panel chat">
          {selected ? (
            <>
              <div className="person">
                <Avatar name={other(selected)} />
                <div>
                  <h2>{other(selected)}</h2>
                  <small>
                    <Link to={`/contratacoes/${selected.id}`}>{selected.title}</Link> ·{' '}
                    {statusLabel[selected.status]}
                  </small>
                </div>
              </div>
              <div className="chat-messages" aria-live="polite">
                {thread.map((m) => (
                  <div key={m.id} className={`bubble ${m.authorId === user?.id ? 'self' : ''}`}>
                    <strong>{m.authorId === user?.id ? 'Você' : m.authorName}</strong>
                    <p>{m.text}</p>
                    <small>{dateLabel(m.at)}</small>
                  </div>
                ))}
                {!thread.length && <p>Nenhuma mensagem ainda. Combine os detalhes por aqui.</p>}
              </div>
              <ErrorMessage message={error} />
              {closed ? (
                <p className="notice">A conversa foi encerrada com esta contratação.</p>
              ) : (
                <form className="row" onSubmit={send}>
                  <input
                    name="message"
                    aria-label="Escrever mensagem"
                    required
                    maxLength={1000}
                    placeholder="Combine os detalhes do serviço…"
                  />
                  <button className="button" disabled={busy}>
                    <Send size={18} />
                    Enviar
                  </button>
                </form>
              )}
            </>
          ) : (
            <p>Escolha uma conversa ao lado.</p>
          )}
        </section>
      </div>
    </>
  )
}
export function Wallet() {
  const { user, contracts } = useApp()
  const own = contracts.filter((c) => c.clientId === user?.id || c.freelancerId === user?.id),
    value = own.filter((c) => c.status === 'CONCLUIDO').reduce((a, c) => a + c.price, 0)
  return (
    <>
      <PageTitle
        title={
          user?.role === 'FREELANCER' ? 'Carteira de demonstração' : 'Pagamentos de demonstração'
        }
        description="Valores ilustrativos. Nenhum dinheiro é movimentado."
        action={
          <button
            className="button secondary"
            onClick={() =>
              exportCsv('extrato-demo.csv', [
                ['Serviço', 'Valor estimado', 'Status'],
                ...own.map((c) => [c.title, String(c.price), statusLabel[c.status]]),
              ])
            }
          >
            Exportar CSV
          </button>
        }
      />
      <SimulationNotice />
      <div className="stats">
        <div>
          <span>Concluídos</span>
          <strong>{money(value)}</strong>
          <small>valor bruto ilustrativo</small>
        </div>
        <div>
          <span>Taxa simulada</span>
          <strong>10%</strong>
          <small>hipótese do protótipo</small>
        </div>
        <div>
          <span>{user?.role === 'FREELANCER' ? 'Repasse ilustrativo' : 'Contratações'}</span>
          <strong>{user?.role === 'FREELANCER' ? money(value * 0.9) : own.length}</strong>
          <small>sem cobrança ou saldo real</small>
        </div>
      </div>
      <div className="row">
        <Link className="button secondary" to="/pagamento">
          Simular pagamento
        </Link>
        {user?.role === 'FREELANCER' && (
          <Link className="button" to="/saque">
            Simular saque
          </Link>
        )}
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Serviço</th>
              <th>Valor</th>
              <th>Status</th>
              <th>Detalhes</th>
            </tr>
          </thead>
          <tbody>
            {own.map((c) => (
              <tr key={c.id}>
                <td>{c.title}</td>
                <td>{money(c.price)}</td>
                <td>{statusLabel[c.status]}</td>
                <td>
                  <Link to="/transacao">Ver simulação</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
export function Payment() {
  const [method, setMethod] = useState('Pix'),
    navigate = useNavigate(),
    { pathname } = useLocation()
  const confirmed = pathname.endsWith('confirmado')
  return (
    <>
      <PageTitle
        title={confirmed ? 'Pagamento simulado' : 'Simular pagamento em custódia'}
        description="Exploração visual do produto futuro. Nenhum pagamento é realizado."
      />
      <SimulationNotice />
      {confirmed ? (
        <div className="form-panel confirmation">
          <CheckCircle2 size={48} />
          <h2>Simulação concluída</h2>
          <p>{money(180)} em custódia fictícia. A contratação real não foi alterada.</p>
          <Link className="button" to="/transacao">
            Ver comprovante ilustrativo
          </Link>
        </div>
      ) : (
        <div className="form-panel">
          <p className="notice">
            Use apenas a demonstração abaixo. Esta página não solicita dados reais de cartão, CPF ou
            chave Pix.
          </p>
          <div className="tabs">
            {['Pix', 'Cartão', 'Boleto'].map((m) => (
              <button
                key={m}
                aria-pressed={method === m}
                className={method === m ? 'active' : ''}
                onClick={() => setMethod(m)}
              >
                {m}
              </button>
            ))}
          </div>
          <section className="payment-preview">
            <ShieldCheck size={40} />
            <h2>{method}</h2>
            <p>
              {method === 'Pix'
                ? 'Um QR Code e um código copia e cola do gateway aparecerão aqui na versão integrada.'
                : method === 'Cartão'
                  ? 'O formulário seguro do gateway aparecerá aqui. Dados de cartão não serão guardados na plataforma.'
                  : 'A linha digitável será gerada pelo gateway na versão integrada.'}
            </p>
          </section>
          <dl className="details">
            <dt>Serviço ilustrativo</dt>
            <dd>Instalação de chuveiro elétrico</dd>
            <dt>Total simulado</dt>
            <dd>{money(180)}</dd>
            <dt>Repasse ilustrativo</dt>
            <dd>{money(162)}</dd>
          </dl>
          <button
            className="button full"
            onClick={() => {
              sessionStorage.setItem('fln-payment-demo', method)
              navigate('/pagamento/confirmado')
            }}
          >
            Simular pagamento
          </button>
        </div>
      )}
    </>
  )
}
export function Transaction() {
  return (
    <>
      <PageTitle
        title="Comprovante ilustrativo"
        description="Transação de demonstração, sem validade financeira."
      />
      <section className="panel">
        <h2>{money(180)} em custódia fictícia</h2>
        <p>Método: {sessionStorage.getItem('fln-payment-demo') || 'Pix'}</p>
        <dl className="details">
          <dt>Valor bruto</dt>
          <dd>{money(180)}</dd>
          <dt>Taxa simulada (10%)</dt>
          <dd>{money(18)}</dd>
          <dt>Repasse ilustrativo</dt>
          <dd>{money(162)}</dd>
        </dl>
        <Link to="/carteira">Voltar ao extrato</Link>
      </section>
    </>
  )
}
export function Withdraw() {
  const { pathname } = useLocation(),
    navigate = useNavigate()
  const sent = pathname.endsWith('enviado')
  return (
    <>
      <PageTitle
        title={sent ? 'Saque simulado' : 'Simular saque'}
        description="Não há saldo real nem envio para banco nesta versão."
      />
      <SimulationNotice />
      <section className="form-panel">
        {sent ? (
          <>
            <CheckCircle2 size={44} />
            <p>Solicitação fictícia registrada. Nenhum valor foi transferido.</p>
            <Link to="/carteira">Voltar à carteira</Link>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              navigate('/saque/enviado')
            }}
          >
            <Field
              label="Valor ilustrativo (R$)"
              type="number"
              min="20"
              max="1000"
              step="0.01"
              required
            />
            <p>Destino fictício: conta de demonstração. Não informe dados bancários.</p>
            <button className="button">Simular solicitação de saque</button>
          </form>
        )}
      </section>
    </>
  )
}
function MockReport() {
  const [params] = useSearchParams(),
    { pathname } = useLocation(),
    navigate = useNavigate()
  const sent = pathname.endsWith('enviada')
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const d = new FormData(e.currentTarget)
    let reports = []
    try {
      reports = JSON.parse(sessionStorage.getItem('fln-reports') || '[]')
    } catch {
      /* reset malformed mock data */
    }
    sessionStorage.setItem(
      'fln-reports',
      JSON.stringify([
        ...reports,
        {
          id: crypto.randomUUID(),
          target: params.get('alvo') || 'Conteúdo da demonstração',
          targetType: params.get('type'),
          targetId: params.get('id'),
          reason: String(d.get('reason')),
          comment: String(d.get('comment')),
          status: 'PENDING',
        },
      ]),
    )
    navigate('/denunciar/enviada')
  }
  return (
    <>
      <PageTitle
        title={sent ? 'Denúncia registrada' : 'Denunciar conteúdo'}
        description="Fila de moderação da demonstração."
      />
      <SimulationNotice />
      <section className="form-panel">
        {sent ? (
          <>
            <CheckCircle2 size={44} />
            <p>
              A denúncia entrou na fila simulada. Um administrador pode analisar o conteúdo no
              painel de demonstração.
            </p>
            <Link to="/inicio">Voltar ao início</Link>
          </>
        ) : (
          <form onSubmit={submit}>
            <p>Conteúdo: {params.get('alvo') || 'Conteúdo da demonstração'}</p>
            <label className="field">
              <span>Motivo *</span>
              <select name="reason" required>
                {[
                  'Conteúdo ofensivo',
                  'Anúncio incorreto',
                  'Avaliação suspeita',
                  'Outro motivo',
                ].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>O que aconteceu? *</span>
              <textarea name="comment" required minLength={40} maxLength={1000} rows={5} />
            </label>
            <button className="button">Enviar denúncia</button>
          </form>
        )}
      </section>
    </>
  )
}
export function Help({ kind = 'help' }: { kind?: string }) {
  return (
    <article className="prose">
      <h1>
        {kind === 'terms'
          ? 'Termos de uso da demonstração'
          : kind === 'privacy'
            ? 'Privacidade na demonstração'
            : 'Como usar o FreeLanceNow'}
      </h1>
      {kind === 'help' ? (
        <>
          <h2>Para clientes</h2>
          <p>
            Busque um serviço, veja o perfil do profissional e envie uma solicitação com data
            futura. Depois do aceite e da execução, confirme ou conteste a entrega.
          </p>
          <h2>Para profissionais</h2>
          <p>
            Publique até 20 serviços ativos. Aceite ou recuse solicitações em até 48 horas. Quando
            terminar, sinalize a conclusão e aguarde a confirmação do cliente.
          </p>
          <h2>Prazos do produto</h2>
          <p>
            48 horas para responder, 5 dias para confirmar a conclusão e 7 dias para avaliar um
            serviço concluído. Sem resposta em 48 horas, a solicitação é cancelada automaticamente;
            sem resposta do cliente em 5 dias, a conclusão é confirmada automaticamente. Cada
            contratação mostra a data-limite da etapa atual.
          </p>
          <h2>Pagamentos</h2>
          <p>
            As telas financeiras usam valores fictícios. Não existe cobrança, custódia ou saque real
            nesta etapa.
          </p>
        </>
      ) : (
        <>
          <p>
            Versão academic-v1, preparada para a demonstração acadêmica do Grupo 2. Este texto é
            provisório e deve ser revisado antes de disponibilizar o produto ao público.
          </p>
          <h2>Uso de dados fictícios</h2>
          <p>
            Utilize as contas de demonstração e evite inserir dados pessoais reais. No modo mock,
            dados são guardados somente nesta sessão do navegador. No modo API, o cadastro é
            persistido no banco local do projeto.
          </p>
          <h2>Finalidade</h2>
          <p>
            Os dados de cadastro permitem demonstrar a autenticação e o vínculo entre usuários e
            serviços. Senhas da API recebem hash bcrypt. Contatos não são expostos nos perfis
            públicos.
          </p>
          <h2>Limites desta versão</h2>
          <p>
            Não há intermediação financeira ou contratação comercial efetiva. O grupo ainda precisa
            definir políticas de retenção, exclusão de dados, suporte e condições comerciais antes
            de um lançamento público.
          </p>
        </>
      )}
      <ErrorMessage message="" />
    </article>
  )
}

export function Report() {
  return isMock ? <MockReport /> : <ApiReport />
}
