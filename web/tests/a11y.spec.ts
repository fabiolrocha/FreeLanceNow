import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { loginAs } from './login'
test.skip(process.env.E2E_DATA_MODE === 'api', 'Suíte exclusiva do modo mock')

// WCAG 2.1 A and AA rules from axe-core, on the main screens of each profile.
const pages: Record<'visitor' | 'ana' | 'marcos' | 'admin', string[]> = {
  visitor: [
    '/',
    '/servicos',
    '/servicos/12',
    '/profissionais',
    '/login',
    '/cadastro',
    '/ajuda',
    '/termos',
    '/nao-existe',
  ],
  ana: [
    '/inicio',
    '/contratacoes',
    '/demandas',
    '/salvos',
    '/perfil/editar',
    '/notificacoes',
    '/mensagens',
    '/denuncias',
  ],
  marcos: ['/painel', '/meus-servicos', '/meus-servicos/novo', '/solicitacoes', '/propostas'],
  admin: ['/admin/usuarios', '/admin/moderacao', '/admin/relatorios', '/admin/categorias'],
}

async function audit(page: Page, path: string) {
  await page.goto(path)
  await page.locator('main').waitFor()
  await page.waitForTimeout(300)
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  return violations.map(
    (v) =>
      `${path} ${v.id} (${v.impact}): ${v.help} — ${v.nodes
        .slice(0, 3)
        .map((n) => n.target.join(' '))
        .join(' | ')}`,
  )
}

for (const [who, paths] of Object.entries(pages)) {
  for (const width of [1280, 390]) {
    test(`acessibilidade: ${who} em ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      if (who !== 'visitor') await loginAs(page, who as 'ana' | 'marcos' | 'admin')
      const found: string[] = []
      for (const path of paths) found.push(...(await audit(page, path)))
      expect(found, found.join('\n')).toEqual([])
    })
  }
}
