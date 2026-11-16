import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { loadConnectAndInitialize } from '@stripe/connect-js'
import type { StripeConnectInstance } from '@stripe/connect-js'
import {
  ConnectAccountManagement,
  ConnectAccountOnboarding,
  ConnectComponentsProvider,
  ConnectNotificationBanner,
  ConnectPayouts,
} from '@stripe/react-connect-js'
import { CheckCircle2, Clock, Landmark } from 'lucide-react'
import { isMock } from '../../data/client'
import { payoutAccountLabel, paymentsApi } from '../../data/payments'
import type { PayoutAccount } from '../../data/payments'
import { Empty, ErrorMessage, PageTitle } from '../../components/ui'

/** Same colours and font as the app, so Stripe's form looks like part of it. */
const appearance = {
  variables: {
    colorPrimary: '#137a45',
    colorText: '#1c2a21',
    colorSecondaryText: '#56685c',
    colorBorder: '#bdd0c2',
    borderRadius: '8px',
    fontFamily: 'inherit',
  },
}

/** Loads the receiving account state; `reload` asks the API again (it refreshes from Stripe). */
function usePayoutAccount() {
  const [state, setState] = useState<PayoutAccount | null>(null),
    [error, setError] = useState('')
  const reload = useCallback(() => {
    if (isMock) return
    paymentsApi
      .payoutAccount()
      .then((a) => {
        setState(a)
        setError('')
      })
      .catch((e: Error) => setError(e.message))
  }, [])
  useEffect(reload, [reload])
  return { state, error, reload }
}

/**
 * Stripe Connect instance for the logged freelancer. The first session also brings the
 * publishable key; later sessions (Stripe asks for a new one when it expires) only the secret.
 */
function useConnectInstance(enabled: boolean) {
  const [instance, setInstance] = useState<StripeConnectInstance | null>(null),
    [error, setError] = useState('')
  useEffect(() => {
    if (!enabled) return
    let active = true
    paymentsApi
      .payoutSession()
      .then(({ clientSecret, publishableKey }) => {
        if (!active) return
        let first: string | null = clientSecret
        setInstance(
          loadConnectAndInitialize({
            publishableKey,
            fetchClientSecret: async () => {
              if (first) {
                const s = first
                first = null
                return s
              }
              return (await paymentsApi.payoutSession()).clientSecret
            },
            appearance,
            locale: 'pt-BR',
          }),
        )
      })
      .catch((e: Error) => active && setError(e.message))
    return () => {
      active = false
    }
  }, [enabled])
  return { instance, error }
}

type LoaderProps = {
  onLoaderStart: () => void
  onLoadError: ({ error }: { error: { message?: string } }) => void
}

/**
 * Box around a Stripe component. Stripe's frame stays blank until its script arrives, so a
 * short message fills the box until Stripe shows its own loader; a load failure is shown here.
 */
function ConnectFrame({
  label,
  render,
}: {
  label: string
  render: (props: LoaderProps) => ReactNode
}) {
  const [started, setStarted] = useState(false),
    [failure, setFailure] = useState('')
  const props = useMemo<LoaderProps>(
    () => ({
      onLoaderStart: () => setStarted(true),
      onLoadError: ({ error }) =>
        setFailure(error.message || 'Não foi possível carregar o Stripe. Recarregue a página.'),
    }),
    [],
  )
  return (
    <div className="connect-frame" aria-busy={!started}>
      {failure && <ErrorMessage message={failure} />}
      {!started && !failure && <p className="connect-loading">{label}</p>}
      {render(props)}
    </div>
  )
}

const statusIcon = (s: PayoutAccount['status']) =>
  s === 'READY' ? (
    <CheckCircle2 aria-hidden />
  ) : s === 'IN_REVIEW' ? (
    <Clock aria-hidden />
  ) : (
    <Landmark aria-hidden />
  )

/** While Stripe reviews the data the freelancer has nothing to fill, so there is no form. */
const IN_REVIEW_TEXT =
  'O Stripe está conferindo os seus dados. Você não precisa fazer nada agora: volte mais tarde para ver a situação. Os valores liberados ficam guardados até a conta ficar pronta.'

/** Link to the receiving account page, or none while Stripe reviews the data. */
function AccountLink({ status }: { status: PayoutAccount['status'] }) {
  if (status === 'IN_REVIEW') return null
  const ready = status === 'READY'
  return (
    <Link className={ready ? 'button secondary' : 'button'} to="/conta-recebimento">
      {status === 'NOT_STARTED'
        ? 'Cadastrar conta'
        : ready
          ? 'Gerenciar conta'
          : 'Continuar cadastro'}
    </Link>
  )
}

