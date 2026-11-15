import { describe, expect, it } from 'vitest'
import {
  canEditDemand,
  canReview,
  compatibleDemands,
  canTransition,
  contractDeadline,
  imageSelectionError,
  MAX_IMAGE_BYTES,
  pendingActions,
  safeRedirect,
  validPassword,
} from './rules'
import { usable } from '../data/session'
describe('Prazos exibidos na contratação (F02/F03)', () => {
  const at = '2026-11-01T12:00:00.000Z'
  it('segue os jobs de 48h, 5 dias e a janela de 7 dias da avaliação', () => {
    expect(
      contractDeadline({ status: 'PENDENTE', history: [{ status: 'PENDENTE', at }] })?.at,
    ).toBe('2026-11-03T12:00:00.000Z')
    expect(
      contractDeadline({
        status: 'AGUARDANDO_CONFIRMACAO',
        history: [{ status: 'AGUARDANDO_CONFIRMACAO', at }],
      })?.at,
    ).toBe('2026-11-06T12:00:00.000Z')
    expect(contractDeadline({ status: 'CONCLUIDO', history: [], completedAt: at })?.at).toBe(
      '2026-11-08T12:00:00.000Z',
    )
    expect(
      contractDeadline({ status: 'CONCLUIDO', history: [], completedAt: at, rating: 5 }),
    ).toBeNull()
    expect(
      contractDeadline({ status: 'EM_ANDAMENTO', history: [{ status: 'EM_ANDAMENTO', at }] }),
    ).toBeNull()
  })
})
describe('Permissões e sequência da contratação (UC06)', () => {
  it('permite somente o responsável de cada etapa', () => {
    expect(canTransition('PENDENTE', 'ACEITO', 'FREELANCER')).toBe(true)
    expect(canTransition('PENDENTE', 'ACEITO', 'CLIENT')).toBe(false)
    expect(canTransition('EM_ANDAMENTO', 'CONCLUIDO', 'FREELANCER')).toBe(false)
    expect(canTransition('AGUARDANDO_CONFIRMACAO', 'CONCLUIDO', 'CLIENT')).toBe(true)
    expect(canTransition('EM_DISPUTA', 'CONCLUIDO', 'ADMIN')).toBe(true)
    expect(canTransition('EM_DISPUTA', 'CONCLUIDO', 'CLIENT')).toBe(false)
    expect(canTransition('CONCLUIDO', 'EM_ANDAMENTO', 'ADMIN')).toBe(false)
  })
  it('permite cancelar até o início e, depois, apenas abrir disputa', () => {
    expect(canTransition('ACEITO', 'CANCELADO', 'CLIENT')).toBe(true)
    expect(canTransition('ACEITO', 'CANCELADO', 'FREELANCER')).toBe(true)
    expect(canTransition('EM_ANDAMENTO', 'CANCELADO', 'CLIENT')).toBe(false)
    expect(canTransition('EM_ANDAMENTO', 'EM_DISPUTA', 'CLIENT')).toBe(true)
    expect(canTransition('EM_ANDAMENTO', 'EM_DISPUTA', 'FREELANCER')).toBe(true)
    expect(canTransition('EM_DISPUTA', 'CANCELADO', 'ADMIN')).toBe(true)
  })
})
describe('Janela de avaliação (UC04)', () => {
  const at = '2026-09-30T12:00:00Z',
    t = Date.parse(at)
  it('aceita até 7 dias inclusive e impede avaliação anterior à conclusão', () => {
    expect(canReview('CONCLUIDO', at, t + 7 * 86400000)).toBe(true)
    expect(canReview('CONCLUIDO', at, t + 7 * 86400000 + 1)).toBe(false)
    expect(canReview('CONCLUIDO', at, t - 1)).toBe(false)
    expect(canReview('EM_DISPUTA', at, t)).toBe(false)
    expect(canReview('CONCLUIDO', 'inválido', t)).toBe(false)
  })
})
describe('Senha de cadastro (UC01)', () => {
  it('exige letras e números e respeita os 72 bytes do bcrypt', () => {
    expect(validPassword('Abcdefg1')).toBe(true)
    expect(validPassword('abcdefgh')).toBe(false)
    expect(validPassword('12345678')).toBe(false)
    expect(validPassword('abc123')).toBe(false)
    expect(validPassword('á'.repeat(36) + '1')).toBe(false)
    expect(validPassword('a'.repeat(71) + '1')).toBe(true)
  })
})
describe('Fotos do anúncio (F06 / RN08)', () => {
  const png = { type: 'image/png', size: 1000 }
  it('aceita até 5 imagens JPG/PNG de até 5 MB', () => {
    expect(imageSelectionError([png, { type: 'image/jpeg', size: MAX_IMAGE_BYTES }], 3)).toBe('')
  })
  it('bloqueia excesso, formato e tamanho', () => {
    expect(imageSelectionError([png, png], 4)).toMatch(/no máximo 5 imagens/)
    expect(imageSelectionError([{ type: 'image/gif', size: 10 }])).toMatch(/JPG ou PNG/)
    expect(imageSelectionError([{ type: 'image/png', size: MAX_IMAGE_BYTES + 1 }])).toMatch(/5 MB/)
  })
})
describe('Retorno após login', () => {
  it('volta para a página protegida que o visitante tentou abrir', () => {
    expect(safeRedirect('/servicos/abc/solicitar', '/inicio')).toBe('/servicos/abc/solicitar')
    expect(safeRedirect('/mensagens?contratacao=1', '/inicio')).toBe('/mensagens?contratacao=1')
  })
  it('ignora destinos externos, ausentes ou de autenticação', () => {
    for (const from of [undefined, 42, '', 'https://evil.test', '//evil.test', '/\\evil.test'])
      expect(safeRedirect(from, '/inicio')).toBe('/inicio')
    for (const from of ['/login', '/cadastro?tipo=freelancer', '/redefinir-senha?token=x'])
      expect(safeRedirect(from, '/inicio')).toBe('/inicio')
  })
})
describe('Sessão renovável', () => {
  const user = {
    id: '1',
    name: 'A',
    email: 'a@a',
    phone: '',
    role: 'CLIENT',
    city: '',
    bio: '',
  } as const
  const base = { accessToken: 't', tokenType: 'Bearer', expiresIn: 900, user }
  it('continua válida enquanto o refresh token não expira', () => {
    expect(usable({ ...base, expiresAt: 2000 }, 1000)).toBe(true)
    expect(
      usable({ ...base, expiresAt: 500, refreshToken: 'r', refreshExpiresAt: 5000 }, 1000),
    ).toBe(true)
    expect(usable({ ...base, expiresAt: 500 }, 1000)).toBe(false)
    expect(
      usable({ ...base, expiresAt: 500, refreshToken: 'r', refreshExpiresAt: 900 }, 1000),
    ).toBe(false)
    expect(usable(null)).toBe(false)
  })
})
describe('Gestão de demandas (cliente e freelancer)', () => {
  const base = {
    clientId: 'c',
    title: 't',
    description: 'd',
    budget: 100,
    days: 2,
  }
  it('libera edição só enquanto a demanda está aberta e sem propostas', () => {
    expect(canEditDemand({ id: 'd1', status: 'OPEN' }, [])).toBe(true)
    expect(canEditDemand({ id: 'd1', status: 'OPEN' }, [{ demandId: 'd1' }])).toBe(false)
    expect(canEditDemand({ id: 'd1', status: 'CANCELLED' }, [])).toBe(false)
  })
  it('mostra ao freelancer só demandas abertas que ele não respondeu, na sua área primeiro', () => {
    const demands = [
      { ...base, id: 'a', categoryId: 'x', city: 'Ceilândia, DF', status: 'OPEN' as const },
      { ...base, id: 'b', categoryId: 'e', city: 'Taguatinga, DF', status: 'OPEN' as const },
      { ...base, id: 'c', categoryId: 'e', city: 'Gama, DF', status: 'CLOSED' as const },
      { ...base, id: 'd', categoryId: 'e', city: 'Gama, DF', status: 'OPEN' as const },
      { ...base, id: 'e', categoryId: 'e', city: 'Gama, DF', status: 'OPEN' as const },
    ]
    const proposals = [
      { demandId: 'd', freelancerId: 'f', status: 'PENDING' as const },
      { demandId: 'e', freelancerId: 'f', status: 'WITHDRAWN' as const },
    ]
    expect(
      compatibleDemands(demands, proposals, 'f', ['e'], 'Taguatinga, DF').map((d) => d.id),
    ).toEqual(['b', 'e', 'a'])
  })
})

describe('Ações pendentes por papel', () => {
  it('cliente confirma, avalia e analisa propostas; freelancer responde e inicia', async () => {
    const { contracts, demands, proposals } = await import('../data/fixtures')
    const client = pendingActions({ id: 'ana', role: 'CLIENT' }, contracts, demands, proposals)
    expect(client.map((a) => a.to)).toEqual([
      '/contratacoes/103',
      '/contratacoes/104/avaliar',
      '/demandas/d1',
    ])
    expect(client[2].label).toBe('1 proposta para analisar')
    const freela = pendingActions(
      { id: 'marcos', role: 'FREELANCER' },
      contracts,
      demands,
      proposals,
    )
    expect(freela.map((a) => a.to)).toEqual(['/contratacoes/101'])
    expect(pendingActions({ id: 'x', role: 'ADMIN' }, contracts, demands, proposals)).toEqual([])
    // Another person's contracts and demands never become someone else's task.
    expect(pendingActions({ id: 'bruno', role: 'CLIENT' }, contracts, demands, proposals)).toEqual(
      [],
    )
  })
})
