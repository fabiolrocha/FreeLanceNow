import { useState } from 'react'
import { Link, Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  Search,
  MapPin,
  Check,
  Wrench,
  Flag,
  CalendarDays,
  Clock,
  BadgeCheck,
} from 'lucide-react'
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
  Stars,
} from '../../components/ui'
import { FavoriteButton } from '../../components/FavoriteButton'
import { money, ratingLabel } from '../../domain/rules'
import { avatarUrl, isMock, serviceImageUrl } from '../../data/client'
import type { Profile, Service } from '../../domain/types'
import './catalog.css'

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
const days = (n: number) => `${n} ${n === 1 ? 'dia' : 'dias'}`
const reviewsLabel = (n = 0) => `${n} ${n === 1 ? 'avaliação' : 'avaliações'}`
/** "nov. 2026" */
const monthYear = (iso: string) =>
  new Date(iso)
    .toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
    .replace(' de ', ' ')
/** Short professional line built from what the person actually offers. */
const headline = (tags: string[]) =>
  tags.length ? tags.join(' · ') : 'Profissional de serviços gerais'

/** Stars, average and count, or a plain note while there are no reviews. */
function RatingSummary({ rating, count }: { rating?: number | null; count?: number }) {
  if (typeof rating !== 'number' || !count)
    return <span className="rating-summary is-empty">Ainda sem avaliações</span>
  return (
    <span className="rating-summary">
      <Stars rating={rating} />
      <strong>{ratingLabel(rating)}</strong>
      <span>({reviewsLabel(count)})</span>
    </span>
  )
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
            Não achou o serviço? Publique uma demanda e receba propostas de profissionais.
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
        <h2>Como funciona</h2>
        <div className="audience-grid">
          {[
            {
              title: 'Para quem precisa de um serviço',
              lead: 'Contrate um anúncio pronto ou descreva o que precisa.',
              steps: [
                ['Encontre', 'Busque por categoria, preço ou região e compare perfis.'],
                [
                  'Solicite ou publique uma demanda',
                  'Peça o serviço direto ao profissional ou receba propostas.',
                ],
                ['Acompanhe e avalie', 'Confirme a entrega e conte como foi a experiência.'],
              ],
              cta: (
                <Link className="button" to="/servicos">
                  Encontrar serviços
                </Link>
              ),
            },
            {
              title: 'Para quem oferece serviços',
              lead: 'Mostre seu trabalho para quem está perto de você.',
              steps: [
                ['Crie seu perfil', 'Apresente sua experiência e a região onde atende.'],
                [
                  'Ofereça seus serviços',
                  'Publique anúncios e envie propostas para demandas abertas.',
                ],
                ['Execute e seja avaliado', 'Cada trabalho concluído fortalece sua reputação.'],
              ],
              cta: (
                <Link className="button secondary" to="/cadastro?tipo=freelancer">
                  Oferecer meus serviços
                </Link>
              ),
            },
          ].map((a) => (
            <div className="audience-card" key={a.title}>
              <h3>{a.title}</h3>
              <p>{a.lead}</p>
              <ol>
                {a.steps.map(([t, d], i) => (
                  <li key={t}>
                    <span aria-hidden="true">{i + 1}</span>
                    <div>
                      <strong>{t}</strong>
                      <p>{d}</p>
                    </div>
                  </li>
                ))}
              </ol>
              {a.cta}
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
  const { services, categories, user } = useApp(),
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
  function clear() {
    setParams({})
    setCity('')
    setMaxPrice('')
    setMinRating('')
  }
  // Clients (and visitors, after signing up) can describe the job instead of picking a listing.
  const demandCta =
    !user || user.role === 'CLIENT' ? (
      <div className="demand-cta">
        <div>
          <strong>Não encontrou o que precisa?</strong>
          <p>Publique uma demanda e receba propostas de profissionais da sua região.</p>
        </div>
        <Link className="button secondary" to={user ? '/demandas/nova' : '/cadastro'}>
          Publicar uma demanda
        </Link>
      </div>
    ) : null
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
            <button className="text-button" onClick={clear}>
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
              {demandCta}
            </>
          ) : (
            <>
              <Empty title="Nenhum serviço encontrado">
                <p>Amplie a faixa de preço, tente outro termo ou limpe os filtros.</p>
                <button className="button secondary" onClick={clear}>
                  Limpar filtros
                </button>
              </Empty>
              {demandCta}
            </>
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
    specialties = useSpecialties(),
    s = services.find((x) => x.id === id)
  if (!s)
    return (
      <Empty title="Serviço não encontrado">
        <Link to="/servicos">Voltar à busca</Link>
      </Empty>
    )
  const seller = s.freelancer,
    own = user?.id === seller.id,
    canHire = !user || user.role === 'CLIENT',
    tags = specialties(seller),
    others = services.filter((x) => x.freelancer.id === seller.id && x.id !== s.id).slice(0, 3),
    firstName = seller.name.split(' ')[0]
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
          <ul className="detail-facts">
            <li>
              <MapPin size={16} aria-hidden="true" /> {seller.city || 'Localização não informada'}
            </li>
            <li>
              <Clock size={16} aria-hidden="true" /> {days(s.deliveryDays)} para execução
            </li>
          </ul>
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
        <aside className="detail-aside">
          <section className="panel booking-panel" aria-label="Contratação">
            <span className="booking-label">Valor estimado</span>
            <strong className="big-price">{money(s.price)}</strong>
            <p>
              {days(s.deliveryDays)} para execução · o valor final é combinado com o profissional
            </p>
            {canHire && (
              <>
                <Link className="button full" to={`/servicos/${s.id}/solicitar`}>
                  Solicitar serviço
                </Link>
                <FavoriteButton service={s} wide />
                <small>O profissional tem até 48 horas para responder.</small>
              </>
            )}
            {own && (
              <>
                <Link className="button secondary full" to={`/meus-servicos/${s.id}/editar`}>
                  Editar meu anúncio
                </Link>
                <small>É assim que os clientes veem seu anúncio.</small>
              </>
            )}
            {!canHire && !own && <small>Somente clientes solicitam e salvam serviços.</small>}
          </section>
          <section className="panel seller-card" aria-labelledby="seller-title">
            <h2 id="seller-title">Quem faz o serviço</h2>
            <div className="seller-head">
              <Avatar name={seller.name} large src={avatarUrl(seller.id, seller.avatarVersion)} />
              <div>
                <Link className="seller-name" to={`/profissionais/${seller.id}`}>
                  {seller.name}
                </Link>
                <span className="seller-city">
                  <MapPin size={13} aria-hidden="true" />
                  {seller.city || 'Localização não informada'}
                </span>
                <RatingSummary rating={seller.averageRating} count={seller.reviewCount} />
              </div>
            </div>
            {tags.length > 0 && (
              <ul className="chips" aria-label={`Especialidades de ${firstName}`}>
                {tags.map((t) => (
                  <li className="badge" key={t}>
                    {t}
                  </li>
                ))}
              </ul>
            )}
            <Link className="button secondary full" to={`/profissionais/${seller.id}`}>
              Ver perfil completo
            </Link>
          </section>
          {user && !own && user.role !== 'ADMIN' && (
            <Link
              className="subtle-link report-link"
              to={`/denunciar?type=SERVICE&id=${s.id}&alvo=${encodeURIComponent(s.title)}`}
            >
              <Flag size={14} aria-hidden="true" />
              Denunciar anúncio
            </Link>
          )}
        </aside>
      </div>
      {others.length > 0 && (
        <section className="related-services">
          <div className="section-head">
            <h2>Outros serviços de {firstName}</h2>
            <Link to={`/profissionais/${seller.id}`}>Ver todos no perfil</Link>
          </div>
          <ServiceGrid services={others} />
        </section>
      )}
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
  const { professionals, categories, services } = useApp(),
    specialties = useSpecialties(),
    [q, setQ] = useState(''),
    [city, setCity] = useState(''),
    [category, setCategory] = useState(''),
    [sort, setSort] = useState('rating'),
    [shown, setShown] = useState(PROFESSIONALS_PAGE)
  const term = q.trim().toLowerCase(),
    town = city.trim().toLowerCase()
  const list = professionals
    .map((p) => {
      const offers = services.filter((s) => s.freelancer.id === p.id)
      return {
        ...p,
        specialties: specialties(p),
        offers: offers.length,
        from: offers.length ? Math.min(...offers.map((s) => s.price)) : null,
      }
    })
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
        description="Conheça quem está por trás de cada serviço e veja onde cada profissional atende."
      />
      <div className="panel pro-filters">
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
      </div>
      <p className="meta" role="status">
        {list.length} {list.length === 1 ? 'profissional' : 'profissionais'}
      </p>
      <div className="pro-directory">
        {list.slice(0, shown).map((p) => (
          <article className="panel pro-card" key={p.id}>
            <div className="pro-card-head">
              <Avatar name={p.name} large src={avatarUrl(p.id, p.avatarVersion)} />
              <div>
                <h2>{p.name}</h2>
                <p className="pro-card-headline">{headline(p.specialties)}</p>
                <span className="pro-card-city">
                  <MapPin size={13} aria-hidden="true" />
                  {p.serviceArea
                    ? `Atende em ${p.serviceArea}`
                    : p.city || 'Localização não informada'}
                </span>
              </div>
            </div>
            {p.bio && <p className="pro-card-bio">{p.bio}</p>}
            <div className="pro-card-foot">
              <div className="pro-card-numbers">
                <RatingSummary rating={p.averageRating} count={p.reviewCount} />
                <span>
                  {p.offers
                    ? `${p.offers} ${p.offers === 1 ? 'serviço' : 'serviços'}${p.from !== null ? ` · a partir de ${money(p.from)}` : ''}`
                    : 'Nenhum serviço ativo'}
                </span>
              </div>
              <Link
                className="button secondary"
                to={`/profissionais/${p.id}`}
                aria-label={`Ver perfil de ${p.name}`}
              >
                Ver perfil
              </Link>
            </div>
          </article>
        ))}
      </div>
      {list.length > shown && (
        <button
          className="button secondary pro-more"
          onClick={() => setShown(shown + PROFESSIONALS_PAGE)}
        >
          Mostrar mais
        </button>
      )}
      {!list.length && <Empty title="Nenhum profissional com esses filtros" />}
    </>
  )
}
export function ProfileDetail() {
  const { id } = useParams(),
    { pathname } = useLocation(),
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
  const tags = specialties(p),
    offers = services.filter((s) => s.freelancer.id === p.id),
    from = offers.length ? Math.min(...offers.map((s) => s.price)) : null,
    own = user?.id === p.id,
    firstName = p.name.split(' ')[0],
    hasRating = typeof p.averageRating === 'number' && !!p.reviewCount
  const message = conversation && (
    <Link className="button secondary" to={`/mensagens?contratacao=${conversation.id}`}>
      Enviar mensagem
    </Link>
  )
  // What the viewer can do here depends on who is looking.
  let actions = null
  if (!user)
    actions = (
      <Link className="button" to="/login" state={{ from: pathname }}>
        Entrar para solicitar
      </Link>
    )
  else if (own)
    actions = (
      <>
        <Link className="button" to="/perfil/editar">
          Editar perfil
        </Link>
        <Link className="button secondary" to="/meus-servicos">
          Gerenciar serviços
        </Link>
      </>
    )
  else if (user.role === 'CLIENT')
    actions = (
      <>
        {offers.length === 1 ? (
          <Link className="button" to={`/servicos/${offers[0].id}/solicitar`}>
            Solicitar serviço
          </Link>
        ) : (
          offers.length > 1 && (
            <a className="button" href="#servicos-oferecidos">
              Solicitar serviço
            </a>
          )
        )}
        {message ||
          (offers.length > 0 && (
            <a className="button secondary" href="#servicos-oferecidos">
              Ver serviços
            </a>
          ))}
      </>
    )
  return (
    <>
      <section className="panel pro-header" aria-labelledby="pro-name">
        <div className="pro-cover" aria-hidden="true" />
        <div className="pro-header-body">
          <Avatar name={p.name} large src={avatarUrl(p.id, p.avatarVersion)} />
          <div className="pro-identity">
            <h1 id="pro-name">{p.name}</h1>
            <p className="pro-headline">{headline(tags)}</p>
            <p className="pro-place">
              <MapPin size={15} aria-hidden="true" />
              {p.city || 'Localização não informada'}
              {p.serviceArea && <span> · Atende em {p.serviceArea}</span>}
            </p>
          </div>
          {actions && <div className="pro-actions">{actions}</div>}
        </div>
        <dl className="pro-stats">
          <div>
            <dt>Serviços ativos</dt>
            <dd>{offers.length}</dd>
          </div>
          <div>
            <dt>Avaliações</dt>
            <dd>{p.reviewCount ?? 0}</dd>
          </div>
          <div>
            <dt>Nota média</dt>
            <dd>
              {hasRating ? (
                <>
                  {ratingLabel(p.averageRating as number)}{' '}
                  <Stars rating={p.averageRating as number} />
                </>
              ) : (
                <span className="pro-stat-empty">Ainda sem avaliações</span>
              )}
            </dd>
          </div>
        </dl>
      </section>
      <div className="pro-layout">
        <div className="pro-main">
          <section className="panel">
            <h2>Sobre o profissional</h2>
            <p className="pro-bio">
              {p.bio || 'O profissional ainda não escreveu sua apresentação.'}
            </p>
            {tags.length > 0 && (
              <>
                <h3>Especialidades</h3>
                <ul className="chips" aria-label="Especialidades">
                  {tags.map((s) => (
                    <li className="badge green" key={s}>
                      {s}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
          <section id="servicos-oferecidos" className="pro-services">
            <div className="section-head">
              <h2>Serviços oferecidos</h2>
              {offers.length > 0 && (
                <span className="meta">
                  {offers.length} {offers.length === 1 ? 'anúncio ativo' : 'anúncios ativos'}
                </span>
              )}
            </div>
            {offers.length ? (
              <ServiceGrid services={offers} />
            ) : (
              <p className="panel pro-none">
                {own
                  ? 'Você não tem anúncios ativos. Publique um serviço para aparecer aqui.'
                  : `${firstName} não tem serviços ativos no momento.`}
              </p>
            )}
          </section>
          <section className="panel">
            <div className="section-head">
              <h2>Avaliações</h2>
              {hasRating && <RatingSummary rating={p.averageRating} count={p.reviewCount} />}
            </div>
            <ReviewList reviews={reviews} />
          </section>
        </div>
        <aside className="pro-aside">
          <section className="panel" aria-labelledby="pro-hire">
            {own ? (
              <>
                <h2 id="pro-hire">Seu perfil público</h2>
                <p>
                  É assim que os clientes veem você. Uma boa apresentação e anúncios com fotos
                  ajudam na escolha.
                </p>
                <Link to="/meus-servicos/novo">Publicar um novo serviço</Link>
              </>
            ) : user && user.role !== 'CLIENT' ? (
              <>
                <h2 id="pro-hire">Contratação</h2>
                <p>Somente clientes solicitam serviços aos profissionais.</p>
              </>
            ) : (
              <>
                <h2 id="pro-hire">Como contratar {firstName}</h2>
                <ol className="pro-hire-steps">
                  <li>Escolha um dos serviços oferecidos.</li>
                  <li>Descreva o que precisa e sugira uma data.</li>
                  <li>O profissional responde em até 48 horas.</li>
                </ol>
                {user && (
                  <p className="pro-hire-alt">
                    Precisa de algo diferente? <Link to="/demandas/nova">Publique uma demanda</Link>{' '}
                    e receba propostas.
                  </p>
                )}
              </>
            )}
          </section>
          <section className="panel" aria-labelledby="pro-facts">
            <h2 id="pro-facts">Informações</h2>
            <ul className="pro-facts">
              <li>
                <MapPin size={16} aria-hidden="true" />
                <span>
                  <small>Cidade</small>
                  {p.city || 'Não informada'}
                </span>
              </li>
              {p.serviceArea && (
                <li>
                  <BadgeCheck size={16} aria-hidden="true" />
                  <span>
                    <small>Atende em</small>
                    {p.serviceArea}
                  </span>
                </li>
              )}
              {from !== null && (
                <li>
                  <Wrench size={16} aria-hidden="true" />
                  <span>
                    <small>Serviços a partir de</small>
                    {money(from)}
                  </span>
                </li>
              )}
              {p.memberSince && (
                <li>
                  <CalendarDays size={16} aria-hidden="true" />
                  <span>
                    <small>Na plataforma desde</small>
                    {monthYear(p.memberSince)}
                  </span>
                </li>
              )}
            </ul>
          </section>
        </aside>
      </div>
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
