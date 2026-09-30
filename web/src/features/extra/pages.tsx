import { useState } from 'react'
import { exportCsv } from '../../data/exportCsv'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Bell, Send, ShieldCheck } from 'lucide-react'
import { useApp } from '../../app/store'
import { Avatar, ErrorMessage, Field, PageTitle, SimulationNotice } from '../../components/ui'
import { money, statusLabel } from '../../domain/rules'

export function Notifications() {
  const { contracts, user } = useApp(),
    [read, setRead] = useState<string[]>([])
  const own = contracts.filter((c) => c.clientId === user?.id || c.freelancerId === user?.id)
  return (
    <>
      <PageTitle
        title="Seus avisos"
        description={`${own.filter((c) => !read.includes(c.id)).length} não lidos na demonstração`}
        action={
          <button className="button secondary" onClick={() => setRead(own.map((c) => c.id))}>
            Marcar todos como lidos
          </button>
        }
      />
      <SimulationNotice />
      <div className="stack">
        {own.map((c) => (
          <article
            className={`panel notification-row ${read.includes(c.id) ? 'read' : ''}`}
            key={c.id}
          >
            <Bell size={20} />
            <div>
              <h2>{c.title}</h2>
              <p>Status: {statusLabel[c.status]}</p>
              <Link onClick={() => setRead((rs) => [...rs, c.id])} to={`/contratacoes/${c.id}`}>
                Ver contratação
              </Link>
            </div>
          </article>
        ))}
      </div>
    </>
  )
}
export function Messages() {
  const [messages, setMessages] = useState([
      {
        author: 'Marcos Vieira',
        text: 'Olá! Já tem o chuveiro comprado? Posso conferir o ponto elétrico durante a visita.',
      },
    ]),
    { user } = useApp()
  function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const d = new FormData(e.currentTarget),
      text = String(d.get('message')).trim()
    if (!text) return
    setMessages((ms) => [...ms, { author: user?.name || 'Você', text }])
    e.currentTarget.reset()
  }
  return (
    <>
      <PageTitle
        title="Mensagens"
        description="Conversa de demonstração. O envio em tempo real será integrado depois."
      />
      <SimulationNotice />
      <section className="panel chat">
        <div className="person">
          <Avatar name="Marcos Vieira" />
          <div>
            <h2>Marcos Vieira</h2>
            <small>Eletricista · conta fictícia</small>
          </div>
        </div>
        <div className="chat-messages">
          {messages.map((m, i) => (
            <div key={i} className={`bubble ${m.author === user?.name ? 'self' : ''}`}>
              <strong>{m.author}</strong>
              <p>{m.text}</p>
            </div>
          ))}
        </div>
        <form className="row" onSubmit={send}>
          <input
            name="message"
            aria-label="Escrever mensagem"
            required
            maxLength={1000}
            placeholder="Combine os detalhes do serviço…"
          />
          <button className="button">
            <Send size={18} />
            Enviar
          </button>
        </form>
      </section>
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
export function Report() {
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
            serviço concluído. As rotinas automáticas de prazo ainda serão implementadas.
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
