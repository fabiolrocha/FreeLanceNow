import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useApp } from '../../app/store'
import { client, isMock, serviceImageUrl } from '../../data/client'
import { CategoryIcon, Empty, ErrorMessage, Field, PageTitle } from '../../components/ui'
import type { Service, ServiceImage, ServiceStatus } from '../../domain/types'
import { ServiceImagesField } from './ServiceImagesField'
import { money } from '../../domain/rules'

const labels = { ACTIVE: 'Ativo', DRAFT: 'Rascunho', INACTIVE: 'Desativado' }
export function MyServices() {
  const { user, refresh, notify } = useApp(),
    [items, setItems] = useState<Service[]>([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState('')
  useEffect(() => {
    if (user)
      void client
        .mine(user)
        .then(setItems)
        .catch((e) => setError(e.message))
  }, [user])
  async function status(s: Service) {
    if (!user) return
    setBusy(s.id)
    setError('')
    try {
      const changed = await client.status(user, s, s.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')
      setItems((ss) => ss.map((x) => (x.id === s.id ? changed : x)))
      await refresh()
      notify(`Serviço ${changed.status === 'ACTIVE' ? 'publicado' : 'desativado'}.`)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy('')
    }
  }
  return (
    <>
      <PageTitle
        title="Meus serviços"
        description={`${items.filter((s) => s.status === 'ACTIVE').length} de 20 anúncios ativos. Organize o que você oferece.`}
        action={
          <Link className="button" to="/meus-servicos/novo">
            <Plus size={18} />
            Adicionar serviço
          </Link>
        }
      />
      <ErrorMessage message={error} />
      {items.length ? (
        <div className="stack">
          {items.map((s) => (
            <article className="panel professional-row" key={s.id}>
              <span className="category-thumb">
                {s.images?.[0] ? (
                  <img src={serviceImageUrl(s.id, s.images[0].id)} alt="" />
                ) : (
                  <CategoryIcon slug={s.category.slug} size={30} />
                )}
              </span>
              <div>
                <h2>{s.title}</h2>
                <p>
                  {s.category.name} · {money(s.price)} · {s.deliveryDays} dias
                </p>
                <span className={`badge ${s.status === 'ACTIVE' ? 'green' : ''}`}>
                  {s.moderated ? 'Removido pela moderação' : labels[s.status]}
                </span>
              </div>
              <div className="row">
                {!s.moderated && (
                  <Link className="button secondary" to={`/meus-servicos/${s.id}/editar`}>
                    Editar
                  </Link>
                )}
                <button
                  disabled={busy === s.id || s.moderated}
                  className="text-button"
                  onClick={() => void status(s)}
                >
                  {s.status === 'ACTIVE' ? 'Desativar' : 'Publicar'}
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty title="Você ainda não publicou nenhum serviço">
          <p>Crie seu primeiro anúncio para aparecer nas buscas.</p>
          <Link className="button" to="/meus-servicos/novo">
            Publicar primeiro serviço
          </Link>
        </Empty>
      )}
    </>
  )
}
export function ServiceForm() {
  const { id } = useParams(),
    { user, categories, refresh, notify } = useApp(),
    navigate = useNavigate()
  const [existing, setExisting] = useState<Service | null>(null),
    [loading, setLoading] = useState(!!id),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState<ServiceImage[]>([]),
    [pending, setPending] = useState<File[]>([]),
    // Set when a new listing was saved but its photos failed, so a retry updates it.
    [createdId, setCreatedId] = useState('')
  const targetId = id || createdId || undefined
  useEffect(() => {
    if (id && user)
      void client
        .mine(user)
        .then((ss) => {
          const s = ss.find((x) => x.id === id)
          if (!s) setError('Serviço não encontrado na sua conta.')
          setExisting(s || null)
          setSaved(s?.images || [])
        })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false))
  }, [id, user])
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!user) return
    const d = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter),
      status = String(d.get('status') || 'ACTIVE') as ServiceStatus
    setBusy(true)
    setError('')
    try {
      const service = await client.saveService(
        user,
        {
          title: String(d.get('title')),
          description: String(d.get('description')),
          categoryId: String(d.get('categoryId')),
          price: Number(d.get('price')),
          deliveryDays: Number(d.get('deliveryDays')),
          status,
        },
        targetId,
      )
      if (pending.length) {
        try {
          const withImages = await client.uploadServiceImages(service.id, pending)
          setSaved(withImages.images || [])
          setPending([])
        } catch (uploadError) {
          setCreatedId(service.id)
          setSaved(service.images || [])
          await refresh()
          setError(
            `O anúncio foi salvo, mas as fotos não foram enviadas: ${(uploadError as Error).message}`,
          )
          return
        }
      }
      await refresh()
      notify(status === 'ACTIVE' ? 'Serviço publicado.' : 'Rascunho salvo.')
      navigate('/meus-servicos')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  async function removeSaved(image: ServiceImage) {
    if (!targetId) return
    setBusy(true)
    setError('')
    try {
      const changed = await client.deleteServiceImage(targetId, image.id)
      setSaved(changed.images || [])
      await refresh()
      notify('Foto removida.')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  if (loading) return <p>Carregando anúncio…</p>
  return (
    <>
      <PageTitle
        title={id ? 'Editar serviço' : 'Seu próximo serviço começa aqui'}
        description="Preencha o anúncio para que o cliente saiba o que está contratando."
      />
      <ErrorMessage message={error} />
      {(!id || existing) && (
        <form className="form-panel" onSubmit={submit}>
          <Field
            label="Título do serviço"
            name="title"
            required
            maxLength={80}
            defaultValue={existing?.title}
            placeholder="Ex.: instalação de chuveiro elétrico"
          />
          <label className="field">
            <span>Categoria *</span>
            <select name="categoryId" required defaultValue={existing?.category.id || ''}>
              <option value="">Selecione uma categoria</option>
              {existing && !categories.some((c) => c.id === existing.category.id) && (
                <option value={existing.category.id}>
                  {existing.category.name} (categoria atual desativada)
                </option>
              )}
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Descrição detalhada *</span>
            <textarea
              name="description"
              required
              maxLength={500}
              rows={5}
              defaultValue={existing?.description}
            />
            <small>Até 500 caracteres. Descreva o escopo e o que está incluído.</small>
          </label>
          <div className="form-columns">
            <Field
              label="Valor estimado (R$)"
              name="price"
              type="number"
              min="0.01"
              max="9999999999.99"
              step="0.01"
              required
              defaultValue={existing?.price}
            />
            <Field
              label="Prazo de execução (dias)"
              name="deliveryDays"
              type="number"
              min="1"
              max="365"
              required
              defaultValue={existing?.deliveryDays || 1}
            />
          </div>
          {isMock ? (
            <p className="notice">
              No modo demonstração os anúncios usam ícones por categoria. O envio de fotos funciona
              com a API.
            </p>
          ) : (
            <ServiceImagesField
              serviceId={targetId}
              saved={saved}
              pending={pending}
              onPendingChange={setPending}
              onRemoveSaved={(img) => void removeSaved(img)}
              busy={busy}
            />
          )}
          <div className="row">
            <Link className="button secondary" to="/meus-servicos">
              Cancelar
            </Link>
            <button name="status" value="DRAFT" className="button secondary" disabled={busy}>
              Salvar rascunho
            </button>
            <button name="status" value="ACTIVE" className="button" disabled={busy}>
              Publicar serviço
            </button>
          </div>
        </form>
      )}
    </>
  )
}
