import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Clock, ShieldCheck } from 'lucide-react'
import { useApp } from '../../app/store'
import { Empty, ErrorMessage, Field, PageTitle } from '../../components/ui'
import { exportCsv } from '../../data/exportCsv'
import {
  adminIssueHint,
  adminIssueLabel,
  freelancerShare,
  ledgerLabel,
  methodLabel,
  paymentStatusText,
  paymentsApi,
} from '../../data/payments'
import type {
  AdminIssue,
  AdminPayments,
  ContractPayment,
  LedgerEntry,
  Payment,
  PaymentMethod,
  Wallet,
} from '../../data/payments'
import { money } from '../../domain/rules'
import { PayoutAccountCard, StripePayouts } from './payout-account'
import type { Contract, Role } from '../../domain/types'

const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('pt-BR') : '—')
/** Date and time in a table cell: each part stays whole, the cell breaks only between them. */
function WhenCell({ iso }: { iso?: string | null }) {
  if (!iso) return <td>—</td>
  const d = new Date(iso)
  return (
    <td className="when">
      <span>{d.toLocaleDateString('pt-BR')}</span> <span>{d.toLocaleTimeString('pt-BR')}</span>
    </td>
  )
}
const simulated = (p: Payment) => (p.provider === 'SIMULATED' ? ' (demonstração)' : '')

/** Payment block on the contract page (API mode). */
export function ContractPaymentBox({
  contract: c,
  state,
  role,
}: {
  contract: Contract
  state: ContractPayment | null
  role?: Role
}) {
  if (!state) return null
  const p = state.payment,
    paid = p && (p.status === 'PAID' || p.status === 'RELEASED')
  if (!state.enabled && !p) return null
  return (
    <div className="notice payment-box">
      <strong>
        <ShieldCheck size={16} aria-hidden /> Pagamento
        {p ? `: ${paymentStatusText(p)}${simulated(p)}` : ''}
      </strong>
      {p && (
        <p>
          {money(p.grossAmount)} via {methodLabel[p.method]}
          {p.status === 'PAID' && ` · profissional recebe ${money(p.netAmount)} após a conclusão`}
          {p.status === 'RELEASED' && ` · ${money(freelancerShare(p))} liberados ao profissional`}
          {(p.refundedAmount ?? 0) > 0 &&
            p.status !== 'REFUNDED' &&
            ` · ${money(p.refundedAmount ?? 0)} reembolsados ao cliente`}
        </p>
      )}
      {p?.disputeStatus === 'OPEN' && (
        <p>
          O cliente contestou este pagamento no banco. Enquanto o banco decide, o valor não é
          transferido ao profissional.
        </p>
      )}
      {p?.status === 'REFUND_FAILED' && (
        <p>O banco recusou o reembolso. A equipe do FreeLanceNow vai resolver com o cliente.</p>
      )}
      {role === 'CLIENT' && c.status === 'ACEITO' && state.enabled && !paid && (
        <>
          {p?.status === 'PROCESSING' ? (
            <p>O boleto ou Pix foi gerado. Assim que o banco confirmar, o serviço pode começar.</p>
          ) : (
            <>
              <p>
                Pague para o profissional iniciar. O valor fica em custódia e só é liberado depois
                que você confirmar a conclusão.
              </p>
              <Link className="button full" to={`/pagamento?contratacao=${c.id}`}>
                Pagar {money(c.price)}
              </Link>
            </>
          )}
        </>
      )}
      {role === 'FREELANCER' && c.status === 'ACEITO' && state.enabled && !paid && (
        <p>O serviço pode ser iniciado depois que o pagamento do cliente for confirmado.</p>
      )}
      {p &&
        ['PAID', 'RELEASED', 'REFUNDED', 'REFUND_FAILED', 'CHARGED_BACK'].includes(p.status) && (
          <Link className="subtle-link" to={`/transacao?id=${p.id}`}>
            Ver comprovante
          </Link>
        )}
    </div>
  )
}

