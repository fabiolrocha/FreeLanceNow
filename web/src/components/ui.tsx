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
} from 'lucide-react'
import type { Service } from '../domain/types'
import { initials, money } from '../domain/rules'
import { isMock } from '../data/client'

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
            <span>{s.freelancer.name}</span>
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
