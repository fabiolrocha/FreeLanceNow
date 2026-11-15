import { Heart } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useApp } from '../app/store'
import { useFavorites } from '../data/favorites'
import type { Service } from '../domain/types'

/**
 * Saves a listing for later. Clients toggle it; visitors are sent to sign in first; freelancers
 * and admins do not see it.
 */
export function FavoriteButton({ service, wide = false }: { service: Service; wide?: boolean }) {
  const { user, notify } = useApp(),
    { pathname } = useLocation(),
    { ids, toggle } = useFavorites(user?.role === 'CLIENT' ? user.id : undefined)
  const className = `favorite-button ${wide ? 'wide' : ''}`
  if (!user)
    return (
      <Link
        className={className}
        to="/login"
        state={{ from: pathname }}
        aria-label={wide ? undefined : `Entre para salvar ${service.title}`}
      >
        <Heart size={18} aria-hidden="true" />
        {wide && <span>Salvar serviço</span>}
      </Link>
    )
  if (user.role !== 'CLIENT') return null
  const saved = ids.includes(service.id)
  async function onClick() {
    try {
      notify((await toggle(service.id)) ? 'Serviço salvo.' : 'Serviço removido dos salvos.')
    } catch (e) {
      notify((e as Error).message)
    }
  }
  return (
    <button
      type="button"
      className={`${className} ${saved ? 'saved' : ''}`}
      aria-pressed={saved}
      aria-label={wide ? undefined : `${saved ? 'Remover dos salvos' : 'Salvar'}: ${service.title}`}
      onClick={() => void onClick()}
    >
      <Heart size={18} aria-hidden="true" fill={saved ? 'currentColor' : 'none'} />
      {wide && <span>{saved ? 'Salvo' : 'Salvar serviço'}</span>}
    </button>
  )
}
