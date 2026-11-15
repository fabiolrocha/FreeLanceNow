export type Role = 'CLIENT' | 'FREELANCER' | 'ADMIN'
export type ServiceStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE'
export interface Profile {
  id: string
  name: string
  role: Role
  city: string
  bio: string
  averageRating?: number | null
  reviewCount?: number
  /** Neighbourhoods or cities a freelancer serves. */
  serviceArea?: string
  /** Changes whenever the photo changes; null when the user has no photo. */
  avatarVersion?: number | null
  memberSince?: string
  /** Categories of the freelancer's active listings. */
  specialties?: string[]
}
export interface User extends Profile {
  email: string
  phone: string
  /** False until the link sent at registration is opened; absent (treated as confirmed) in mock mode. */
  emailVerified?: boolean
  /** E-mail copies of important notices; on by default (API only). */
  emailNotifications?: boolean
  createdAt?: string
}
export interface Session {
  accessToken: string
  tokenType: string
  expiresIn: number
  expiresAt?: number
  refreshToken?: string
  refreshExpiresIn?: number
  refreshExpiresAt?: number
  remember?: boolean
  user: User
}
export interface Category {
  id: string
  name: string
  slug: string
}
export interface ServiceImage {
  id: string
  contentType: 'image/jpeg' | 'image/png'
}
export interface Service {
  createdAt?: string
  id: string
  title: string
  description: string
  price: number
  deliveryDays: number
  status: ServiceStatus
  moderated?: boolean
  category: Category
  freelancer: Profile
  images?: ServiceImage[]
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
  serviceId?: string | null
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
  history: {
    status: ContractStatus
    at: string
    comment?: string | null
    /** Null for automatic steps such as deadline expiry. */
    actorRole?: Role | null
  }[]
  completedAt?: string
  rating?: number
  review?: string
  reviewReply?: string
  reviewedAt?: string
  dispute?: string
  observations?: string
}
export interface Review {
  id: string
  contractId: string
  serviceId?: string | null
  serviceTitle: string
  freelancerId: string
  clientId: string
  clientName: string
  rating: number
  comment: string
  reply?: string | null
  repliedAt?: string | null
  createdAt: string
}
export interface CreateContract {
  serviceId: string
  date: string
  description: string
  address: string
}
export interface Demand {
  createdAt?: string
  id: string
  clientId: string
  /** Who published it; shown on the project card like a job board. */
  clientName?: string
  /** Proposals sent so far (withdrawn ones excluded). */
  proposalCount?: number
  title: string
  description: string
  categoryId: string
  budget: number
  days: number
  city: string
  status: DemandStatus
  categoryName?: string
}
export type DemandStatus = 'OPEN' | 'CLOSED' | 'CANCELLED'
export interface CreateDemand {
  title: string
  description: string
  categoryId: string
  budget: number
  days: number
  city: string
}
export type ProposalStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN'
export interface Proposal {
  id: string
  demandId: string
  demandTitle?: string
  demandStatus?: DemandStatus
  freelancerId: string
  freelancerName: string
  freelancerAverageRating?: number | null
  freelancerReviewCount?: number
  freelancerAvatarVersion?: number | null
  price: number
  days: number
  message: string
  status: ProposalStatus
  createdAt?: string
  decidedAt?: string | null
  /** Contract created when the proposal was accepted. */
  contractId?: string | null
}
export interface AcceptProposal {
  date?: string
  address?: string
}
export type ReportStatus = 'PENDING' | 'KEPT' | 'REMOVED'
/** A report as its author sees it: the decision, never who on the team decided. */
export interface OwnReport {
  id: string
  targetType: 'SERVICE' | 'REVIEW' | 'POST'
  targetId: string
  targetTitle: string
  reason: string
  comment: string
  status: ReportStatus
  decisionNote?: string | null
  createdAt: string
  decidedAt?: string | null
}
export interface CreateProposal {
  price: number
  days: number
  message: string
}
export interface ProposalAcceptance {
  demand: Demand
  proposal: Proposal
  contract: Contract
}
