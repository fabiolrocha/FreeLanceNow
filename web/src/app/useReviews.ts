import { useEffect, useState } from 'react'
import { useApp } from './store'
import { client, isMock } from '../data/client'
import type { Review } from '../domain/types'

// Reviews of a freelancer or of one service: the API in api mode, rated contracts in the mock.
export function useReviews(kind: 'freelancer' | 'service', id?: string): Review[] {
  const { contracts } = useApp(),
    [apiReviews, setApiReviews] = useState<Review[]>([])
  useEffect(() => {
    if (isMock || !id) return
    let active = true
    void (kind === 'freelancer' ? client.freelancerReviews(id) : client.serviceReviews(id))
      .then((items) => {
        if (active) setApiReviews(items)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [kind, id])
  if (!isMock) return apiReviews
  return contracts
    .filter((c) => (kind === 'freelancer' ? c.freelancerId : c.serviceId) === id && c.rating)
    .map((c) => ({
      id: c.id,
      contractId: c.id,
      serviceId: c.serviceId,
      serviceTitle: c.title,
      freelancerId: c.freelancerId,
      clientId: c.clientId,
      clientName: c.clientName,
      rating: c.rating!,
      comment: c.review || '',
      reply: c.reviewReply,
      createdAt: c.reviewedAt || c.completedAt || '',
    }))
}
