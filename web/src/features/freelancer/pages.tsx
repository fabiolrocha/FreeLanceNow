import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Clock, Eye, MapPin, Plus } from 'lucide-react'
import { useApp } from '../../app/store'
import { avatarUrl, client, isMock, serviceImageUrl } from '../../data/client'
import {
  Avatar,
  CategoryIcon,
  ConfirmButton,
  Empty,
  ErrorMessage,
  Field,
  PageTitle,
} from '../../components/ui'
import type { Service, ServiceImage, ServiceStatus } from '../../domain/types'
import { ServiceImagesField } from './ServiceImagesField'
import { money } from '../../domain/rules'
import './freelancer.css'

const labels = { ACTIVE: 'Ativo', DRAFT: 'Rascunho', INACTIVE: 'Desativado' }
const tones = { ACTIVE: 'green', DRAFT: 'amber', INACTIVE: 'gray' }
const hints = {
  ACTIVE: 'Aparece na busca e no seu perfil. Clientes podem solicitar.',
  DRAFT: 'Visível só para você. Publique quando estiver pronto.',
  INACTIVE: 'Fora da busca. Contratações em andamento continuam normalmente.',
}
/** Limit enforced by the API (RN: até 20 serviços ativos por freelancer). */
const MAX_ACTIVE = 20
const days = (n: number) => `${n} ${n === 1 ? 'dia' : 'dias'}`
export function MyServices() {
  const { user, refresh, notify } = useApp(),
    [items, setItems] = useState<Service[]>([]),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState('')
  useEffect(() => {
    if (user)
      void client
        .mine(user)
        .then(setItems)
        .catch((e) => setError(e.message))
        .finally(() => setLoaded(true))
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
  async function remove(s: Service) {
    if (!user) return
    setBusy(s.id)
    setError('')
    try {
      await client.deleteService(user, s)
      setItems((ss) => ss.filter((x) => x.id !== s.id))
      notify('Anúncio excluído.')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy('')
    }
  }
  const active = items.filter((s) => s.status === 'ACTIVE' && !s.moderated).length,
    drafts = items.filter((s) => s.status === 'DRAFT' && !s.moderated).length,
    paused = items.filter((s) => s.status === 'INACTIVE' && !s.moderated).length,
    moderated = items.filter((s) => s.moderated).length,
    full = active >= MAX_ACTIVE
  return (
    <>
      <PageTitle
        title="Meus serviços"
        description="Os anúncios que os clientes encontram na busca e no seu perfil."
        action={
          <Link className="button" to="/meus-servicos/novo">
            <Plus size={18} />
            Adicionar serviço
          </Link>
        }
      />
      <ErrorMessage message={error} />
      {items.length > 0 && (
        <section className="panel ms-summary" aria-label="Resumo dos anúncios">
          <div className="ms-quota">
            <p>
              <strong>
                {active} de {MAX_ACTIVE}
              </strong>{' '}
              anúncios ativos
            </p>
            <div className="ms-bar" aria-hidden="true">
              <span style={{ width: `${Math.min(100, (active / MAX_ACTIVE) * 100)}%` }} />
            </div>
            {full && <small>Você atingiu o limite. Desative um anúncio para publicar outro.</small>}
          </div>
          <ul className="ms-counts">
            <li>
              <strong>{drafts}</strong> {drafts === 1 ? 'rascunho' : 'rascunhos'}
            </li>
            <li>
              <strong>{paused}</strong> {paused === 1 ? 'desativado' : 'desativados'}
            </li>
            {moderated > 0 && (
              <li>
                <strong>{moderated}</strong> {moderated === 1 ? 'removido' : 'removidos'} pela
                moderação
              </li>
            )}
            <li>
              <Link to={user ? `/profissionais/${user.id}` : '/profissionais'}>
                Ver meu perfil público
              </Link>
            </li>
          </ul>
        </section>
      )}
      {items.length ? (
        <div className="ms-list">
          {items.map((s) => (
            <article className={`panel ms-item ${s.moderated ? 'moderated' : ''}`} key={s.id}>
              <span className={`ms-cover ${s.images?.[0] ? '' : s.category.slug}`}>
                {s.images?.[0] ? (
                  <img src={serviceImageUrl(s.id, s.images[0].id)} alt="" />
                ) : (
                  <CategoryIcon slug={s.category.slug} size={30} />
                )}
              </span>
              <div className="ms-body">
                <div className="ms-status">
                  <span className={`badge status ${s.moderated ? 'red' : tones[s.status]}`}>
                    {s.moderated ? 'Removido pela moderação' : labels[s.status]}
                  </span>
                  <small>{s.category.name}</small>
                </div>
                <h2>{s.title}</h2>
                <p className="ms-meta">
                  <strong>{money(s.price)}</strong> · {days(s.deliveryDays)} para execução
                  {s.images?.length
                    ? ` · ${s.images.length} ${s.images.length === 1 ? 'foto' : 'fotos'}`
                    : !isMock && ' · sem fotos'}
                </p>
                <p className="ms-hint">
                  {s.moderated
                    ? 'A administração retirou este anúncio após analisar uma denúncia. Ele não aparece na busca e não pode ser editado nem publicado de novo. Contratações já feitas continuam no histórico.'
                    : hints[s.status]}
                </p>
              </div>
              <div className="ms-actions">
                {!s.moderated && (
                  <Link className="button secondary" to={`/meus-servicos/${s.id}/editar`}>
                    Editar
                  </Link>
                )}
                {s.status === 'ACTIVE' && !s.moderated && (
                  <Link className="text-button" to={`/servicos/${s.id}`}>
                    Ver anúncio
                  </Link>
                )}
                {s.status === 'ACTIVE' ? (
                  <ConfirmButton
                    disabled={busy === s.id || s.moderated}
                    className="text-button"
                    label="Desativar"
                    title={`Desativar "${s.title}"?`}
                    message="O anúncio sai da busca e não recebe novas solicitações. Contratações em andamento continuam. Você pode publicá-lo de novo quando quiser."
                    confirmLabel="Sim, desativar"
                    onConfirm={() => void status(s)}
                  />
                ) : (
                  !s.moderated && (
                    <button
                      disabled={busy === s.id}
                      className="text-button"
                      onClick={() => void status(s)}
                    >
                      Publicar
                    </button>
                  )
                )}
                {s.status !== 'ACTIVE' && !s.moderated && (
                  <ConfirmButton
                    disabled={busy === s.id}
                    className="text-button danger-text"
                    label="Excluir"
                    title={`Excluir "${s.title}"?`}
                    message="O anúncio e as fotos são apagados. Anúncios que já tiveram contratações não podem ser excluídos: deixe-os desativados para manter o histórico."
                    confirmLabel="Sim, excluir"
                    danger
                    onConfirm={() => void remove(s)}
                  />
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        loaded && (
          <Empty title="Você ainda não publicou nenhum serviço">
            <p>
              Crie seu primeiro anúncio para aparecer nas buscas e no seu perfil. Clientes da sua
              região poderão solicitar direto pelo anúncio.
            </p>
            <Link className="button" to="/meus-servicos/novo">
              Publicar primeiro serviço
            </Link>
          </Empty>
        )
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
  // Mirrors the form fields for the live preview; the form itself stays uncontrolled.
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const pendingCover = useMemo(() => (pending[0] ? URL.createObjectURL(pending[0]) : ''), [pending])
  useEffect(() => () => URL.revokeObjectURL(pendingCover), [pendingCover])
  useEffect(() => {
    if (id && user)
      void client
        .mine(user)
        .then((ss) => {
          const s = ss.find((x) => x.id === id)
          if (!s) setError('Serviço não encontrado na sua conta.')
          setExisting(s || null)
          setSaved(s?.images || [])
          if (s)
            setDraft({
              title: s.title,
              categoryId: s.category.id,
              description: s.description,
              price: String(s.price),
              deliveryDays: String(s.deliveryDays),
            })
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
  const category =
      categories.find((c) => c.id === draft.categoryId) ||
      (existing?.category.id === draft.categoryId ? existing.category : undefined),
    cover = pendingCover || (targetId && saved[0] ? serviceImageUrl(targetId, saved[0].id) : '')
  return (
    <>
      <PageTitle
        title={id ? 'Editar serviço' : 'Seu próximo serviço começa aqui'}
        description="Preencha o anúncio para que o cliente saiba o que está contratando."
      />
      <ErrorMessage message={error} />
      {(!id || existing) && (
        <div className="sf-layout">
          <form
            className="form-panel sf-form"
            onSubmit={submit}
            onChange={(e) => setDraft(readDraft(e.currentTarget))}
          >
            <section className="sf-section" aria-labelledby="sf-about">
              <h2 id="sf-about">O que você oferece</h2>
              <Field
                label="Título do serviço"
                name="title"
                required
                maxLength={80}
                defaultValue={existing?.title}
                placeholder="Ex.: instalação de chuveiro elétrico"
                hint="Diga o serviço com as palavras que o cliente usaria na busca."
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
                <small className="sf-counter">
                  <span>Descreva o escopo, o que está incluído e o que não está.</span>
                  <span>{draft.description.length}/500</span>
                </small>
              </label>
            </section>
            <section className="sf-section" aria-labelledby="sf-price">
              <h2 id="sf-price">Preço e prazo</h2>
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
              <p className="sf-note">
                O valor é uma estimativa de mão de obra. O valor final é combinado com o cliente
                antes do início.
              </p>
            </section>
            <section className="sf-section" aria-labelledby="sf-photos">
              <h2 id="sf-photos">Fotos</h2>
              {isMock ? (
                <p className="notice">
                  Os anúncios do modo mock usam ícones por categoria. O envio de fotos funciona com
                  a API.
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
            </section>
            <div className="row sf-buttons">
              <Link className="button secondary" to="/meus-servicos">
                Cancelar
              </Link>
              {existing?.status === 'ACTIVE' ? (
                <button name="status" value="ACTIVE" className="button" disabled={busy}>
                  Salvar alterações
                </button>
              ) : (
                <>
                  <button
                    name="status"
                    value={existing?.status === 'INACTIVE' ? 'INACTIVE' : 'DRAFT'}
                    className="button secondary"
                    disabled={busy}
                  >
                    {existing?.status === 'INACTIVE' ? 'Salvar sem publicar' : 'Salvar rascunho'}
                  </button>
                  <button name="status" value="ACTIVE" className="button" disabled={busy}>
                    {existing ? 'Salvar e publicar' : 'Publicar serviço'}
                  </button>
                </>
              )}
            </div>
          </form>
          <div className="sf-preview">
            <h2>
              <Eye size={17} aria-hidden="true" /> Prévia na busca
            </h2>
            <div className="sf-card" aria-hidden="true">
              <div className={`sf-card-visual ${cover ? '' : category?.slug || ''}`}>
                {cover ? (
                  <img src={cover} alt="" />
                ) : (
                  <CategoryIcon slug={category?.slug || ''} size={44} />
                )}
              </div>
              <div className="sf-card-body">
                <small className="category-text">{category?.name || 'Categoria'}</small>
                <strong className="sf-card-title">
                  {draft.title.trim() || 'Título do seu serviço'}
                </strong>
                {user && (
                  <div className="person">
                    <Avatar name={user.name} src={avatarUrl(user.id, user.avatarVersion)} />
                    <div>
                      <span>{user.name}</span>
                      <small>
                        <MapPin size={12} />
                        {user.city || 'Localização não informada'}
                      </small>
                    </div>
                  </div>
                )}
                <div className="sf-card-price">
                  <strong>{Number(draft.price) > 0 ? money(Number(draft.price)) : 'R$ —'}</strong>
                  <small>
                    <Clock size={12} /> estimativa ·{' '}
                    {Number(draft.deliveryDays) > 0
                      ? `${draft.deliveryDays} ${Number(draft.deliveryDays) === 1 ? 'dia' : 'dias'}`
                      : '— dias'}
                  </small>
                </div>
              </div>
            </div>
            <ul className="sf-tips">
              <li>Títulos curtos e específicos aparecem melhor na busca.</li>
              <li>Fotos de trabalhos reais passam mais confiança.</li>
              <li>Deixe claro o que está incluído no valor.</li>
            </ul>
          </div>
        </div>
      )}
    </>
  )
}
interface Draft {
  title: string
  categoryId: string
  description: string
  price: string
  deliveryDays: string
}
const emptyDraft: Draft = {
  title: '',
  categoryId: '',
  description: '',
  price: '',
  deliveryDays: '1',
}
function readDraft(form: HTMLFormElement): Draft {
  const d = new FormData(form)
  return {
    title: String(d.get('title') || ''),
    categoryId: String(d.get('categoryId') || ''),
    description: String(d.get('description') || ''),
    price: String(d.get('price') || ''),
    deliveryDays: String(d.get('deliveryDays') || ''),
  }
}
