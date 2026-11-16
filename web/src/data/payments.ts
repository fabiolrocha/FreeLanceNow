import { useEffect, useState } from 'react'
import { isMock, request } from './client'

export type PaymentMethod = 'CARD' | 'PIX' | 'BOLETO'
export type PaymentStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'PAID'
  | 'RELEASED'
  | 'REFUNDED'
  | 'FAILED'
  | 'CANCELED'
  | 'REFUND_FAILED'
  | 'CHARGED_BACK'
export interface Payment {
  id: string
  contractId: string
  contractTitle: string
  clientName: string
  freelancerName: string
  /** STRIPE (sandbox) or SIMULATED (demo history created by the seed). */
  provider: 'STRIPE' | 'SIMULATED'
  method: PaymentMethod
  status: PaymentStatus
  grossAmount: number
  feeAmount: number
  netAmount: number
  createdAt: string
  paidAt?: string | null
  releasedAt?: string | null
  refundedAt?: string | null
  /** When the net amount was sent to the freelancer's Stripe account (API with Stripe). */
  transferredAt?: string | null
  /** Released through Stripe, still waiting for the freelancer's receiving account. */
  transferPending?: boolean
  /** Total given back to the client so far (app or Stripe dashboard). */
  refundedAmount?: number
  /** Chargeback opened by the client at the bank, if any. */
  disputeStatus?: 'OPEN' | 'WON' | 'LOST' | null
}
export interface ContractPayment {
  enabled: boolean
  methods: PaymentMethod[]
  feePercent: number
  payment: Payment | null
}
export interface Withdrawal {
  id: string
  amount: number
  status: 'SIMULATED'
  createdAt: string
}
export interface Wallet {
  enabled: boolean
  feePercent: number
  held: number
  available: number
  released: number
  withdrawn: number
  paid: number
  refunded: number
  /** Already sent to the receiving account (Stripe Connect). */
  transferred?: number
  /** Released, waiting for the receiving account to be ready. */
  awaitingAccount?: number
  payments: Payment[]
  withdrawals: Withdrawal[]
}
export interface LedgerEntry {
  type:
    | 'CHARGE'
    | 'PLATFORM_FEE'
    | 'ESCROW_HOLD'
    | 'PAYOUT_RELEASE'
    | 'REFUND'
    | 'TRANSFER'
    | 'TRANSFER_REVERSAL'
    | 'CHARGEBACK'
    | 'CHARGEBACK_REVERSAL'
  amount: number
  description: string
  at: string
}
export interface AdminPayments {
  received: number
  fees: number
  held: number
  released: number
  refunded: number
  withdrawn: number
  /** Stripe Connect totals (API with Stripe). */
  transferred?: number
  reversed?: number
  inChargeback?: number
  issues?: AdminIssue[]
  payments: Payment[]
}
export type AdminIssueKind =
  'CHARGEBACK_OPEN' | 'REFUND_FAILED' | 'REVERSAL_FAILED' | 'TRANSFER_FAILED' | 'AWAITING_ACCOUNT'
/** A Stripe payment that needs the team. */
export interface AdminIssue {
  paymentId: string
  contractId: string
  kind: AdminIssueKind
  contractTitle: string
  freelancerName: string
  amount: number
  detail?: string | null
  retryable: boolean
}
export const adminIssueLabel: Record<AdminIssueKind, string> = {
  CHARGEBACK_OPEN: 'Contestação aberta no banco',
  REFUND_FAILED: 'Reembolso recusado',
  REVERSAL_FAILED: 'Estorno da transferência não feito',
  TRANSFER_FAILED: 'Transferência recusada',
  AWAITING_ACCOUNT: 'Aguardando conta do profissional',
}
export const adminIssueHint: Record<AdminIssueKind, string> = {
  CHARGEBACK_OPEN: 'Responda pelo painel do Stripe; a transferência espera o resultado.',
  REFUND_FAILED: 'Combine outra forma de devolução com o cliente.',
  REVERSAL_FAILED: 'A plataforma arca com a diferença; registre o acerto com o profissional.',
  TRANSFER_FAILED: 'Tente de novo; o motivo do Stripe aparece abaixo.',
  AWAITING_ACCOUNT: 'O profissional precisa terminar o cadastro da conta de recebimento.',
}

export type PayoutAccountStatus = 'DISABLED' | 'NOT_STARTED' | 'INCOMPLETE' | 'IN_REVIEW' | 'READY'
/** The freelancer's Stripe Connect account; the form and the data live in Stripe. */
export interface PayoutAccount {
  enabled: boolean
  status: PayoutAccountStatus
  transfersEnabled: boolean
  payoutsEnabled: boolean
  currentlyDue: string[]
}
export const payoutAccountLabel: Record<PayoutAccountStatus, string> = {
  DISABLED: 'indisponível neste ambiente',
  NOT_STARTED: 'não cadastrada',
  INCOMPLETE: 'cadastro incompleto',
  IN_REVIEW: 'em análise pelo Stripe',
  READY: 'pronta para receber',
}

