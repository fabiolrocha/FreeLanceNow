import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BriefcaseBusiness,
  ClipboardList,
  MapPin,
  PenLine,
  Plus,
  ShieldCheck,
} from 'lucide-react'
import { useApp } from '../../app/store'
import { Avatar, CategoryIcon, Empty, ErrorMessage } from '../../components/ui'
import { feedApi } from '../../data/feed'
import type { FeedItem, FeedPage } from '../../data/feed'
import { money } from '../../domain/rules'
import './feed.css'
const labels = {
  UPDATE: 'Publicação',
  SERVICE: 'Serviço disponível',
  DEMAND: 'Precisa de um profissional',
}
const dates = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
})
// Each role opens on what it acts on: clients look for services, freelancers for open demands.
const views = {
  CLIENT: {
    tabs: [
      ['SERVICE', 'Serviços'],
      ['UPDATE', 'Publicações'],
      ['DEMAND', 'Minhas demandas'],
      ['', 'Tudo'],
    ],
    subtitle: 'Encontre profissionais e acompanhe o que você precisa resolver.',
    placeholder: 'Conte o que você precisa ou como foi um serviço…',
  },
  FREELANCER: {
    tabs: [
      ['DEMAND', 'Demandas abertas'],
      ['UPDATE', 'Publicações'],
      ['', 'Tudo'],
    ],
    subtitle: 'Encontre demandas abertas e mostre o que você faz.',
    placeholder: 'No que você está trabalhando?',
  },
  ADMIN: {
    tabs: [
      ['', 'Tudo'],
      ['UPDATE', 'Publicações'],
      ['SERVICE', 'Serviços'],
      ['DEMAND', 'Demandas'],
    ],
    subtitle: 'Acompanhe publicações, serviços e demandas da plataforma.',
    placeholder: '',
  },
}
export function Feed() {
  const { user, services, demands, categories, contracts, professionals, notify } = useApp()
  const view = views[user?.role ?? 'CLIENT']
  const [data, setData] = useState<FeedPage | null>(null),
    [type, setType] = useState(view.tabs[0][0]),
    [categoryId, setCategoryId] = useState(''),
    [page, setPage] = useState(0),
    [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [actionError, setActionError] = useState(''),
    [busy, setBusy] = useState(false)
  const [text, setText] = useState(''),
    [postCategory, setPostCategory] = useState(''),
    [serviceId, setServiceId] = useState('')
  const source = useMemo(
    () => ({ user: user!, services, demands, categories }),
    [user, services, demands, categories],
  )
  useEffect(() => {
    let active = true
    // Synchronize the server page with filters; stale responses cannot replace a newer filter.
    // oxlint-disable-next-line react/set-state-in-effect
    setLoading(true)
    setError('')
    void feedApi
      .list(source, page, type, categoryId)
      .then((result) => {
        if (active) {
          const lastPage = Math.max(0, result.totalPages - 1)
          if (page > lastPage) setPage(lastPage)
          else setData(result)
        }
      })
      .catch((e) => {
        if (active) setError((e as Error).message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [page, type, categoryId, revision, source])
  if (!user) return null
  const ownServices = services.filter(
    (s) => s.freelancer.id === user.id && s.status === 'ACTIVE' && !s.moderated,
  )
  const freelancer = user.role === 'FREELANCER'
  const mine = contracts.filter((c) => c.clientId === user.id || c.freelancerId === user.id)
  const requests = mine.filter((c) => c.freelancerId === user.id && c.status === 'PENDENTE')
  const pending = mine.filter((c) =>
    (freelancer
      ? ['ACEITO', 'EM_ANDAMENTO', 'AGUARDANDO_CONFIRMACAO']
      : ['PENDENTE', 'ACEITO', 'EM_ANDAMENTO', 'AGUARDANDO_CONFIRMACAO']
    ).includes(c.status),
  )
  function reload() {
    setRevision((r) => r + 1)
  }
  async function publish(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setActionError('')
    try {
      await feedApi.create(source, {
        text,
        ...(serviceId ? { serviceId } : postCategory ? { categoryId: postCategory } : {}),
      })
      setText('')
      setServiceId('')
      setPostCategory('')
      setType('')
      setCategoryId('')
      setPage(0)
      reload()
      notify('Publicação compartilhada.')
    } catch (e) {
      setActionError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  async function hide(item: FeedItem) {
    setBusy(true)
    setActionError('')
    try {
      await feedApi.hide(source, item.id)
      reload()
      notify('Publicação retirada do feed.')
    } catch (e) {
      setActionError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="feed-layout">
      <aside className="feed-left" aria-label="Perfil e categorias">
        <section className="feed-profile feed-surface">
          <div className="feed-profile-cover" />
          <Avatar name={user.name} large />
          <h2>{user.name}</h2>
          <p>
            {user.role === 'FREELANCER'
              ? 'Profissional independente'
              : 'Conectando ideias e pessoas'}
          </p>
          {user.city && (
            <small>
              <MapPin size={13} />
              {user.city}
            </small>
          )}
          <Link to="/perfil">
            Ver meu perfil <ArrowRight size={14} />
          </Link>
          <div className="feed-profile-links">
            <Link to={user.role === 'FREELANCER' ? '/meus-servicos' : '/demandas'}>
              <BriefcaseBusiness size={17} />
              {user.role === 'FREELANCER' ? 'Meus serviços' : 'Minhas demandas'}
            </Link>
            <Link to="/contratacoes">
              <ClipboardList size={17} />
              Minhas contratações
            </Link>
          </div>
        </section>
        <section className="feed-surface feed-categories">
          <h2>Explore por categoria</h2>
          <button
            className={!categoryId ? 'selected' : ''}
            onClick={() => {
              setCategoryId('')
              setPage(0)
            }}
          >
            Todas as áreas
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              className={categoryId === c.id ? 'selected' : ''}
              onClick={() => {
                setCategoryId(c.id)
                setPage(0)
              }}
            >
              <CategoryIcon slug={c.slug} size={18} />
              {c.name}
            </button>
          ))}
        </section>
        <p className="feed-footnote">
          Seu trabalho encontra novas possibilidades.
          <br />
          <Link to="/ajuda">Ajuda</Link> · <Link to="/privacidade">Privacidade</Link>
        </p>
      </aside>
      <section className="feed-center" aria-label="Publicações e oportunidades">
        <div className="feed-heading">
          <span>CONEXÕES QUE VIRAM TRABALHO</span>
          <h1>Feed de trabalho</h1>
          <p>{view.subtitle}</p>
        </div>
        {user.role !== 'ADMIN' && (
          <section className="feed-surface feed-composer">
            <form onSubmit={(e) => void publish(e)}>
              <div className="feed-compose-input">
                <Avatar name={user.name} />
                <label className="field">
                  <span className="sr-only">Compartilhe seu trabalho</span>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={view.placeholder}
                    required
                    maxLength={500}
                    rows={3}
                  />
                </label>
              </div>
              <div className="feed-compose-options">
                <label className="field">
                  <span>Área do trabalho</span>
                  <select
                    value={postCategory}
                    disabled={!!serviceId}
                    onChange={(e) => setPostCategory(e.target.value)}
                  >
                    <option value="">Sem categoria</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                {ownServices.length > 0 && (
                  <label className="field">
                    <span>Vincular meu serviço</span>
                    <select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
                      <option value="">Sem vínculo</option>
                      {ownServices.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              <div className="feed-composer-bottom">
                <small>{text.length}/500</small>
                <button className="button" disabled={busy || !text.trim()}>
                  <PenLine size={16} />
                  {busy ? 'Publicando…' : 'Publicar atualização'}
                </button>
              </div>
            </form>
            <div className="feed-intents">
              <span>Tem uma oportunidade?</span>
              {user.role === 'FREELANCER' ? (
                <Link to="/meus-servicos/novo">
                  <Plus size={16} />
                  Oferecer serviço
                </Link>
              ) : (
                <Link to="/demandas/nova">
                  <Plus size={16} />
                  Publicar demanda
                </Link>
              )}
            </div>
          </section>
        )}
        <ErrorMessage message={actionError} />
        <div className="feed-filter-bar">
          <div role="group" aria-label="Tipo de conteúdo">
            {view.tabs.map(([value, label]) => (
              <button
                key={value}
                aria-pressed={type === value}
                onClick={() => {
                  setType(value)
                  setPage(0)
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <span>Mais recentes</span>
        </div>
        <label className="field feed-mobile-category">
          <span>Filtrar por categoria</span>
          <select
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value)
              setPage(0)
            }}
          >
            <option value="">Todas as áreas</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {loading ? (
          <p className="feed-surface loading" role="status">
            Carregando publicações…
          </p>
        ) : error ? (
          <section className="feed-surface">
            <ErrorMessage message={error} />
            <button className="button secondary" onClick={reload}>
              Tentar novamente
            </button>
          </section>
        ) : (
          <>
            {!data?.items.length && (
              <div className="feed-surface">
                <Empty title="Ainda não há publicações aqui">
                  <p>Compartilhe seu trabalho ou explore outra categoria.</p>
                  <button
                    className="text-button"
                    onClick={() => {
                      setCategoryId('')
                      setType('')
                      setPage(0)
                    }}
                  >
                    Ver todo o feed
                  </button>
                </Empty>
              </div>
            )}
            {data?.items.map((item) => (
              <article className="feed-surface feed-card" key={`${item.type}-${item.id}`}>
                <header>
                  <Avatar name={item.author.name} />
                  <div className="feed-author">
                    {item.author.role === 'FREELANCER' ? (
                      <Link to={`/profissionais/${item.author.id}`}>{item.author.name}</Link>
                    ) : (
                      <strong>{item.author.name}</strong>
                    )}
                    <small>
                      {item.author.role === 'FREELANCER' ? 'Freelancer' : 'Cliente'} ·{' '}
                      <time dateTime={item.createdAt}>
                        {dates.format(new Date(item.createdAt))}
                      </time>
                    </small>
                  </div>
                  <span className={`feed-kind ${item.type.toLowerCase()}`}>
                    {labels[item.type]}
                  </span>
                </header>
                {item.type !== 'UPDATE' && <h2>{item.title}</h2>}
                <p className="feed-text">{item.text}</p>
                {item.category && <span className="feed-category-tag">{item.category.name}</span>}
                {item.price != null && (
                  <div className="feed-opportunity">
                    <div>
                      <small>{item.type === 'DEMAND' ? 'Orçamento estimado' : 'A partir de'}</small>
                      <strong>{money(item.price)}</strong>
                    </div>
                    <span>
                      {item.days} {item.days === 1 ? 'dia' : 'dias'}
                      {item.city && <> · {item.city}</>}
                    </span>
                  </div>
                )}
                <footer>
                  <div>
                    {item.serviceId ? (
                      <Link className="feed-primary-link" to={`/servicos/${item.serviceId}`}>
                        Ver serviço <ArrowRight size={16} />
                      </Link>
                    ) : item.type === 'DEMAND' ? (
                      <Link className="feed-primary-link" to={`/demandas/${item.id}`}>
                        {user.role === 'FREELANCER'
                          ? 'Ver demanda e enviar proposta'
                          : 'Ver demanda'}{' '}
                        <ArrowRight size={16} />
                      </Link>
                    ) : item.author.role === 'FREELANCER' ? (
                      <Link className="feed-primary-link" to={`/profissionais/${item.author.id}`}>
                        Ver perfil profissional <ArrowRight size={16} />
                      </Link>
                    ) : null}
                  </div>
                  {item.type === 'UPDATE' &&
                    (item.author.id === user.id ? (
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() => void hide(item)}
                      >
                        Retirar publicação
                      </button>
                    ) : (
                      <Link
                        className="feed-report"
                        to={`/denunciar?type=POST&id=${encodeURIComponent(item.id)}&alvo=${encodeURIComponent('Publicação de ' + item.author.name)}`}
                      >
                        Denunciar
                      </Link>
                    ))}
                  {item.type === 'SERVICE' && item.author.id !== user.id && (
                    <Link
                      className="feed-report"
                      to={`/denunciar?type=SERVICE&id=${encodeURIComponent(item.id)}&alvo=${encodeURIComponent(item.title)}`}
                    >
                      Denunciar
                    </Link>
                  )}
                </footer>
              </article>
            ))}
            {!!data?.totalPages && (
              <nav className="feed-pagination" aria-label="Páginas do feed">
                <button
                  className="button secondary"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Anterior
                </button>
                <small>
                  Página {page + 1} de {data.totalPages}
                </small>
                <button
                  className="button secondary"
                  disabled={page + 1 >= data.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Próxima
                </button>
              </nav>
            )}
          </>
        )}
      </section>
      <aside className="feed-right" aria-label="Acompanhamento e profissionais">
        {freelancer && (
          <section className="feed-surface">
            <div className="feed-section-title">
              <BriefcaseBusiness size={18} />
              <h2>Solicitações pendentes</h2>
            </div>
            {requests.length ? (
              requests.slice(0, 3).map((c) => (
                <Link key={c.id} className="feed-contract" to={`/contratacoes/${c.id}`}>
                  <strong>{c.title}</strong>
                  <small>
                    Responder em até 48 horas <ArrowRight size={13} />
                  </small>
                </Link>
              ))
            ) : (
              <p className="feed-help-text">Nenhuma solicitação aguardando sua resposta.</p>
            )}
            <Link className="feed-all-link" to="/solicitacoes">
              Ver solicitações <ArrowRight size={14} />
            </Link>
          </section>
        )}
        <section className="feed-surface">
          <div className="feed-section-title">
            <ClipboardList size={18} />
            <h2>Em andamento</h2>
          </div>
          {pending.length ? (
            pending.slice(0, 3).map((c) => (
              <Link key={c.id} className="feed-contract" to={`/contratacoes/${c.id}`}>
                <strong>{c.title}</strong>
                <small>
                  {c.status === 'PENDENTE' ? 'Aguardando resposta' : 'Acompanhar contratação'}{' '}
                  <ArrowRight size={13} />
                </small>
              </Link>
            ))
          ) : (
            <p className="feed-help-text">Suas próximas contratações aparecerão aqui.</p>
          )}
          <Link className="feed-all-link" to="/contratacoes">
            Ver contratações <ArrowRight size={14} />
          </Link>
        </section>
        {freelancer ? (
          <section className="feed-surface">
            <h2>Meus serviços</h2>
            <p className="feed-help-text">
              {ownServices.length} {ownServices.length === 1 ? 'anúncio ativo' : 'anúncios ativos'}{' '}
              de até 20.
            </p>
            <Link className="feed-all-link" to="/meus-servicos/novo">
              Novo serviço <ArrowRight size={14} />
            </Link>
            <Link className="feed-all-link" to="/meus-servicos">
              Gerenciar serviços <ArrowRight size={14} />
            </Link>
          </section>
        ) : (
          <section className="feed-surface">
            <h2>Conheça profissionais</h2>
            {professionals
              .filter((p) => p.id !== user.id)
              .slice(0, 3)
              .map((p) => (
                <Link className="feed-professional" key={p.id} to={`/profissionais/${p.id}`}>
                  <Avatar name={p.name} />
                  <span>
                    <strong>{p.name}</strong>
                    <small>{p.city || 'Ver perfil profissional'}</small>
                  </span>
                </Link>
              ))}
            <Link className="feed-all-link" to="/profissionais">
              Explorar profissionais <ArrowRight size={14} />
            </Link>
          </section>
        )}
        <div className="feed-trust">
          <ShieldCheck size={24} />
          <strong>Boas conexões começam com clareza.</strong>
          <p>Descreva o trabalho, combine os detalhes e acompanhe tudo pela plataforma.</p>
        </div>
      </aside>
    </div>
  )
}