/** Short card for the wallet: where the freelancer's money goes and what is missing. */
export function PayoutAccountCard() {
  const { state } = usePayoutAccount()
  if (isMock || !state || !state.enabled) return null
  const ready = state.status === 'READY'
  return (
    <section
      className={`notice payout-card${ready ? ' ok' : ''}`}
      aria-label="Conta de recebimento"
    >
      {statusIcon(state.status)}
      <div>
        <strong>Conta de recebimento: {payoutAccountLabel[state.status]}</strong>
        <p>
          {ready
            ? 'Os valores liberados vão para esta conta, e o Stripe deposita na sua conta bancária automaticamente.'
            : state.status === 'IN_REVIEW'
              ? IN_REVIEW_TEXT
              : 'Cadastre onde quer receber. Valores liberados antes disso ficam guardados e são transferidos assim que a conta estiver pronta.'}
        </p>
      </div>
      <AccountLink status={state.status} />
    </section>
  )
}

/**
 * Payouts of the receiving account (Stripe's component): balance, next deposits and history.
 * In Brazil Stripe deposits automatically; the freelancer can change the schedule here.
 */
export function StripePayouts() {
  const { state, error } = usePayoutAccount()
  const ready = state?.status === 'READY'
  const { instance, error: sessionError } = useConnectInstance(!isMock && ready)
  if (isMock || (state && !state.enabled)) return null
  if (!state) return error ? <ErrorMessage message={error} /> : <Empty title="Carregando…" />
  if (!ready)
    return (
      <section className="notice payout-card" aria-label="Conta de recebimento">
        {statusIcon(state.status)}
        <div>
          <strong>Conta de recebimento: {payoutAccountLabel[state.status]}</strong>
          <p>
            {state.status === 'IN_REVIEW'
              ? IN_REVIEW_TEXT
              : 'Para sacar, termine o cadastro da conta de recebimento. Os valores liberados ficam guardados até lá.'}
          </p>
        </div>
        <AccountLink status={state.status} />
      </section>
    )
  return (
    <>
      {sessionError && <ErrorMessage message={sessionError} />}
      {!instance && !sessionError && <Empty title="Abrindo seus saques no Stripe…" />}
      {instance && (
        <ConnectComponentsProvider connectInstance={instance}>
          <ConnectNotificationBanner />
          <ConnectFrame label="Carregando seus saques…" render={(p) => <ConnectPayouts {...p} />} />
        </ConnectComponentsProvider>
      )}
    </>
  )
}

/**
 * Receiving account page: Stripe's onboarding (or account management) inside the app. Only one
 * Stripe form is shown at a time: the notification banner opens its own copy of the onboarding,
 * so it appears only once the account is ready. While Stripe reviews the data there is no form.
 */
export function PayoutAccountPage() {
  const { state, error, reload } = usePayoutAccount()
  const inReview = state?.status === 'IN_REVIEW'
  const enabled = !isMock && !!state?.enabled && !inReview
  const { instance, error: sessionError } = useConnectInstance(enabled)
  const ready = state?.status === 'READY'
  const title = useMemo(
    () => (
      <PageTitle
        title="Conta de recebimento"
        description="Onde você recebe os valores dos serviços concluídos. O cadastro é do Stripe, nosso parceiro de pagamentos: seus documentos e dados bancários ficam com ele, não com o FreeLanceNow."
      />
    ),
    [],
  )

  if (isMock)
    return (
      <>
        {title}
        <p className="notice">
          No modo de demonstração não há cadastro real. Com a API e o Stripe em modo de teste, o
          formulário do Stripe aparece aqui.
        </p>
        <Link to="/carteira">Voltar à carteira</Link>
      </>
    )
  if (!state) return error ? <ErrorMessage message={error} /> : <Empty title="Carregando…" />
  if (!state.enabled)
    return (
      <>
        {title}
        <p className="notice">Pagamentos pelo Stripe não estão ativos neste ambiente.</p>
        <Link to="/carteira">Voltar à carteira</Link>
      </>
    )

  return (
    <>
      {title}
      <p className={`notice payout-status${ready ? ' ok' : ''}`} role="status">
        {statusIcon(state.status)} Situação: <strong>{payoutAccountLabel[state.status]}</strong>
      </p>
      {inReview && <p>{IN_REVIEW_TEXT}</p>}
      {sessionError && <ErrorMessage message={sessionError} />}
      {enabled && !instance && !sessionError && <Empty title="Abrindo o cadastro do Stripe…" />}
      {enabled && instance && (
        <ConnectComponentsProvider connectInstance={instance}>
          {ready && <ConnectNotificationBanner />}
          <ConnectFrame
            label="Carregando o formulário do Stripe…"
            render={(p) =>
              ready ? (
                <ConnectAccountManagement {...p} />
              ) : (
                <ConnectAccountOnboarding onExit={reload} {...p} />
              )
            }
          />
        </ConnectComponentsProvider>
      )}
      <p>
        <Link to="/carteira">Voltar à carteira</Link>
      </p>
    </>
  )
}