/** Opens Stripe Checkout for an accepted contract, and shows the result after the redirect. */
export function PaymentPage() {
  const [params] = useSearchParams(),
    contractId = params.get('contratacao') || '',
    confirmed = useLocation().pathname.endsWith('confirmado'),
    { contracts, reloadContracts } = useApp(),
    [state, setState] = useState<ContractPayment | null>(null),
    [method, setMethod] = useState<PaymentMethod | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [tries, setTries] = useState(0)
  const c = contracts.find((x) => x.id === contractId)
  useEffect(() => {
    if (contractId && !c) void reloadContracts()
    // Only on open: reloadContracts is recreated by the provider.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId])
  useEffect(() => {
    if (!contractId) return
    let active = true
    paymentsApi
      .forContract(contractId)
      .then((s) => {
        if (!active) return
        setState(s)
        setMethod((m) => m ?? s.methods[0] ?? null)
      })
      .catch((e: Error) => active && setError(e.message))
    return () => {
      active = false
    }
  }, [contractId, tries])
  // After the redirect the webhook may take a few seconds: poll for up to a minute.
  const waiting = confirmed && (!state?.payment || state.payment.status === 'PENDING')
  useEffect(() => {
    if (!waiting || tries >= 20) return
    const t = setTimeout(() => setTries((n) => n + 1), 3000)
    return () => clearTimeout(t)
  }, [waiting, tries])

  if (!contractId)
    return (
      <Empty title="Escolha a contratação">
        <p>O pagamento é feito na página de cada contratação aceita.</p>
        <Link to="/contratacoes">Ver contratações</Link>
      </Empty>
    )
  if (!state) return <Empty title={error || 'Carregando pagamento…'} />
  const p = state.payment

  if (confirmed) {
    return (
      <>
        <PageTitle title="Pagamento" description={c?.title} />
        <div className="form-panel confirmation" role="status">
          {p?.status === 'PAID' || p?.status === 'RELEASED' ? (
            <>
              <CheckCircle2 size={48} />
              <h2>Pagamento confirmado</h2>
              <p>
                {money(p.grossAmount)} em custódia. O profissional já pode iniciar, e o valor só é
                liberado depois que você confirmar a conclusão.
              </p>
            </>
          ) : p?.status === 'PROCESSING' ? (
            <>
              <Clock size={48} />
              <h2>Aguardando compensação</h2>
              <p>
                O {methodLabel[p.method].toLowerCase()} foi gerado. Avisamos você e o profissional
                quando o banco confirmar.
              </p>
            </>
          ) : waiting && tries < 20 ? (
            <>
              <Clock size={48} />
              <h2>Confirmando com o Stripe…</h2>
              <p>Isso costuma levar poucos segundos.</p>
            </>
          ) : (
            <>
              <h2>Ainda não recebemos a confirmação</h2>
              <p>
                Se você concluiu o pagamento, ele aparece na contratação em instantes. Se desistiu,
                nada foi cobrado.
              </p>
            </>
          )}
          <Link className="button" to={`/contratacoes/${contractId}`}>
            Voltar à contratação
          </Link>
        </div>
      </>
    )
  }

  async function start() {
    if (!method) return
    setBusy(true)
    setError('')
    try {
      const { checkoutUrl } = await paymentsApi.checkout(contractId, method)
      window.location.assign(checkoutUrl)
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }
  const gross = p?.grossAmount ?? c?.price ?? 0,
    fee = Math.round(gross * state.feePercent) / 100
  return (
    <>
      <PageTitle
        title="Pagar contratação"
        description={c ? `${c.title} · ${c.freelancerName}` : undefined}
      />
      <ErrorMessage message={error} />
      {!state.enabled ? (
        <section className="panel">
          <h2>Pagamentos indisponíveis</h2>
          <p>Os pagamentos pela plataforma não estão ativos neste ambiente.</p>
          <Link to={`/contratacoes/${contractId}`}>Voltar à contratação</Link>
        </section>
      ) : (
        <div className="form-panel">
          <p className="notice">
            Ambiente de teste do Stripe: nenhum valor real é cobrado. No cartão, use 4242 4242 4242
            4242, qualquer validade futura e qualquer CVC.
          </p>
          <div className="tabs" role="group" aria-label="Forma de pagamento">
            {state.methods.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={method === m}
                className={method === m ? 'active' : ''}
                onClick={() => setMethod(m)}
              >
                {methodLabel[m]}
              </button>
            ))}
          </div>
          <section className="payment-preview">
            <ShieldCheck size={40} aria-hidden />
            <h2>{method ? methodLabel[method] : ''}</h2>
            <p>
              {method === 'PIX'
                ? 'O Stripe mostra o QR Code e o código copia e cola. A confirmação costuma ser imediata.'
                : method === 'BOLETO'
                  ? 'O Stripe gera o boleto. A compensação pode levar até 3 dias úteis; o serviço começa depois dela.'
                  : 'Você digita o cartão na página segura do Stripe. A plataforma não vê nem guarda esses dados.'}
            </p>
          </section>
          <dl className="details">
            <dt>Total</dt>
            <dd>{money(gross)}</dd>
            <dt>Comissão da plataforma ({state.feePercent}%)</dt>
            <dd>{money(fee)}, descontada do profissional</dd>
            <dt>Liberação</dt>
            <dd>Depois que você confirmar a conclusão</dd>
          </dl>
          <button className="button full" disabled={busy || !method} onClick={() => void start()}>
            {busy ? 'Abrindo o Stripe…' : 'Ir para o pagamento seguro'}
          </button>
          <Link className="subtle-link" to={`/contratacoes/${contractId}`}>
            Voltar sem pagar
          </Link>
        </div>
      )}
    </>
  )
}

function PaymentsTable({ items, role }: { items: Payment[]; role?: Role }) {
  if (!items.length) return <Empty title="Nenhum pagamento ainda" />
  return (
    <div className="table-wrap wide">
      <table>
        <thead>
          <tr>
            <th>Serviço</th>
            <th>
              {role === 'FREELANCER' ? 'Cliente' : role === 'CLIENT' ? 'Profissional' : 'Partes'}
            </th>
            <th>Valor</th>
            <th>Status</th>
            <th>Data</th>
            <th>Detalhes</th>
          </tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.id}>
              <td>{p.contractTitle}</td>
              <td>
                {role === 'FREELANCER'
                  ? p.clientName
                  : role === 'CLIENT'
                    ? p.freelancerName
                    : `${p.clientName} → ${p.freelancerName}`}
              </td>
              <td className="nowrap">
                {money(role === 'FREELANCER' ? freelancerShare(p) : p.grossAmount)}
              </td>
              <td>
                {paymentStatusText(p)}
                {simulated(p)}
              </td>
              <WhenCell iso={p.paidAt || p.createdAt} />
              <td className="nowrap">
                <Link to={`/transacao?id=${p.id}`}>Comprovante</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const csvRows = (items: Payment[]) => [
  [
    'Serviço',
    'Cliente',
    'Profissional',
    'Método',
    'Status',
    'Bruto',
    'Comissão',
    'Líquido',
    'Data',
  ],
  ...items.map((p) => [
    p.contractTitle,
    p.clientName,
    p.freelancerName,
    methodLabel[p.method],
    paymentStatusText(p) + simulated(p),
    p.grossAmount.toFixed(2),
    p.feeAmount.toFixed(2),
    p.netAmount.toFixed(2),
    p.paidAt || p.createdAt,
  ]),
]

export function WalletPage() {
  const { user } = useApp(),
    [data, setData] = useState<Wallet | null>(null),
    [error, setError] = useState('')
  useEffect(() => {
    let active = true
    paymentsApi
      .wallet()
      .then((w) => active && setData(w))
      .catch((e: Error) => active && setError(e.message))
    return () => {
      active = false
    }
  }, [])
  const freelancer = user?.role === 'FREELANCER'
  if (!data) return <Empty title={error || 'Carregando carteira…'} />
  return (
    <>
      <PageTitle
        title={freelancer ? 'Carteira' : 'Pagamentos'}
        description={
          freelancer
            ? `Valores recebidos pelos serviços, já sem a comissão de ${data.feePercent}%.`
            : 'Pagamentos das suas contratações. O valor fica em custódia até você confirmar a conclusão.'
        }
        action={
          <button
            className="button secondary"
            onClick={() => exportCsv('pagamentos.csv', csvRows(data.payments))}
          >
            Exportar CSV
          </button>
        }
      />
      {!data.enabled && (
        <p className="notice">
          Pagamentos pelo Stripe não estão ativos neste ambiente. Os itens marcados como
          demonstração foram criados pelos dados de exemplo.
        </p>
      )}
      <div className="stats">
        {freelancer ? (
          <>
            {data.enabled && data.transferred !== undefined ? (
              data.available > 0 && (
                <div>
                  <span>Saldo de demonstração</span>
                  <strong>{money(data.available)}</strong>
                  <small>pagamentos de exemplo</small>
                </div>
              )
            ) : (
              <div>
                <span>Disponível</span>
                <strong>{money(data.available)}</strong>
                <small>liberado e ainda não sacado</small>
              </div>
            )}
            <div>
              <span>Em custódia</span>
              <strong>{money(data.held)}</strong>
              <small>libera na conclusão</small>
            </div>
            {data.enabled && data.transferred !== undefined ? (
              <>
                <div>
                  <span>Na conta de recebimento</span>
                  <strong>{money(data.transferred)}</strong>
                  <small>transferido pelo Stripe</small>
                </div>
                {(data.awaitingAccount ?? 0) > 0 && (
                  <div>
                    <span>Aguardando conta</span>
                    <strong>{money(data.awaitingAccount ?? 0)}</strong>
                    <small>cadastre a conta de recebimento</small>
                  </div>
                )}
              </>
            ) : (
              <div>
                <span>Sacado</span>
                <strong>{money(data.withdrawn)}</strong>
                <small>saques simulados</small>
              </div>
            )}
          </>
        ) : (
          <>
            <div>
              <span>Pago</span>
              <strong>{money(data.paid)}</strong>
              <small>sem contar reembolsos</small>
            </div>
            <div>
              <span>Em custódia</span>
              <strong>{money(data.held)}</strong>
              <small>aguardando sua confirmação</small>
            </div>
            <div>
              <span>Reembolsado</span>
              <strong>{money(data.refunded)}</strong>
              <small>cancelamentos e disputas</small>
            </div>
          </>
        )}
      </div>
      {freelancer && <PayoutAccountCard />}
      {freelancer && (
        <div className="row wallet-actions">
          <Link className="button" to="/saque">
            {data.enabled ? 'Ver saques' : 'Solicitar saque'}
          </Link>
        </div>
      )}
      <h2>Histórico</h2>
      <PaymentsTable items={data.payments} role={user?.role} />
      {freelancer && data.withdrawals.length > 0 && (
        <>
          <h2>Saques</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Valor</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {data.withdrawals.map((w) => (
                  <tr key={w.id}>
                    <WhenCell iso={w.createdAt} />
                    <td className="nowrap">{money(w.amount)}</td>
                    <td>Simulado, sem transferência</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  )
}

export function TransactionPage() {
  const [params] = useSearchParams(),
    id = params.get('id') || '',
    [data, setData] = useState<{ payment: Payment; entries: LedgerEntry[] } | null>(null),
    [error, setError] = useState('')
  useEffect(() => {
    if (!id) return
    let active = true
    paymentsApi
      .detail(id)
      .then((d) => active && setData(d))
      .catch((e: Error) => active && setError(e.message))
    return () => {
      active = false
    }
  }, [id])
  if (!id)
    return (
      <Empty title="Escolha um pagamento">
        <Link to="/carteira">Ver histórico</Link>
      </Empty>
    )
  if (!data) return <Empty title={error || 'Carregando comprovante…'} />
  const p = data.payment
  return (
    <>
      <PageTitle
        title="Comprovante"
        description={`${p.contractTitle} · ${p.clientName} → ${p.freelancerName}`}
      />
      <section className="panel">
        <h2>
          {money(p.grossAmount)} · {paymentStatusText(p)}
          {simulated(p)}
        </h2>
        <dl className="details">
          <dt>Forma de pagamento</dt>
          <dd>{methodLabel[p.method]}</dd>
          <dt>Valor bruto</dt>
          <dd>{money(p.grossAmount)}</dd>
          <dt>Comissão da plataforma</dt>
          <dd>{money(p.feeAmount)}</dd>
          <dt>Valor do profissional</dt>
          <dd>{money(p.netAmount)}</dd>
          <dt>Pago em</dt>
          <dd>{when(p.paidAt)}</dd>
          {p.releasedAt && (
            <>
              <dt>Liberado em</dt>
              <dd>{when(p.releasedAt)}</dd>
            </>
          )}
          {p.refundedAt && (
            <>
              <dt>Reembolsado em</dt>
              <dd>{when(p.refundedAt)}</dd>
            </>
          )}
          <dt>Código</dt>
          <dd>{p.id.slice(0, 8)}</dd>
        </dl>
        <h2>Lançamentos</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Tipo</th>
                <th>Descrição</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map((e, i) => (
                <tr key={i}>
                  <WhenCell iso={e.at} />
                  <td>{ledgerLabel[e.type]}</td>
                  <td>{e.description}</td>
                  <td className="nowrap">{money(e.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Link to={`/contratacoes/${p.contractId}`}>Ver contratação</Link>
      </section>
    </>
  )
}

export function WithdrawPage() {
  const sent = useLocation().pathname.endsWith('enviado'),
    navigate = useNavigate(),
    [wallet, setWallet] = useState<Wallet | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  useEffect(() => {
    let active = true
    paymentsApi
      .wallet()
      .then((w) => active && setWallet(w))
      .catch((e: Error) => active && setError(e.message))
    return () => {
      active = false
    }
  }, [sent])
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const amount = Number(new FormData(e.currentTarget).get('amount'))
    setBusy(true)
    setError('')
    try {
      await paymentsApi.withdraw(amount)
      navigate('/saque/enviado')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const stripe = !!wallet?.enabled
  // With Stripe, the simulated form only spends demo money (payments created by the seed).
  const showDemoWithdrawal = !stripe || (wallet?.available ?? 0) >= 1 || sent
  return (
    <>
      <PageTitle
        title={sent ? 'Saque registrado' : 'Saque'}
        description={
          stripe
            ? 'O valor dos serviços vai para a sua conta de recebimento, e o Stripe deposita na sua conta bancária automaticamente, no calendário que você escolher.'
            : 'Saque simulado: o saldo diminui, mas nenhum valor é transferido para banco ou Pix.'
        }
      />
      <ErrorMessage message={error} />
      {stripe && !sent && <StripePayouts />}
      {stripe && showDemoWithdrawal && !sent && (
        <>
          <h2>Saldo de demonstração</h2>
          <p>
            Pagamentos de exemplo, criados pelos dados de demonstração. O saque deles é simulado:
            nenhum valor sai do Stripe.
          </p>
        </>
      )}
      {showDemoWithdrawal && (
        <section className="form-panel">
          {sent ? (
            <div className="confirmation" role="status">
              <CheckCircle2 size={44} />
              <p>
                Saque registrado. Saldo disponível agora: {wallet ? money(wallet.available) : '…'}.
              </p>
              <Link to="/carteira">Voltar à carteira</Link>
            </div>
          ) : !wallet ? (
            <p>Carregando saldo…</p>
          ) : wallet.available < 1 ? (
            <>
              <p>
                Você ainda não tem saldo disponível. Ele aparece quando um cliente confirma a
                conclusão.
              </p>
              <Link to="/carteira">Voltar à carteira</Link>
            </>
          ) : (
            <form onSubmit={(e) => void submit(e)}>
              <p>Disponível: {money(wallet.available)}</p>
              <Field
                label="Valor (R$)"
                name="amount"
                type="number"
                min="1"
                max={wallet.available.toFixed(2)}
                step="0.01"
                defaultValue={wallet.available.toFixed(2)}
                required
              />
              <p className="notice">
                Não informe dados bancários: esta versão não transfere dinheiro.
              </p>
              <button className="button" disabled={busy}>
                {busy ? 'Registrando…' : 'Registrar saque simulado'}
              </button>
            </form>
          )}
        </section>
      )}
    </>
  )
}

export function AdminTransactionsPage() {
  const [data, setData] = useState<AdminPayments | null>(null),
    [error, setError] = useState(''),
    [version, setVersion] = useState(0)
  useEffect(() => {
    let active = true
    paymentsApi
      .admin()
      .then((d) => active && setData(d))
      .catch((e: Error) => active && setError(e.message))
    return () => {
      active = false
    }
  }, [version])
  if (!data) return <Empty title={error || 'Carregando transações…'} />
  return (
    <>
      <PageTitle
        title="Transações e custódia"
        description="Pagamentos pelo Stripe (ambiente de teste) e o histórico de demonstração."
        action={
          <button
            className="button secondary"
            onClick={() => exportCsv('transacoes.csv', csvRows(data.payments))}
          >
            Exportar CSV
          </button>
        }
      />
      <div className="stats">
        <div>
          <span>Recebido</span>
          <strong>{money(data.received)}</strong>
          <small>todas as cobranças</small>
        </div>
        <div>
          <span>Em custódia</span>
          <strong>{money(data.held)}</strong>
          <small>aguardando conclusão</small>
        </div>
        <div>
          <span>Comissões</span>
          <strong>{money(data.fees)}</strong>
          <small>de pagamentos não reembolsados</small>
        </div>
        <div>
          <span>Liberado</span>
          <strong>{money(data.released)}</strong>
          <small>aos profissionais</small>
        </div>
        <div>
          <span>Reembolsado</span>
          <strong>{money(data.refunded)}</strong>
          <small>aos clientes</small>
        </div>
        <div>
          <span>Sacado</span>
          <strong>{money(data.withdrawn)}</strong>
          <small>saques simulados</small>
        </div>
        {data.transferred !== undefined && (
          <>
            <div>
              <span>Transferido</span>
              <strong>{money(data.transferred)}</strong>
              <small>às contas de recebimento</small>
            </div>
            <div>
              <span>Estornado</span>
              <strong>{money(data.reversed ?? 0)}</strong>
              <small>de volta dos profissionais</small>
            </div>
            <div>
              <span>Em contestação</span>
              <strong>{money(data.inChargeback ?? 0)}</strong>
              <small>chargebacks abertos</small>
            </div>
          </>
        )}
      </div>
      {data.issues && <AdminIssues items={data.issues} onChange={() => setVersion((v) => v + 1)} />}
      <h2>Pagamentos</h2>
      <PaymentsTable items={data.payments} />
    </>
  )
}

/** Stripe payments that need the team, with a retry for transfers. */
function AdminIssues({ items, onChange }: { items: AdminIssue[]; onChange: () => void }) {
  const [busy, setBusy] = useState(''),
    [message, setMessage] = useState('')
  async function act(id: string, work: () => Promise<unknown>, done: string) {
    setBusy(id)
    setMessage('')
    try {
      await work()
      setMessage(done)
      onChange()
    } catch (e) {
      setMessage((e as Error).message)
    } finally {
      setBusy('')
    }
  }
  return (
    <>
      <h2>Pendências</h2>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {items.length === 0 ? (
        <p>Nenhuma pendência nos pagamentos pelo Stripe.</p>
      ) : (
        <div className="table-wrap wide">
          <table>
            <thead>
              <tr>
                <th>Situação</th>
                <th>Contratação</th>
                <th>Profissional</th>
                <th>Valor</th>
                <th>O que fazer</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={`${i.paymentId}-${i.kind}`}>
                  <td>{adminIssueLabel[i.kind]}</td>
                  <td>
                    <Link to={`/contratacoes/${i.contractId}`}>{i.contractTitle}</Link>
                  </td>
                  <td>{i.freelancerName}</td>
                  <td className="nowrap">{money(i.amount)}</td>
                  <td>
                    {adminIssueHint[i.kind]}
                    {i.detail && <small className="block">{i.detail}</small>}
                    {i.retryable && (
                      <button
                        className="button secondary"
                        disabled={busy === i.paymentId}
                        onClick={() =>
                          void act(
                            i.paymentId,
                            () => paymentsApi.retryTransfer(i.paymentId),
                            'Transferência feita.',
                          )
                        }
                      >
                        {busy === i.paymentId ? 'Tentando…' : 'Tentar transferir'}
                      </button>
                    )}
                    {i.kind === 'REVERSAL_FAILED' && (
                      <button
                        className="button secondary"
                        disabled={busy === i.paymentId}
                        onClick={() =>
                          void act(
                            i.paymentId,
                            () => paymentsApi.resolveReversal(i.paymentId),
                            'Pendência encerrada.',
                          )
                        }
                      >
                        Marcar como resolvido
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
