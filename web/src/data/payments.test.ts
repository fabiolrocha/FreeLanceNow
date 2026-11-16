import { describe, expect, it } from 'vitest'
import { freelancerShare, paymentStatusText } from './payments'
import type { Payment } from './payments'

const payment = (over: Partial<Payment> = {}): Payment => ({
  id: 'p1',
  contractId: 'c1',
  contractTitle: 'Troca de tomada',
  clientName: 'Cliente',
  freelancerName: 'Profissional',
  provider: 'STRIPE',
  method: 'CARD',
  status: 'RELEASED',
  grossAmount: 90,
  feeAmount: 9,
  netAmount: 81,
  createdAt: '2026-11-16T07:53:59Z',
  ...over,
})

describe('freelancerShare', () => {
  it('is the net amount without refunds', () => {
    expect(freelancerShare(payment())).toBe(81)
  })

  it('drops in proportion to a partial refund', () => {
    // R$ 10 of R$ 90 refunded: the freelancer loses 10 × 81 / 90 = R$ 9.
    expect(freelancerShare(payment({ refundedAmount: 10 }))).toBe(72)
  })

  it('rounds the loss down to the cent, like the API', () => {
    // 1 × 81 / 90 = 0.9; 0.07 × 81 / 90 = 0.063 → loses R$ 0.06.
    expect(freelancerShare(payment({ refundedAmount: 1 }))).toBe(80.1)
    expect(freelancerShare(payment({ refundedAmount: 0.07 }))).toBe(80.94)
  })

  it('never goes below zero', () => {
    expect(freelancerShare(payment({ refundedAmount: 90 }))).toBe(0)
  })
})

describe('paymentStatusText', () => {
  it('marks a released payment waiting for the receiving account', () => {
    expect(paymentStatusText(payment({ transferPending: true, refundedAmount: 10 }))).toBe(
      'Liberado · aguardando conta de recebimento · reembolso parcial',
    )
  })

  it('marks an open chargeback', () => {
    expect(paymentStatusText(payment({ status: 'PAID', disputeStatus: 'OPEN' }))).toContain(
      'contestação aberta no banco',
    )
  })
})
