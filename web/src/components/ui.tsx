import type { ReactNode, InputHTMLAttributes } from 'react'
import { Link } from 'react-router-dom'
import {
  Zap,
  Droplets,
  Sparkles,
  Monitor,
  Paintbrush,
  MapPin,
  ArrowRight,
  Wrench,
  Star,
} from 'lucide-react'
import type { Review, Service } from '../domain/types'
import { dateLabel, initials, money } from '../domain/rules'
import { isMock } from '../data/client'
import './extras.css'

export function CategoryIcon({ slug, size = 24 }: { slug: string; size?: number }) {
  const Icon =
    (
      {
        eletrica: Zap,
        encanamento: Droplets,
        limpeza: Sparkles,
        ti: Monitor,
        pintura: Paintbrush,
      } as Record<string, typeof Zap>
    )[slug] || Wrench
  return <Icon size={size} aria-hidden="true" />
}
export function Stars({ rating }: { rating: number }) {
  return (
    <span className="stars" role="img" aria-label={`${rating} de 5 estrelas`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={14} className={n <= Math.round(rating) ? 'on' : ''} aria-hidden />
      ))}
    </span>
  )
}
export function ReviewList({
  reviews,
  showService = true,
}: {
  reviews: Review[]
  showService?: boolean
}) {
  if (!reviews.length) return <p>Ainda não há avaliações.</p>
  return reviews.map((r) => (
    <div className="review" key={r.id}>
      <strong>
        <Stars rating={r.rating} /> {r.rating} de 5 · {r.clientName}
      </strong>
      <p>{r.comment || 'Sem comentário.'}</p>
      {r.reply && <p className="review-reply">Resposta do profissional: {r.reply}</p>}
      <small>
        {showService && `${r.serviceTitle} · `}
        {r.createdAt && dateLabel(r.createdAt)}
      </small>
      <Link
        className="subtle-link"
        to={`/denunciar?type=REVIEW&id=${r.id}&alvo=${encodeURIComponent(r.serviceTitle)}`}
      >
        Denunciar avaliação
      </Link>
    </div>
  ))
}
export function Avatar({ name, large = false }: { name: string; large?: boolean }) {
  return (
    <span className={`avatar ${large ? 'large' : ''}`} aria-hidden="true">
      {initials(name)}
    </span>
  )
}
export function Field({
  label,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="field">
      <span>
        {label}
        {props.required && ' *'}
      </span>
      <input {...props} />
      {hint && <small>{hint}</small>}
    </label>
  )
}
export function PageTitle({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="page-title">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  )
}
export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <Wrench size={32} />
      <h2>{title}</h2>
      {children}
    </div>
  )
}
export function ErrorMessage({ message }: { message: string }) {
  return message ? (
    <p role="alert" className="error">
      {message}
    </p>
  ) : null
}
export function SimulationNotice() {
  return !isMock ? (
    <p className="notice">
      Esta área usa dados simulados. Sua integração com a API está prevista no roadmap.
    </p>
  ) : null
}
export function ServiceCard({ service: s }: { service: Service }) {
  return (
    <article className="service-card">
      <div className={`service-visual ${s.category.slug}`}>
        <CategoryIcon slug={s.category.slug} size={48} />
        <span>{s.category.name}</span>
      </div>
      <div className="service-body">
        <small className="category-text">{s.category.name}</small>
        <h3>
          <Link to={`/servicos/${s.id}`}>{s.title}</Link>
        </h3>
        <div className="person">
          <Avatar name={s.freelancer.name} />
          <div>
            <span>
              {s.freelancer.name}
              {typeof s.freelancer.averageRating === 'number' &&
                ` · ★ ${s.freelancer.averageRating.toFixed(1)}`}
            </span>
            <small>
              <MapPin size={12} />
              {s.freelancer.city || 'Localização não informada'}
            </small>
          </div>
        </div>
        <div className="service-price">
          <div>
            <strong>{money(s.price)}</strong>
            <small>
              estimativa · {s.deliveryDays} {s.deliveryDays === 1 ? 'dia' : 'dias'}
            </small>
          </div>
          <Link className="icon-link" aria-label={`Ver ${s.title}`} to={`/servicos/${s.id}`}>
            <ArrowRight size={20} />
          </Link>
        </div>
      </div>
    </article>
  )
}
export function ServiceGrid({ services }: { services: Service[] }) {
  return (
    <div className="service-grid">
      {services.map((s) => (
        <ServiceCard key={s.id} service={s} />
      ))}
    </div>
  )
}
