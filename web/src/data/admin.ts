import { request } from './client'
import type { Category, User } from '../domain/types'
export interface AdminUser extends User {
  active: boolean
  createdAt: string
}
export interface AdminCategory extends Category {
  active: boolean
}
export interface AuditEvent {
  id: string
  actorName: string
  action: string
  targetType: string
  targetId: string
  beforeValue: string
  afterValue: string
  reason: string
  createdAt: string
}
export interface ContentReport {
  id: string
  reporterName: string
  targetType: 'SERVICE' | 'REVIEW' | 'POST'
  targetId: string
  targetTitle: string
  targetContent: string
  reason: string
  comment: string
  status: 'PENDING' | 'KEPT' | 'REMOVED'
  decisionNote?: string
  decidedByName?: string
  createdAt: string
}
export interface CreateReport {
  targetType: 'SERVICE' | 'REVIEW' | 'POST'
  targetId: string
  reason: string
  comment: string
}
export type Metrics = Record<
  'users' | 'services' | 'contracts' | 'reviews' | 'reports' | 'pendingReports' | 'disputes',
  number
>
export const adminApi = {
  users: () => request<AdminUser[]>('/admin/users'),
  status: (id: string, active: boolean, reason: string) =>
    request<AdminUser>(`/admin/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ active, reason }),
    }),
  categories: () => request<AdminCategory[]>('/admin/categories'),
  createCategory: (name: string) =>
    request<AdminCategory>('/admin/categories', { method: 'POST', body: JSON.stringify({ name }) }),
  updateCategory: (c: AdminCategory) =>
    request<AdminCategory>(`/admin/categories/${c.id}`, {
      method: 'PUT',
      body: JSON.stringify({ name: c.name, active: c.active }),
    }),
  reports: () => request<ContentReport[]>('/admin/reports'),
  createReport: (r: CreateReport) =>
    request<ContentReport>('/reports', { method: 'POST', body: JSON.stringify(r) }),
  decide: (id: string, status: 'KEPT' | 'REMOVED', note: string) =>
    request<ContentReport>(`/admin/reports/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, note }),
    }),
  audit: () => request<AuditEvent[]>('/admin/audit'),
  metrics: (from = '', to = '') =>
    request<Metrics>(
      `/admin/metrics?${new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}) })}`,
    ),
}
