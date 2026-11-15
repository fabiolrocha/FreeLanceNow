import { useEffect, useState } from 'react'
import { isMock, request } from './client'

export type PaymentMethod = 'CARD' | 'PIX' | 'BOLETO'
export type PaymentStatus =
  'PENDING' | 'PROCESSING' | 'PAID' | 'RELEASED' | 'REFUNDED' | 'FAILED' | 'CANCELED'
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
  payments: Payment[]
  withdrawals: Withdrawal[]
}
export interface LedgerEntry {
  type: 'CHARGE' | 'PLATFORM_FEE' | 'ESCROW_HOLD' | 'PAYOUT_RELEASE' | 'REFUND'
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
  payments: Payment[]
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
}
export const ledgerLabel: Record<LedgerEntry['type'], string> = {
  CHARGE: 'Cobrança',
  PLATFORM_FEE: 'Comissão da plataforma',
  ESCROW_HOLD: 'Custódia',
  PAYOUT_RELEASE: 'Liberação ao profissional',
  REFUND: 'Reembolso',
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
