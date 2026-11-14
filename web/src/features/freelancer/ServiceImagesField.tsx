import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import { ImagePlus, X } from 'lucide-react'
import { serviceImageUrl } from '../../data/client'
import { imageSelectionError, MAX_SERVICE_IMAGES } from '../../domain/rules'
import type { ServiceImage } from '../../domain/types'

/**
 * Lets the owner queue new photos (sent after the listing is saved) and remove saved ones.
 * Validation mirrors RN08; the API validates again.
 */
export function ServiceImagesField({
  serviceId,
  saved,
  pending,
  onPendingChange,
  onRemoveSaved,
  busy,
}: {
  serviceId?: string
  saved: ServiceImage[]
  pending: File[]
  onPendingChange: (files: File[]) => void
  onRemoveSaved: (image: ServiceImage) => void
  busy: boolean
}) {
  const [error, setError] = useState('')
  const previews = useMemo(() => pending.map((f) => URL.createObjectURL(f)), [pending])
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews])
  const total = saved.length + pending.length

  function pick(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (!files.length) return
    const problem = imageSelectionError(files, total)
    setError(problem)
    if (!problem) onPendingChange([...pending, ...files])
  }

  return (
    <fieldset className="field image-field">
      <legend>Fotos do serviço</legend>
      <small>
        Até {MAX_SERVICE_IMAGES} imagens JPG ou PNG, com até 5 MB cada. A primeira aparece na busca.
      </small>
      {total > 0 && (
        <ul className="image-grid">
          {serviceId &&
            saved.map((img, i) => (
              <li key={img.id}>
                <img src={serviceImageUrl(serviceId, img.id)} alt={`Foto ${i + 1} do serviço`} />
                <button
                  type="button"
                  className="image-remove"
                  aria-label={`Remover foto ${i + 1}`}
                  disabled={busy}
                  onClick={() => onRemoveSaved(img)}
                >
                  <X size={16} aria-hidden />
                </button>
              </li>
            ))}
          {pending.map((f, i) => (
            <li key={previews[i]}>
              <img src={previews[i]} alt={`Nova foto: ${f.name}`} />
              <span className="badge">Será enviada ao salvar</span>
              <button
                type="button"
                className="image-remove"
                aria-label={`Remover ${f.name}`}
                disabled={busy}
                onClick={() => onPendingChange(pending.filter((_, j) => j !== i))}
              >
                <X size={16} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      {total < MAX_SERVICE_IMAGES && (
        <label className="button secondary image-pick">
          <ImagePlus size={18} aria-hidden />
          Adicionar fotos
          <input
            type="file"
            accept="image/jpeg,image/png"
            multiple
            disabled={busy}
            onChange={pick}
            aria-label="Adicionar fotos do serviço"
          />
        </label>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </fieldset>
  )
}
