import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { CheckCircle2, Plus, ArrowRight } from 'lucide-react'
import { useApp } from '../../app/store'
import { client } from '../../data/client'
import {
  Avatar,
  Empty,
  ErrorMessage,
  Field,
  PageTitle,
  ServiceGrid,
  SimulationNotice,
} from '../../components/ui'
import { money, statusLabel } from '../../domain/rules'
import type { Service } from '../../domain/types'

export function EditProfile() {
  const { user, updateUser, refresh } = useApp(),
    navigate = useNavigate(),
    { pathname } = useLocation()
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  if (!user) return null
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!user) return
    const d = new FormData(e.currentTarget)
    setBusy(true)
    setError('')
    try {
      const u = await client.updateProfile({
        ...user,
        name: String(d.get('name')),
        phone: String(d.get('phone')),
        city: String(d.get('city')),
        bio: String(d.get('bio')),
      })
      updateUser(u)
      await refresh()
      navigate('/inicio')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <PageTitle
        title={pathname.endsWith('completar') ? 'Vamos completar seu perfil' : 'Editar meu perfil'}
        description="Conte um pouco sobre você e onde está."
      />
      <form className="form-panel" onSubmit={submit}>
        <div className="person">
          <Avatar name={user.name} large />
          <div>
            <strong>{user.name}</strong>
            <small>Foto de perfil será definida depois. Usamos suas iniciais por enquanto.</small>
          </div>
        </div>
        <Field
          label="Nome completo"
          name="name"
          required
          maxLength={100}
          defaultValue={user.name}
        />
        <Field
          label="E-mail"
          type="email"
          value={user.email}
          readOnly
          hint="O e-mail identifica sua conta e não pode ser alterado aqui."
        />
        <Field
          label="Telefone"
          name="phone"
          required
          pattern={'\\+?[0-9 \\(\\)\\-]{10,20}'}
          defaultValue={user.phone}
        />
        <Field
          label="Cidade e UF"
          name="city"
          required
          maxLength={100}
          defaultValue={user.city}
          placeholder="Taguatinga, DF"
        />
        <label className="field">
          <span>{user.role === 'FREELANCER' ? 'Descrição profissional' : 'Sobre você'}</span>
          <textarea name="bio" maxLength={600} rows={4} defaultValue={user.bio} />
        </label>
        <ErrorMessage message={error} />
        <div className="row">
          <Link to="/inicio" className="button secondary">
            Cancelar
          </Link>
          <button className="button" disabled={busy}>
            {busy ? 'Salvando…' : 'Salvar perfil'}
          </button>
        </div>
      </form>
    </>
  )
}
export function OwnProfile() {
  const { user } = useApp()
  if (!user) return null
  return (
    <>
      <div className="panel profile-cover">
        <Avatar name={user.name} large />
        <div>
          <h1>{user.name}</h1>
          <p>{user.city || 'Localização não informada'}</p>
        </div>
        <Link className="button secondary" to="/perfil/editar">
          Editar perfil
        </Link>
      </div>
      <section className="panel">
        <h2>Sobre você</h2>
        <p>{user.bio || 'Complete seu perfil para contar um pouco sobre você.'}</p>
        <p>
          Tipo de conta:{' '}
          {user.role === 'CLIENT'
            ? 'Cliente'
            : user.role === 'FREELANCER'
              ? 'Freelancer'
              : 'Administrador'}
        </p>
      </section>
    </>
  )
}
export function Dashboard() {
  const { user, services, contracts } = useApp(),
    [mine, setMine] = useState<Service[]>([]),
    [error, setError] = useState('')
  useEffect(() => {
    if (user?.role === 'FREELANCER')
      void client
        .mine(user)
        .then(setMine)
        .catch((e) => setError(e.message))
  }, [user])
  if (!user) return null
  const own = contracts.filter((c) =>
    user.role === 'CLIENT' ? c.clientId === user.id : c.freelancerId === user.id,
  )
  return (
    <>
      <PageTitle
        title={`Olá, ${user.name.split(' ')[0]}.`}
        description={
          user.role === 'CLIENT'
            ? 'O que vamos resolver hoje?'
            : 'Seu trabalho e suas próximas oportunidades.'
        }
        action={
          <Link
            className="button"
            to={user.role === 'CLIENT' ? '/demandas/nova' : '/meus-servicos/novo'}
          >
            <Plus size={18} />
            {user.role === 'CLIENT' ? 'Publicar demanda' : 'Adicionar serviço'}
          </Link>
        }
      />
      <ErrorMessage message={error} />
      <div className="stats">
        <div>
          <span>{user.role === 'CLIENT' ? 'Contratações' : 'Serviços ativos'}</span>
          <strong>
            {user.role === 'CLIENT' ? own.length : mine.filter((s) => s.status === 'ACTIVE').length}
          </strong>
          <small>
            {user.role === 'CLIENT'
              ? 'no seu histórico de demonstração'
              : 'limite de 20 anúncios ativos'}
          </small>
        </div>
        <div>
          <span>Em andamento</span>
          <strong>{own.filter((c) => c.status === 'EM_ANDAMENTO').length}</strong>
          <small>serviços em execução na demonstração</small>
        </div>
        <div>
          <span>Aguardando resposta</span>
          <strong>{own.filter((c) => c.status === 'PENDENTE').length}</strong>
          <small>prazo de até 48 horas</small>
        </div>
      </div>
      <SimulationNotice />
      <div className="dashboard-grid">
        <section className="panel">
          <div className="row between">
            <h2>Acompanhe suas contratações</h2>
            <Link to="/contratacoes">Ver todas</Link>
          </div>
          {own.slice(0, 3).map((c) => (
            <div className="activity-row" key={c.id}>
              <span className="activity-dot" />
              <div>
                <strong>{c.title}</strong>
                <small>
                  {user.role === 'CLIENT' ? c.freelancerName : c.clientName} · {money(c.price)}
                </small>
              </div>
              <Link to={`/contratacoes/${c.id}`} className="badge">
                {statusLabel[c.status]} <ArrowRight size={13} />
              </Link>
            </div>
          ))}
          {!own.length && (
            <Empty title="Seu próximo serviço começa aqui">
              <Link to="/servicos">Encontrar um profissional</Link>
            </Empty>
          )}
        </section>
        <aside className="panel tip-panel">
          <CheckCircle2 size={28} />
          <h2>Tudo combinado, tudo registrado.</h2>
          <p>Descreva o que precisa, confirme a data e acompanhe cada mudança de status.</p>
          <Link to="/ajuda">Conhecer as regras</Link>
        </aside>
      </div>
      <PageTitle
        title={user.role === 'FREELANCER' ? 'Oportunidades para você' : 'Explore serviços'}
        description="Serviços e profissionais da plataforma."
        action={<Link to={user.role === 'FREELANCER' ? '/demandas' : '/servicos'}>Ver mais</Link>}
      />
      <ServiceGrid services={services.slice(0, 3)} />
    </>
  )
}
