import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowRight, Search, MapPin, Check, Wrench } from 'lucide-react'
import { useApp } from '../../app/store'
import { Avatar, CategoryIcon, Empty, PageTitle, ServiceGrid } from '../../components/ui'
import { money } from '../../domain/rules'

export function Landing() {
  const { categories, services } = useApp()
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
          <div className="hero-service">
            <div className="tool-tile">
              <Wrench size={65} strokeWidth={1.3} />
            </div>
            <div>
              <span>Serviço em destaque</span>
              <h2>Instalação de chuveiro elétrico</h2>
              <p>Elétrica residencial</p>
            </div>
          </div>
          <div className="board-person">
            <Avatar name="Marcos Vieira" large />
            <div>
              <strong>Marcos Vieira</strong>
              <p>Eletricista · Taguatinga, DF</p>
            </div>
            <span className="badge">Demonstração</span>
          </div>
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
        <ServiceGrid services={services.slice(0, 3)} />
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
export function SearchServices() {
  const { services, categories } = useApp(),
    [params, setParams] = useSearchParams()
  const [maxPrice, setMaxPrice] = useState(''),
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
        (!city ||
          s.freelancer.city.toLocaleLowerCase('pt-BR').includes(city.toLocaleLowerCase('pt-BR'))),
    )
    .sort((a, b) => (sort === 'price' ? a.price - b.price : 0))
  function change(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
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
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="Sem limite"
            />
          </label>
          <label className="field">
            <span>Localização</span>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
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
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="recent">Mais recentes</option>
              <option value="price">Menor preço</option>
            </select>
          </div>
          <p className="result-count">
            {filtered.length}{' '}
            {filtered.length === 1 ? 'serviço encontrado' : 'serviços encontrados'}
          </p>
          {filtered.length ? (
            <ServiceGrid services={filtered} />
          ) : (
            <Empty title="Nenhum serviço encontrado">
              <p>Amplie a faixa de preço, tente outro termo ou limpe os filtros.</p>
              <button
                className="button secondary"
                onClick={() => {
                  setParams({})
                  setCity('')
                  setMaxPrice('')
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
    { services } = useApp(),
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
          <div className={`detail-visual ${s.category.slug}`}>
            <CategoryIcon slug={s.category.slug} size={90} />
            <span>Fotos deste serviço serão definidas pelo grupo.</span>
          </div>
          <small className="category-text">{s.category.name}</small>
          <h1>{s.title}</h1>
          <p>
            <MapPin size={16} /> {s.freelancer.city}
          </p>
          <h2>Sobre o serviço</h2>
          <p>{s.description}</p>
          <h2>Antes de contratar</h2>
          <p>Confirme o escopo, os materiais necessários e a disponibilidade com o profissional.</p>
        </article>
        <aside className="panel booking-panel">
          <strong className="big-price">{money(s.price)}</strong>
          <p>
            Valor estimado · {s.deliveryDays} {s.deliveryDays === 1 ? 'dia' : 'dias'} para execução
          </p>
          <Link className="button full" to={`/servicos/${s.id}/solicitar`}>
            Solicitar serviço
          </Link>
          <small>O profissional tem até 48 horas para responder.</small>
          <hr />
          <div className="person">
            <Avatar name={s.freelancer.name} />
            <div>
              <strong>{s.freelancer.name}</strong>
              <p>{s.freelancer.city}</p>
            </div>
          </div>
          <Link to={`/profissionais/${s.freelancer.id}`}>Ver perfil completo</Link>
          <Link className="subtle-link" to={`/denunciar?alvo=${encodeURIComponent(s.title)}`}>
            Denunciar anúncio
          </Link>
        </aside>
      </div>
    </>
  )
}
export function Professionals() {
  const { professionals } = useApp(),
    [q, setQ] = useState('')
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
          placeholder="Nome, especialidade ou cidade"
        />
      </label>
      <div className="professional-list">
        {professionals
          .filter((p) => `${p.name} ${p.city} ${p.bio}`.toLowerCase().includes(q.toLowerCase()))
          .map((p) => (
            <article className="panel professional-row" key={p.id}>
              <Avatar name={p.name} large />
              <div>
                <h2>{p.name}</h2>
                <p>{p.bio}</p>
                <small>
                  <MapPin size={14} /> {p.city}
                </small>
              </div>
              <Link className="button secondary" to={`/profissionais/${p.id}`}>
                Ver perfil
              </Link>
            </article>
          ))}
      </div>
    </>
  )
}
export function ProfileDetail() {
  const { id } = useParams(),
    { professionals, services, contracts } = useApp(),
    p = professionals.find((x) => x.id === id)
  if (!p) return <Empty title="Profissional não encontrado" />
  const reviews = contracts.filter((c) => c.freelancerId === p.id && c.rating)
  return (
    <>
      <div className="panel profile-cover">
        <Avatar name={p.name} large />
        <div>
          <h1>{p.name}</h1>
          <p>
            <MapPin size={16} /> {p.city}
          </p>
        </div>
        <Link className="button secondary" to="/mensagens">
          Enviar mensagem
        </Link>
      </div>
      <section className="panel">
        <h2>Sobre o profissional</h2>
        <p>{p.bio}</p>
      </section>
      <PageTitle title="Serviços oferecidos" />
      <ServiceGrid services={services.filter((s) => s.freelancer.id === p.id)} />
      <section className="panel">
        <h2>Avaliações</h2>
        {reviews.length ? (
          reviews.map((c) => (
            <div className="review" key={c.id}>
              <strong>
                {c.rating} de 5 · {c.clientName}
              </strong>
              <p>{c.review || 'Sem comentário.'}</p>
              <small>Contratação concluída na demonstração</small>
            </div>
          ))
        ) : (
          <p>Ainda não há avaliações registradas nesta versão.</p>
        )}
      </section>
    </>
  )
}
