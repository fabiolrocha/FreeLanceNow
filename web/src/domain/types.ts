export type Role = 'CLIENT' | 'FREELANCER' | 'ADMIN'
export type ServiceStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE'
export interface Profile {
  id: string
  name: string
  role: Role
  city: string
  bio: string
}
export interface User extends Profile {
  email: string
  phone: string
}
export interface Session {
  accessToken: string
  tokenType: string
  expiresIn: number
  expiresAt?: number
  user: User
}
export interface Category {
  id: string
  name: string
  slug: string
}
export interface Service {
  id: string
  title: string
  description: string
  price: number
  deliveryDays: number
  status: ServiceStatus
  category: Category
  freelancer: Profile
}
export interface SaveService {
  title: string
  description: string
  price: number
  deliveryDays: number
  status: ServiceStatus
  categoryId: string
}
export interface Register {
  name: string
  email: string
  phone: string
  password: string
  role: 'CLIENT' | 'FREELANCER'
  acceptedTerms: boolean
}
export type ContractStatus =
  | 'PENDENTE'
  | 'ACEITO'
  | 'EM_ANDAMENTO'
  | 'AGUARDANDO_CONFIRMACAO'
  | 'CONCLUIDO'
  | 'EM_DISPUTA'
  | 'RECUSADO'
  | 'CANCELADO'
export interface Contract {
  id: string
  serviceId: string
  title: string
  freelancerId: string
  clientId: string
  clientName: string
  freelancerName: string
  price: number
  date: string
  description: string
  address: string
  status: ContractStatus
  history: { status: ContractStatus; at: string }[]
  completedAt?: string
  rating?: number
  review?: string
  dispute?: string
  observations?: string
}
export interface Demand {
  id: string
  clientId: string
  title: string
  description: string
  categoryId: string
  budget: number
  days: number
  city: string
  status: 'OPEN' | 'CLOSED'
}
export interface Proposal {
  id: string
  demandId: string
  freelancerId: string
  freelancerName: string
  price: number
  days: number
  message: string
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED'
}
