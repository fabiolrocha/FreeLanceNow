import { useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowRight, Search, MapPin, Check, Wrench } from 'lucide-react'
import { useApp } from '../../app/store'
import { useReviews } from '../../app/useReviews'
import {
  Avatar,
  CategoryIcon,
  Empty,
  Field,
  PageTitle,
  ReviewList,
  ServiceGrid,
} from '../../components/ui'
import { money, ratingLabel } from '../../domain/rules'
import { avatarUrl, isMock, serviceImageUrl } from '../../data/client'
import type { Profile, Service } from '../../domain/types'

/** Best first impression: listings with reviews and photos come before brand-new ones. */
function featuredServices(services: Service[]) {
  const score = (s: Service) =>
    (s.freelancer.averageRating ?? 0) * 10 +
    Math.min(s.freelancer.reviewCount ?? 0, 20) +
    (s.images?.length ? 15 : 0)
  const ranked = [...services].sort((a, b) => score(b) - score(a))
  // One listing per professional first, so the showcase shows different people.
  const seen = new Set<string>()
  const variety = ranked.filter((s) => !seen.has(s.freelancer.id) && seen.add(s.freelancer.id))
  return [...variety, ...ranked.filter((s) => !variety.includes(s))]
}
export function Landing() {
  const { categories, services, user } = useApp()
  if (user) return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/inicio'} replace />
  const featured = featuredServices(services)
  const spotlight = featured[0]
  return (
    <>
      <section className="hero">
        <div>
          <h1>Encontre quem resolve o que você precisa.</h1>
          <p>
            Profissionais de serviços gerais perto de você. Do primeiro contato ao trabalho
            concluído, tudo em um só lugar.
          </p>
          <form action="/servicos" className="hero-search">
            <Search size={22} />
            <input
              name="q"
              aria-label="Qual serviço você precisa?"
              placeholder="Qual serviço você precisa?"
            />
            <button className="button">Buscar</button>
          </form>
          <div className="hero-categories">
            {categories.slice(0, 4).map((c) => (
              <Link key={c.id} to={`/servicos?categoria=${c.id}`}>
                <CategoryIcon slug={c.slug} size={17} />
                {c.name}
              </Link>
            ))}
          </div>
          <p className="hero-note">
            <Check size={16} />
            Uma plataforma feita para clientes e profissionais.
          </p>
        </div>
        <div className="hero-board">
          <div className="board-top">
            <span className="board-dot" />
            Pessoas que fazem acontecer
          </div>
          {spotlight ? (
            <>
              <Link className="hero-service" to={`/servicos/${spotlight.id}`}>
                <div className="tool-tile">
                  {spotlight.images?.[0] ? (
                    <img src={serviceImageUrl(spotlight.id, spotlight.images[0].id)} alt="" />
                  ) : (
                    <CategoryIcon slug={spotlight.category.slug} size={65} />
                  )}
                </div>
                <div>
                  <span>Serviço em destaque</span>
                  <h2>{spotlight.title}</h2>
                  <p>
                    {spotlight.category.name} · {money(spotlight.price)}
                  </p>
                </div>
              </Link>
              <div className="board-person">
                <Avatar
                  name={spotlight.freelancer.name}
                  large
                  src={avatarUrl(spotlight.freelancer.id, spotlight.freelancer.avatarVersion)}
                />
                <div>
                  <strong>{spotlight.freelancer.name}</strong>
                  <p>
                    {[
                      spotlight.freelancer.city,
                      typeof spotlight.freelancer.averageRating === 'number' &&
                        `★ ${ratingLabel(spotlight.freelancer.averageRating)}`,
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'Novo na plataforma'}
                  </p>
                </div>
                {isMock && <span className="badge">Demonstração</span>}
              </div>
            </>
          ) : (
            <div className="hero-service">
              <div className="tool-tile">
                <Wrench size={65} strokeWidth={1.3} />
              </div>
              <div>
                <span>Comece por aqui</span>
                <h2>Os primeiros anúncios aparecem em breve</h2>
                <p>Profissionais já podem publicar seus serviços.</p>
              </div>
            </div>
          )}
          <div className="board-footer">
            <span>
              Uma necessidade.
              <br />
              <strong>O profissional certo.</strong>
            </span>
            <Link to="/servicos" aria-label="Explorar serviços">
              <ArrowRight size={26} />
            </Link>
          </div>
        </div>
      </section>
      <section className="landing-section">
        <PageTitle
          title="O que você precisa hoje?"
          description="Explore serviços para sua casa ou seu negócio."
        />
        <div className="category-grid">
          {categories.map((c) => (
            <Link key={c.id} to={`/servicos?categoria=${c.id}`}>
              <CategoryIcon slug={c.slug} size={30} />
              <strong>{c.name}</strong>
              <span>
                Encontrar profissionais <ArrowRight size={14} />
              </span>
            </Link>
          ))}
        </div>
      </section>
      <section className="landing-section">
        <PageTitle
          title="Serviços para começar"
          description="Conheça os anúncios disponíveis na plataforma."
          action={<Link to="/servicos">Ver todos os serviços</Link>}
        />
        <ServiceGrid services={featured.slice(0, 3)} />
      </section>
      <section className="how-section">
        <h2>Da busca ao serviço concluído</h2>
        <div className="how-grid">
          {[
            ['Encontre', 'Busque por categoria, preço ou região.'],
            ['Solicite', 'Descreva o que precisa e combine uma data.'],
            ['Acompanhe', 'Veja o andamento e confirme a entrega.'],
            ['Avalie', 'Conte como foi a experiência depois da conclusão.'],
          ].map(([t, p], i) => (
            <div key={t}>
              <span>{i + 1}</span>
              <h3>{t}</h3>
              <p>{p}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="professional-cta">
        <div>
          <h2>Seu talento merece ser encontrado.</h2>
          <p>Publique seus serviços, receba solicitações e organize seu trabalho.</p>
        </div>
        <Link className="button" to="/cadastro?tipo=freelancer">
          Criar perfil profissional
        </Link>
      </section>
    </>
  )
}
const PAGE_SIZE = 12
export function SearchServices() {
  const { services, categories } = useApp(),
    [params, setParams] = useSearchParams()
  const [maxPrice, setMaxPrice] = useState(''),
    [minRating, setMinRating] = useState(''),
    [city, setCity] = useState(''),
    [sort, setSort] = useState('recent')
  const q = params.get('q') || '',
    cat = params.get('categoria') || ''
  const filtered = services
    .filter(
      (s) =>
        (!q ||
          `${s.title} ${s.description} ${s.freelancer.name}`
            .toLocaleLowerCase('pt-BR')
            .includes(q.toLocaleLowerCase('pt-BR'))) &&
        (!cat || s.category.id === cat) &&
        (!maxPrice || s.price <= Number(maxPrice)) &&
        (!minRating || (s.freelancer.averageRating ?? 0) >= Number(minRating)) &&
        (!city ||
          s.freelancer.city.toLocaleLowerCase('pt-BR').includes(city.toLocaleLowerCase('pt-BR'))),
    )
    .sort((a, b) =>
      sort === 'price'
        ? a.price - b.price
        : sort === 'rating'
          ? (b.freelancer.averageRating ?? 0) - (a.freelancer.averageRating ?? 0)
          : 0,
    )
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)),
    page = Math.min(Math.max(1, Number(params.get('pagina')) || 1), totalPages),
    visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  function change(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'pagina') next.delete('pagina')
    setParams(next, { replace: key !== 'pagina' })
  }
  // Any filter change goes back to the first page.
  function filter<T>(set: (v: T) => void) {
    return (v: T) => {
      set(v)
      change('pagina', '')
    }
  }
  return (
    <>
      <PageTitle
        title="Encontre o serviço certo"
        description="Profissionais para os pequenos reparos e os grandes projetos."
      />
      <div className="search-layout">
        <aside className="filter-panel">
          <div className="row between">
            <h2>Filtros</h2>
            <button
              className="text-button"
              onClick={() => {
                setParams({})
                setCity('')
                setMaxPrice('')
                setMinRating('')
              }}
            >
              Limpar
            </button>
          </div>
          <label className="field">
            <span>Categoria</span>
            <select value={cat} onChange={(e) => change('categoria', e.target.value)}>
              <option value="">Todas as categorias</option>
              {categories.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Preço máximo (R$)</span>
            <input
              type="number"
              min="0"
              value={maxPrice}
              onChange={(e) => filter(setMaxPrice)(e.target.value)}
              placeholder="Sem limite"
            />
          </label>
          <label className="field">
            <span>Nota mínima</span>
            <select value={minRating} onChange={(e) => filter(setMinRating)(e.target.value)}>
              <option value="">Qualquer nota</option>
              <option value="4">4 estrelas ou mais</option>
              <option value="4.5">4,5 estrelas ou mais</option>
              <option value="5">5 estrelas</option>
            </select>
          </label>
          <label className="field">
            <span>Localização</span>
            <input
              value={city}
              onChange={(e) => filter(setCity)(e.target.value)}
              placeholder="Cidade ou região"
            />
          </label>
          <p className="filter-hint">
            O preço é uma estimativa. Combine o escopo antes de contratar.
          </p>
        </aside>
        <div>
          <div className="search-toolbar">
            <label className="search-input">
              <Search size={19} />
              <input
                aria-label="Buscar serviços"
                value={q}
                onChange={(e) => change('q', e.target.value)}
                placeholder="Serviço ou profissional"
              />
            </label>
            <select
              aria-label="Ordenar resultados"
              value={sort}
              onChange={(e) => filter(setSort)(e.target.value)}
            >
              <option value="recent">Mais recentes</option>
              <option value="price">Menor preço</option>
              <option value="rating">Melhor avaliação</option>
            </select>
          </div>
          <p className="result-count">
            {filtered.length}{' '}
            {filtered.length === 1 ? 'serviço encontrado' : 'serviços encontrados'}
          </p>
          {filtered.length ? (
            <>
              <ServiceGrid services={visible} />
              {totalPages > 1 && (
                <nav className="pager" aria-label="Páginas de resultados">
                  <button
                    className="button secondary"
                    disabled={page <= 1}
                    onClick={() => change('pagina', String(page - 1))}
                  >
                    Anterior
                  </button>
                  <span>
                    Página {page} de {totalPages}
                  </span>
                  <button
                    className="button secondary"
                    disabled={page >= totalPages}
                    onClick={() => change('pagina', String(page + 1))}
                  >
                    Próxima
                  </button>
                </nav>
              )}
            </>
          ) : (
            <Empty title="Nenhum serviço encontrado">
              <p>Amplie a faixa de preço, tente outro termo ou limpe os filtros.</p>
              <button
                className="button secondary"
                onClick={() => {
                  setParams({})
                  setCity('')
                  setMaxPrice('')
                  setMinRating('')
                }}
              >
                Limpar filtros
              </button>
            </Empty>
          )}
        </div>
      </div>
    </>
  )
}
export function ServiceDetail() {
  const { id } = useParams(),
    { services, user } = useApp(),
    reviews = useReviews('service', id),
    s = services.find((x) => x.id === id)
  if (!s)
    return (
      <Empty title="Serviço não encontrado">
        <Link to="/servicos">Voltar à busca</Link>
      </Empty>
    )
  return (
    <>
      <p className="breadcrumb">
        <Link to="/servicos">Serviços</Link> / {s.category.name}
      </p>
      <div className="detail-grid">
        <article className="panel detail-main">
          {s.images?.length ? (
            <ServiceGallery service={s} />
          ) : (
            <div className={`detail-visual ${s.category.slug}`}>
              <CategoryIcon slug={s.category.slug} size={90} />
              <span>Este anúncio ainda não tem fotos.</span>
            </div>
          )}
          <small className="category-text">{s.category.name}</small>
          <h1>{s.title}</h1>
          <p>
            <MapPin size={16} /> {s.freelancer.city}
          </p>
          <h2>Sobre o serviço</h2>
          <p>{s.description}</p>
          <h2>Antes de contratar</h2>
          <p>Confirme o escopo, os materiais necessários e a disponibilidade com o profissional.</p>
          <h2>
            Avaliações deste serviço
            {reviews.length > 0 &&
              ` · ★ ${ratingLabel(reviews.reduce((a, r) => a + r.rating, 0) / reviews.length)} (${reviews.length})`}
          </h2>
          <ReviewList reviews={reviews} showService={false} />
        </article>
        <aside className="panel booking-panel">
          <strong className="big-price">{money(s.price)}</strong>
          <p>
            Valor estimado · {s.deliveryDays} {s.deliveryDays === 1 ? 'dia' : 'dias'} para execução
          </p>
          {(!user || user.role === 'CLIENT') && (
            <>
              <Link className="button full" to={`/servicos/${s.id}/solicitar`}>
                Solicitar serviço
              </Link>
              <small>O profissional tem até 48 horas para responder.</small>
            </>
          )}
          {user?.id === s.freelancer.id && (
            <Link className="button secondary full" to={`/meus-servicos/${s.id}/editar`}>
              Editar meu anúncio
            </Link>
          )}
          <hr />
          <div className="person">
            <Avatar
              name={s.freelancer.name}
              src={avatarUrl(s.freelancer.id, s.freelancer.avatarVersion)}
            />
            <div>
              <strong>{s.freelancer.name}</strong>
              <p>
                {[
                  s.freelancer.city,
                  typeof s.freelancer.averageRating === 'number' &&
                    `★ ${ratingLabel(s.freelancer.averageRating)} (${s.freelancer.reviewCount})`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
          </div>
          <Link to={`/profissionais/${s.freelancer.id}`}>Ver perfil completo</Link>
          {user && user.id !== s.freelancer.id && user.role !== 'ADMIN' && (
            <Link
              className="subtle-link"
              to={`/denunciar?type=SERVICE&id=${s.id}&alvo=${encodeURIComponent(s.title)}`}
            >
              Denunciar anúncio
            </Link>
          )}
        </aside>
      </div>
    </>
  )
}
const PROFESSIONALS_PAGE = 12
/** Specialties from the API, or from the visible listings in the demo data. */
function useSpecialties() {
  const { services } = useApp()
  return (p: Profile) =>
    p.specialties ??
    [
      ...new Set(services.filter((s) => s.freelancer.id === p.id).map((s) => s.category.name)),
    ].sort()
}
export function Professionals() {
  const { professionals, categories } = useApp(),
    specialties = useSpecialties(),
    [q, setQ] = useState(''),
    [city, setCity] = useState(''),
    [category, setCategory] = useState(''),
    [sort, setSort] = useState('rating'),
    [shown, setShown] = useState(PROFESSIONALS_PAGE)
  const term = q.trim().toLowerCase(),
    town = city.trim().toLowerCase()
  const list = professionals
    .map((p) => ({ ...p, specialties: specialties(p) }))
    .filter((p) => `${p.name} ${p.bio} ${p.specialties.join(' ')}`.toLowerCase().includes(term))
    .filter((p) => !town || `${p.city} ${p.serviceArea || ''}`.toLowerCase().includes(town))
    .filter((p) => !category || p.specialties.includes(category))
    .sort((a, b) =>
      sort === 'name'
        ? a.name.localeCompare(b.name)
        : (b.averageRating ?? 0) - (a.averageRating ?? 0) ||
          (b.reviewCount ?? 0) - (a.reviewCount ?? 0),
    )
  return (
    <>
      <PageTitle
        title="Pessoas que fazem acontecer"
        description="Conheça quem está por trás de cada serviço."
      />
      <label className="search-input">
        <Search size={20} />
        <input
          aria-label="Buscar profissionais"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nome ou especialidade"
        />
      </label>
      <div className="filters">
        <Field
          label="Cidade ou bairro"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Taguatinga"
        />
        <label className="field">
          <span>Especialidade</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Todas</option>
            {categories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Ordenar por</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="rating">Melhor avaliados</option>
            <option value="name">Nome</option>
          </select>
        </label>
      </div>
      <p className="meta" role="status">
        {list.length} {list.length === 1 ? 'profissional' : 'profissionais'}
      </p>
      <div className="professional-list">
        {list.slice(0, shown).map((p) => (
          <article className="panel professional-row" key={p.id}>
            <Avatar name={p.name} large src={avatarUrl(p.id, p.avatarVersion)} />
            <div>
              <h2>{p.name}</h2>
              {p.specialties.length > 0 && (
                <ul className="chips" aria-label="Especialidades">
                  {p.specialties.map((s) => (
                    <li className="badge" key={s}>
                      {s}
                    </li>
                  ))}
                </ul>
              )}
              <p>{p.bio}</p>
              <small>
                <MapPin size={14} />{' '}
                {[
                  p.serviceArea || p.city || 'Localização não informada',
                  typeof p.averageRating === 'number'
                    ? `★ ${ratingLabel(p.averageRating)} (${p.reviewCount})`
                    : 'Novo na plataforma',
                ].join(' · ')}
              </small>
            </div>
            <Link className="button secondary" to={`/profissionais/${p.id}`}>
              Ver perfil
            </Link>
          </article>
        ))}
      </div>
      {list.length > shown && (
        <button className="button secondary" onClick={() => setShown(shown + PROFESSIONALS_PAGE)}>
          Mostrar mais
        </button>
      )}
      {!list.length && <Empty title="Nenhum profissional com esses filtros" />}
    </>
  )
}
export function ProfileDetail() {
  const { id } = useParams(),
    { professionals, services, contracts, user } = useApp(),
    specialties = useSpecialties(),
    reviews = useReviews('freelancer', id),
    p = professionals.find((x) => x.id === id),
    conversation = contracts.find(
      (c) =>
        c.freelancerId === id &&
        c.clientId === user?.id &&
        !['RECUSADO', 'CANCELADO'].includes(c.status),
    )
  if (!p) return <Empty title="Profissional não encontrado" />
  const tags = specialties(p)
  return (
    <>
      <div className="panel profile-cover">
        <Avatar name={p.name} large src={avatarUrl(p.id, p.avatarVersion)} />
        <div>
          <h1>{p.name}</h1>
          <p>
            {typeof p.averageRating === 'number'
              ? `★ ${ratingLabel(p.averageRating)} · ${p.reviewCount} ${p.reviewCount === 1 ? 'avaliação' : 'avaliações'}`
              : 'Ainda sem avaliações'}
          </p>
          <p>
            <MapPin size={16} /> {p.city}
            {p.serviceArea && ` · atende em ${p.serviceArea}`}
          </p>
          {p.memberSince && (
            <p className="meta">
              Na plataforma desde{' '}
              {new Date(p.memberSince).toLocaleDateString('pt-BR', {
                month: 'long',
                year: 'numeric',
              })}
            </p>
          )}
        </div>
        {conversation ? (
          <Link className="button secondary" to={`/mensagens?contratacao=${conversation.id}`}>
            Enviar mensagem
          </Link>
        ) : (
          user?.role === 'CLIENT' && (
            <a className="button secondary" href="#servicos-oferecidos">
              Solicite um serviço para conversar
            </a>
          )
        )}
      </div>
      <section className="panel">
        <h2>Sobre o profissional</h2>
        <p>{p.bio || 'O profissional ainda não escreveu sua apresentação.'}</p>
        {tags.length > 0 && (
          <ul className="chips" aria-label="Especialidades">
            {tags.map((s) => (
              <li className="badge" key={s}>
                {s}
              </li>
            ))}
          </ul>
        )}
      </section>
      <div id="servicos-oferecidos">
        <PageTitle title="Serviços oferecidos" />
      </div>
      <ServiceGrid services={services.filter((s) => s.freelancer.id === p.id)} />
      <section className="panel">
        <h2>Avaliações</h2>
        <ReviewList reviews={reviews} />
      </section>
    </>
  )
}
function ServiceGallery({ service: s }: { service: Service }) {
  const images = s.images || [],
    [index, setIndex] = useState(0),
    current = images[Math.min(index, images.length - 1)]
  return (
    <div className="gallery">
      <img
        className="gallery-main"
        src={serviceImageUrl(s.id, current.id)}
        alt={`Foto ${index + 1} de ${images.length}: ${s.title}`}
      />
      {images.length > 1 && (
        <ul className="gallery-thumbs" aria-label="Fotos do serviço">
          {images.map((img, i) => (
            <li key={img.id}>
              <button
                type="button"
                aria-label={`Ver foto ${i + 1}`}
                aria-pressed={i === index}
                onClick={() => setIndex(i)}
              >
                <img src={serviceImageUrl(s.id, img.id)} alt="" loading="lazy" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
