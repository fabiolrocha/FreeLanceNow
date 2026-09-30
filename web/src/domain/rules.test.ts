import { describe, expect, it } from 'vitest'
import { canReview, canTransition, validPassword } from './rules'
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