export const methodLabel: Record<PaymentMethod, string> = {
  PIX: 'Pix',
  CARD: 'Cartão',
  BOLETO: 'Boleto',
}
export const paymentStatusLabel: Record<PaymentStatus, string> = {
  PENDING: 'Aguardando pagamento',
  PROCESSING: 'Em compensação',
  PAID: 'Pago · em custódia',
  RELEASED: 'Liberado ao profissional',
  REFUNDED: 'Reembolsado',
  FAILED: 'Não confirmado',
  CANCELED: 'Cancelado',
  REFUND_FAILED: 'Reembolso com falha',
  CHARGED_BACK: 'Devolvido pelo banco (contestação)',
}
export const ledgerLabel: Record<LedgerEntry['type'], string> = {
  CHARGE: 'Cobrança',
  PLATFORM_FEE: 'Comissão da plataforma',
  ESCROW_HOLD: 'Custódia',
  PAYOUT_RELEASE: 'Liberação ao profissional',
  REFUND: 'Reembolso',
  TRANSFER: 'Transferência à conta de recebimento',
  TRANSFER_REVERSAL: 'Estorno de transferência',
  CHARGEBACK: 'Contestação no banco',
  CHARGEBACK_REVERSAL: 'Contestação revertida',
}

/**
 * The freelancer's share after a partial refund: the refund lowers it in proportion to the
 * fee split, rounded down to the cent (same rule as the API, ADR34).
 */
export function freelancerShare(p: Payment): number {
  const refunded = p.refundedAmount ?? 0
  if (refunded <= 0 || p.grossAmount <= 0) return p.netAmount
  // Cents, with a small tolerance so float noise (899.9999…) does not lose a cent.
  const lossCents = Math.floor((refunded * p.netAmount * 100) / p.grossAmount + 1e-6)
  return Math.max(0, Math.round(p.netAmount * 100) - lossCents) / 100
}

/** Status text, with the transfer step for payments released through Stripe. */
export function paymentStatusText(p: Payment): string {
  let text = paymentStatusLabel[p.status]
  if (p.status === 'RELEASED' && p.transferredAt) text = 'Transferido à conta de recebimento'
  else if (p.status === 'RELEASED' && p.transferPending)
    text = 'Liberado · aguardando conta de recebimento'
  if ((p.refundedAmount ?? 0) > 0 && p.status !== 'REFUNDED' && p.status !== 'REFUND_FAILED')
    text += ' · reembolso parcial'
  if (p.disputeStatus === 'OPEN') text += ' · contestação aberta no banco'
  return text
}

export const paymentsApi = {
  forContract: (contractId: string) => request<ContractPayment>(`/contracts/${contractId}/payment`),
  checkout: (contractId: string, method: PaymentMethod) =>
    request<{ paymentId: string; checkoutUrl: string }>(`/contracts/${contractId}/payment`, {
      method: 'POST',
      body: JSON.stringify({ method }),
    }),
  detail: (id: string) => request<{ payment: Payment; entries: LedgerEntry[] }>(`/payments/${id}`),
  wallet: () => request<Wallet>('/users/me/wallet'),
  withdraw: (amount: number) =>
    request<Withdrawal>('/users/me/withdrawals', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    }),
  admin: () => request<AdminPayments>('/admin/payments'),
  retryTransfer: (paymentId: string) =>
    request<Payment>(`/admin/payments/${paymentId}/transfer`, { method: 'POST' }),
  resolveReversal: (paymentId: string) =>
    request<void>(`/admin/payments/${paymentId}/reversal-resolved`, { method: 'POST' }),
  payoutAccount: () => request<PayoutAccount>('/users/me/payout-account'),
  payoutSession: () =>
    request<{ clientSecret: string; publishableKey: string }>('/users/me/payout-account/session', {
      method: 'POST',
    }),
}

/**
 * Payment state of one contract, refreshed whenever its status changes. Null in mock mode and
 * while loading; a failed load counts as "payments off" so the contract page keeps working.
 */
export function useContractPayment(contractId: string | undefined, status: string | undefined) {
  const [state, setState] = useState<ContractPayment | null>(null)
  useEffect(() => {
    if (isMock || !contractId) return
    let active = true
    paymentsApi
      .forContract(contractId)
      .then((s) => active && setState(s))
      .catch(
        () => active && setState({ enabled: false, methods: [], feePercent: 0, payment: null }),
      )
    return () => {
      active = false
    }
  }, [contractId, status])
  return state
}
