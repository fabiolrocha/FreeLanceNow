import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { CheckCircle2, Plus, ArrowRight } from 'lucide-react'
import { useApp } from '../../app/store'
import { GoogleButton } from '../auth/google-button'
import type { GoogleCredential } from '../../domain/types'
import { avatarUrl, client, googleClientId, isMock } from '../../data/client'
import { useReviews } from '../../app/useReviews'
import { useFavorites } from '../../data/favorites'
import { loadSession } from '../../data/session'
import {
  Avatar,
  ConfirmButton,
  Empty,
  ErrorMessage,
  Field,
  NewPasswordFields,
  PageTitle,
  ReviewList,
  ServiceGrid,
  Stars,
} from '../../components/ui'
import {
  checkNewPassword,
  compatibleDemands,
  dateLabel,
  money,
  reportStatusLabel,
  statusLabel,
  pendingActions,
  ratingLabel,
  statusTone,
} from '../../domain/rules'
import type { OwnReport, Service } from '../../domain/types'

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
        serviceArea: String(d.get('serviceArea') ?? user.serviceArea ?? ''),
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
        <AvatarField />
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
        {user.role === 'FREELANCER' && (
          <Field
            label="Área de atendimento"
            name="serviceArea"
            maxLength={150}
            defaultValue={user.serviceArea}
            placeholder="Taguatinga, Ceilândia e Águas Claras"
            hint="Bairros ou cidades onde você atende. Aparece no seu perfil público."
          />
        )}
        <label className="field">
          <span>{user.role === 'FREELANCER' ? 'Descrição profissional' : 'Sobre você'}</span>
          <textarea
            name="bio"
            maxLength={600}
            rows={4}
            defaultValue={user.bio}
            placeholder={
              user.role === 'FREELANCER'
                ? 'Experiência, especialidades, garantia que oferece.'
                : 'Conte um pouco sobre você para os profissionais.'
            }
          />
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
      {!pathname.endsWith('completar') && (
        <>
          {!isMock && user.role !== 'ADMIN' && <EmailNotices />}
          <ChangePassword />
          {user.role !== 'ADMIN' && <DeleteAccount />}
        </>
      )}
    </>
  )
}
const MAX_AVATAR = 2 * 1024 * 1024
function AvatarField() {
  const { user, updateUser, notify } = useApp(),
    input = useRef<HTMLInputElement>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  if (!user) return null
  async function change(work: () => Promise<typeof user>, done: string) {
    setBusy(true)
    setError('')
    try {
      const u = await work()
      if (u) updateUser({ ...user!, ...u })
      notify(done)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }
  function pick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png'].includes(file.type))
      return setError('Envie uma foto JPG ou PNG.')
    if (file.size > MAX_AVATAR) return setError('A foto deve ter até 2 MB.')
    void change(() => client.uploadAvatar(file), 'Foto atualizada.')
  }
  const src = avatarUrl(user.id, user.avatarVersion)
  return (
    <div className="avatar-field">
      <Avatar name={user.name} large src={src} />
      <div>
        <strong>{user.name}</strong>
        <small>
          {isMock
            ? 'Na demonstração o perfil mostra suas iniciais.'
            : 'Foto JPG ou PNG de até 2 MB. Sem foto, o perfil mostra suas iniciais.'}
        </small>
        {!isMock && (
          <div className="row">
            <label className="button secondary">
              {busy ? 'Enviando…' : src ? 'Trocar foto' : 'Enviar foto'}
              <input
                ref={input}
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png"
                disabled={busy}
                onChange={pick}
              />
            </label>
            {src && (
              <button
                type="button"
                className="text-button"
                disabled={busy}
                onClick={() => void change(() => client.deleteAvatar(), 'Foto removida.')}
              >
                Remover foto
              </button>
            )}
          </div>
        )}
        <ErrorMessage message={error} />
      </div>
    </div>
  )
}
function DeleteAccount() {
  const { user, signOut, notify } = useApp(),
    navigate = useNavigate(),
    [password, setPassword] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [confirmingGoogle, setConfirmingGoogle] = useState(false)
  const canUseGoogle = Boolean(googleClientId && user?.googleLinked)
  const deleting = useRef(false)
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  async function remove(proof?: GoogleCredential) {
    if (!user || deleting.current) return
    deleting.current = true
    setBusy(true)
    setError('')
    try {
      if (proof) await client.deleteAccountWithGoogle(proof)
      else await client.deleteAccount(user, password)
      if (loadSession()?.user.id !== user.id) return
      signOut()
      if (mounted.current) {
        navigate('/')
        notify('Sua conta foi excluída.')
      }
    } catch (e) {
      if (mounted.current) setError((e as Error).message)
    } finally {
      deleting.current = false
      if (mounted.current) setBusy(false)
    }
  }
  return (
    <section className="form-panel danger-zone" aria-labelledby="delete-title">
      <h2 id="delete-title">Excluir conta</h2>
      <p>
        Seus dados pessoais são apagados e o histórico de contratações fica anônimo para a outra
        parte. Contratações em aberto precisam ser concluídas ou canceladas antes.
        {user?.role === 'FREELANCER'
          ? ' Seus anúncios saem do ar e as propostas pendentes são retiradas.'
          : ' Suas demandas abertas são canceladas.'}
      </p>
      <Field
        label="Confirme com sua senha"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        maxLength={72}
        autoComplete="current-password"
      />
      {canUseGoogle && (
        <Link className="subtle-link" to="/recuperar-senha">
          Definir ou recuperar senha
        </Link>
      )}
      <ErrorMessage message={error} />
      <div className="row">
        <ConfirmButton
          className="button danger"
          disabled={busy || !password}
          label={busy ? 'Excluindo…' : 'Excluir minha conta'}
          title="Excluir sua conta?"
          message="Esta ação é permanente. Você será desconectado após a exclusão."
          confirmLabel="Sim, excluir conta"
          danger
          onConfirm={() => void remove()}
        />
        {canUseGoogle && !confirmingGoogle && (
          <ConfirmButton
            className="button secondary"
            disabled={busy}
            label="Excluir com Google"
            title="Excluir sua conta?"
            message="Esta ação é permanente. Confirme a exclusão com a conta Google vinculada."
            confirmLabel="Prosseguir com Google"
            danger
            onConfirm={() => {
              setError('')
              setConfirmingGoogle(true)
            }}
          />
        )}
      </div>
      {canUseGoogle && confirmingGoogle && (
        <div className="google-auth">
          <p>Confirme com a conta Google vinculada para excluir sua conta do FreeLanceNow.</p>
          <div hidden={busy}>
            <GoogleButton forDeletion onCredential={(proof) => void remove(proof)} />
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                setError('')
                setConfirmingGoogle(false)
              }}
            >
              Cancelar exclusão
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
/** Listings the client saved, newest first. Listings taken down disappear from the list. */
export function SavedServices() {
  const { user, services } = useApp(),
    { ids } = useFavorites(user?.id)
  const saved = ids.flatMap((id) => services.filter((s) => s.id === id))
  return (
    <>
      <PageTitle
        title="Serviços salvos"
        description="Os anúncios que você salvou para comparar ou contratar depois."
      />
      {saved.length ? (
        <ServiceGrid services={saved} />
      ) : (
        <Empty title="Nenhum serviço salvo">
          <p>Toque no coração de um anúncio para guardá-lo aqui.</p>
          <Link className="button" to="/servicos">
            Buscar serviços
          </Link>
        </Empty>
      )}
    </>
  )
}
export function MyReports() {
  const { user } = useApp(),
    [items, setItems] = useState<OwnReport[] | null>(null),
    [error, setError] = useState('')
  useEffect(() => {
    if (user)
      void client
        .myReports(user)
        .then(setItems)
        .catch((e) => setError(e.message))
  }, [user])
  return (
    <>
      <PageTitle
        title="Minhas denúncias"
        description="Acompanhe a análise da moderação sobre o que você denunciou."
      />
      <ErrorMessage message={error} />
      {items === null && !error && (
        <p role="status" className="loading">
          Carregando denúncias…
        </p>
      )}
      <div className="stack">
        {items?.map((r) => (
          <article className="panel" key={r.id}>
            <span className={`badge status ${statusTone(r.status)}`}>
              {reportStatusLabel[r.status]}
            </span>
            <h2>{r.targetTitle}</h2>
            <p className="meta">
              {r.targetType === 'SERVICE'
                ? 'Anúncio'
                : r.targetType === 'REVIEW'
                  ? 'Avaliação'
                  : 'Publicação'}{' '}
              · {r.reason}
              {r.createdAt && ` · enviada em ${dateLabel(r.createdAt)}`}
            </p>
            <p>{r.comment}</p>
            {r.decisionNote && (
              <p className="review-reply">Resposta da moderação: {r.decisionNote}</p>
            )}
          </article>
        ))}
      </div>
      {items?.length === 0 && (
        <Empty title="Você não fez denúncias">
          <p>
            Viu um anúncio, avaliação ou publicação que viola as regras? Use o link “Denunciar” no
            próprio conteúdo.
          </p>
          <Link to="/ajuda">Ver as regras da plataforma</Link>
        </Empty>
      )}
    </>
  )
}
/** Turns the e-mail copies of important notices on or off; chat messages stay in the app. */
function EmailNotices() {
  const { user, updateUser, notify } = useApp()
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  if (!user) return null
  const on = user.emailNotifications !== false
  async function toggle() {
    setBusy(true)
    setError('')
    try {
      updateUser(await client.notificationSettings(!on))
      notify(on ? 'Avisos por e-mail desligados.' : 'Avisos por e-mail ligados.')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="form-panel" aria-labelledby="notices-title">
      <h2 id="notices-title">Avisos por e-mail</h2>
      <p>
        Receba por e-mail as novas solicitações, propostas, mudanças nas contratações, prazos e
        avaliações. As mensagens do chat ficam só no aplicativo.
        {user.emailVerified === false &&
          ' Os e-mails começam depois que você confirmar seu endereço.'}
      </p>
      <label className="check">
        <input type="checkbox" checked={on} disabled={busy} onChange={() => void toggle()} />
        <span>Enviar avisos para {user.email}</span>
      </label>
      <ErrorMessage message={error} />
    </section>
  )
}
function ChangePassword() {
  const { user, signIn, notify } = useApp()
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!user) return
    const form = e.currentTarget,
      d = new FormData(form),
      invalid = checkNewPassword(d)
    if (invalid) return setError(invalid)
    setBusy(true)
    setError('')
    try {
      // The API answers with a new session because older refresh tokens stop working.
      signIn(await client.changePassword(user, String(d.get('current')), String(d.get('password'))))
      form.reset()
      notify('Senha alterada.')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <form className="form-panel" onSubmit={submit} aria-labelledby="security-title">
      <h2 id="security-title">Segurança</h2>
      <p>Troque sua senha. Outros aparelhos conectados serão desconectados em até 15 minutos.</p>
      <Field
        label="Senha atual"
        name="current"
        type="password"
        required
        maxLength={72}
        autoComplete="current-password"
      />
      <NewPasswordFields />
      <ErrorMessage message={error} />
      <button className="button" disabled={busy}>
        {busy ? 'Alterando…' : 'Alterar senha'}
      </button>
    </form>
  )
}
const activeStatuses = ['ACEITO', 'EM_ANDAMENTO', 'AGUARDANDO_CONFIRMACAO']
export function OwnProfile() {
  const { user, contracts } = useApp(),
    received = useReviews('freelancer', user?.role === 'FREELANCER' ? user.id : undefined)
  if (!user) return null
  const own = contracts.filter((c) =>
    user.role === 'CLIENT' ? c.clientId === user.id : c.freelancerId === user.id,
  )
  const done = own.filter((c) => c.status === 'CONCLUIDO')
  const given = own.filter((c) => typeof c.rating === 'number')
  const average = received.length
    ? ratingLabel(received.reduce((a, r) => a + r.rating, 0) / received.length)
    : null
  return (
    <>
      <div className="panel profile-cover">
        <Avatar name={user.name} large src={avatarUrl(user.id, user.avatarVersion)} />
        <div>
          <h1>{user.name}</h1>
          <p className="profile-role">
            {user.role === 'CLIENT'
              ? 'Cliente · contrata serviços e publica demandas'
              : user.role === 'FREELANCER'
                ? `Profissional${user.specialties?.length ? ` · ${user.specialties.join(', ')}` : ''}`
                : 'Administração'}
          </p>
          <p>{user.city || 'Localização não informada'}</p>
          {user.role === 'FREELANCER' && user.serviceArea && (
            <p className="meta">Atende em {user.serviceArea}</p>
          )}
        </div>
        <div className="row">
          {user.role === 'FREELANCER' && (
            <Link className="button secondary" to={`/profissionais/${user.id}`}>
              Ver perfil público
            </Link>
          )}
          <Link className="button secondary" to="/perfil/editar">
            Editar perfil
          </Link>
        </div>
      </div>
      <section className="panel">
        <h2>Sobre você</h2>
        <p>
          {user.bio ||
            (user.role === 'FREELANCER'
              ? 'Conte sua experiência e o que você faz: é o que os clientes leem antes de contratar.'
              : 'Complete seu perfil para contar um pouco sobre você.')}
        </p>
      </section>
      {user.role !== 'ADMIN' && (
        <section className="panel">
          <h2>Seus números</h2>
          <div className="profile-stats">
            <div>
              <strong>{own.length}</strong>
              <span>contratações</span>
            </div>
            <div>
              <strong>{own.filter((c) => activeStatuses.includes(c.status)).length}</strong>
              <span>em andamento</span>
            </div>
            <div>
              <strong>{done.length}</strong>
              <span>concluídas</span>
            </div>
            {user.role === 'FREELANCER' ? (
              <div>
                <strong>{average ? `★ ${average}` : '—'}</strong>
                <span>
                  {received.length} {received.length === 1 ? 'avaliação' : 'avaliações'}
                </span>
              </div>
            ) : (
              <div>
                <strong>{given.length}</strong>
                <span>avaliações enviadas</span>
              </div>
            )}
          </div>
          <Link to="/contratacoes">Ver contratações</Link>
        </section>
      )}
      {user.role === 'FREELANCER' && (
        <section className="panel">
          <h2>Avaliações recebidas</h2>
          <ReviewList reviews={received} />
        </section>
      )}
      {user.role === 'CLIENT' && given.length > 0 && (
        <section className="panel">
          <h2>Avaliações que você enviou</h2>
          {given.map((c) => (
            <div className="review" key={c.id}>
              <strong>
                <Stars rating={c.rating!} /> {c.rating} de 5 · {c.freelancerName}
              </strong>
              <p>{c.review || 'Sem comentário.'}</p>
              {c.reviewReply && (
                <p className="review-reply">Resposta do profissional: {c.reviewReply}</p>
              )}
              <Link to={`/contratacoes/${c.id}`}>{c.title}</Link>
            </div>
          ))}
        </section>
      )}
      {user.role !== 'ADMIN' && (
        <section className="panel">
          <h2>Conta</h2>
          <div className="row">
            <Link to="/perfil/editar">Configurações da conta</Link>
            <Link to="/denuncias">Minhas denúncias</Link>
          </div>
        </section>
      )}
    </>
  )
}
export function Dashboard() {
  const { user, services, contracts, demands, proposals } = useApp(),
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
  const actions = pendingActions(user, contracts, demands, proposals)
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
            {user.role === 'CLIENT' ? 'no seu histórico' : 'limite de 20 anúncios ativos'}
          </small>
        </div>
        <div>
          <span>Em andamento</span>
          <strong>{own.filter((c) => activeStatuses.includes(c.status)).length}</strong>
          <small>aceitas, em execução ou aguardando confirmação</small>
        </div>
        <div>
          <span>{user.role === 'CLIENT' ? 'Aguardando resposta' : 'Solicitações novas'}</span>
          <strong>{own.filter((c) => c.status === 'PENDENTE').length}</strong>
          <small>
            {user.role === 'CLIENT'
              ? 'o profissional tem até 48 horas'
              : 'responda em até 48 horas'}
          </small>
        </div>
        {user.role === 'FREELANCER' && (
          <div>
            <span>Propostas pendentes</span>
            <strong>
              {proposals.filter((p) => p.freelancerId === user.id && p.status === 'PENDING').length}
            </strong>
            <small>
              <Link to="/propostas">aguardando o cliente</Link>
            </small>
          </div>
        )}
      </div>
      <section className="panel">
        <h2>Precisa da sua ação</h2>
        {actions.length ? (
          actions.slice(0, 6).map((a) => (
            <div className="activity-row" key={a.key}>
              <span className="activity-dot" />
              <div>
                <strong>{a.title}</strong>
                <small>{a.label}</small>
              </div>
              <Link to={a.to} className="badge">
                Abrir <ArrowRight size={13} />
              </Link>
            </div>
          ))
        ) : (
          <p className="meta">
            {user.role === 'CLIENT'
              ? 'Nada aguardando você. Confirmações, avaliações e novas propostas aparecem aqui.'
              : 'Nada aguardando você. Novas solicitações de clientes aparecem aqui.'}
          </p>
        )}
      </section>
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
              <Link to={`/contratacoes/${c.id}`} className={`badge status ${statusTone(c.status)}`}>
                {statusLabel[c.status]} <ArrowRight size={13} />
              </Link>
            </div>
          ))}
          {!own.length &&
            (user.role === 'CLIENT' ? (
              <Empty title="Seu próximo serviço começa aqui">
                <Link to="/servicos">Encontrar um profissional</Link>
              </Empty>
            ) : (
              <Empty title="Nenhuma contratação ainda">
                <p>Publique serviços e envie propostas para as demandas abertas.</p>
                <Link to="/demandas">Ver demandas abertas</Link>
              </Empty>
            ))}
        </section>
        <aside className="panel tip-panel">
          <CheckCircle2 size={28} />
          {user.role === 'CLIENT' ? (
            <>
              <h2>Tudo combinado, tudo registrado.</h2>
              <p>Descreva o que precisa, confirme a data e acompanhe cada mudança de status.</p>
            </>
          ) : (
            <>
              <h2>Responda rápido, conquiste avaliações.</h2>
              <p>
                Aceite ou recuse solicitações em até 48 horas, marque a conclusão com uma observação
                e mantenha sua área de atendimento atualizada.
              </p>
            </>
          )}
          <Link to="/ajuda">Conhecer as regras</Link>
        </aside>
      </div>
      {user.role === 'FREELANCER' ? (
        <FreelancerOpportunities
          demands={compatibleDemands(
            demands,
            proposals,
            user.id,
            [...new Set(mine.map((s) => s.category.id))],
            user.city,
          ).slice(0, 3)}
        />
      ) : (
        <>
          <PageTitle
            title="Explore serviços"
            description="Profissionais avaliados perto de você."
            action={<Link to="/servicos">Ver mais</Link>}
          />
          <ServiceGrid services={services.slice(0, 3)} />
        </>
      )}
    </>
  )
}
function FreelancerOpportunities({ demands }: { demands: ReturnType<typeof compatibleDemands> }) {
  return (
    <>
      <PageTitle
        title="Demandas para você"
        description="Pedidos abertos nas suas categorias e na sua cidade aparecem primeiro."
        action={<Link to="/demandas">Ver todas</Link>}
      />
      <div className="stack">
        {demands.map((d) => (
          <article className="panel" key={d.id}>
            <h2>{d.title}</h2>
            <p className="meta">
              {money(d.budget)} · {d.days} {d.days === 1 ? 'dia' : 'dias'} · {d.city}
            </p>
            <Link to={`/demandas/${d.id}`}>Ver demanda e enviar proposta</Link>
          </article>
        ))}
      </div>
      {!demands.length && (
        <Empty title="Nenhuma demanda nova agora">
          <p>Você já respondeu às demandas abertas. Avisamos quando chegar um pedido novo.</p>
        </Empty>
      )}
    </>
  )
}
