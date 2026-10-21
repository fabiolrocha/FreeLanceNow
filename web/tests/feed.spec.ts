import { test, expect } from '@playwright/test'
test.skip(process.env.E2E_DATA_MODE === 'api', 'Feed mock; integração real em feed-api.spec.ts')
test('feed publica entre contas, filtra oportunidades e permite retirar apenas o próprio texto', async ({
  page,
}) => {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Freelancer', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Feed de trabalho' })).toBeVisible()
  await page
    .getByLabel('Compartilhe seu trabalho')
    .fill('Hoje concluí a instalação de um quadro elétrico.')
  await page.getByRole('button', { name: 'Publicar atualização', exact: true }).click()
  await page.reload()
  const card = page.locator('article.feed-card').filter({ hasText: 'Hoje concluí a instalação' })
  await expect(card).toBeVisible()
  await expect(card.getByRole('button', { name: 'Retirar publicação' })).toBeVisible()
  await page.getByRole('button', { name: 'Sair da conta' }).click()
  await page.goto('/login')
  await page.getByRole('button', { name: 'Cliente', exact: true }).click()
  await expect(card).toBeVisible()
  await expect(card.getByRole('button', { name: 'Retirar publicação' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Serviços', exact: true }).click()
  await expect(card).toHaveCount(0)
  await expect(
    page.locator('article.feed-card').first().getByRole('link', { name: 'Ver serviço' }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Publicar demanda', exact: true }).click()
  await expect(page).toHaveURL(/\/demandas\/nova$/)
  await page.goto('/inicio')
  await page.getByRole('button', { name: 'Sair da conta' }).click()
  await page.goto('/login')
  await page.getByRole('button', { name: 'Freelancer', exact: true }).click()
  await card.getByRole('button', { name: 'Retirar publicação' }).click()
  await expect(card).toHaveCount(0)
  await page.reload()
  await expect(card).toHaveCount(0)
})
test('feed no celular preserva navegação e acesso ao formulário de serviço', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/login')
  await page.getByRole('button', { name: 'Freelancer', exact: true }).click()
  await expect(page.getByLabel('Compartilhe seu trabalho')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('link', { name: 'Oferecer serviço', exact: true }).click()
  await expect(page).toHaveURL(/\/meus-servicos\/novo$/)
  await page.goto('/inicio')
  await page.getByRole('button', { name: 'Abrir menu' }).click()
  await page.getByRole('link', { name: 'Meu painel', exact: true }).click()
  await expect(page).toHaveURL(/\/painel$/)
})
test('denúncia de publicação permite ao admin retirar o texto do feed mock', async ({ page }) => {
  const text = 'Publicação de teste para análise da moderação.'
  await page.goto('/login')
  await page.getByRole('button', { name: 'Freelancer', exact: true }).click()
  await page.getByLabel('Compartilhe seu trabalho').fill(text)
  await page.getByRole('button', { name: 'Publicar atualização', exact: true }).click()
  await expect(page.locator('article.feed-card').filter({ hasText: text })).toBeVisible()
  await page.getByRole('button', { name: 'Sair da conta' }).click()
  await page.goto('/login')
  await page.getByRole('button', { name: 'Cliente', exact: true }).click()
  await page
    .locator('article.feed-card')
    .filter({ hasText: text })
    .getByRole('link', { name: 'Denunciar', exact: true })
    .click()
  await page
    .getByLabel('O que aconteceu?')
    .fill('Esta publicação precisa de análise da equipe de moderação da plataforma.')
  await page.getByRole('button', { name: 'Enviar denúncia' }).click()
  await page.getByRole('button', { name: 'Sair da conta' }).click()
  await page.goto('/login')
  await page.getByRole('button', { name: 'Admin', exact: true }).click()
  await page.goto('/admin/moderacao')
  await page.getByRole('button', { name: 'Simular remoção' }).click()
  await page.getByRole('button', { name: 'Sair da conta' }).click()
  await page.goto('/login')
  await page.getByRole('button', { name: 'Freelancer', exact: true }).click()
  await expect(page.locator('article.feed-card').filter({ hasText: text })).toHaveCount(0)
})
test('retirar o último item da última página retorna aos resultados restantes', async ({
  page,
}) => {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Freelancer', exact: true }).click()
  await page.evaluate(() => {
    const { user } = JSON.parse(sessionStorage.getItem('fln-session')!)
    const author = { id: user.id, name: user.name, role: user.role, city: user.city }
    sessionStorage.setItem(
      'fln-feed-posts',
      JSON.stringify(
        Array.from({ length: 21 }, (_, i) => ({
          id: crypto.randomUUID(),
          type: 'UPDATE',
          author,
          title: 'Publicação profissional',
          text: `Publicação número ${i}`,
          createdAt: `2026-10-21T10:00:${String(i).padStart(2, '0')}Z`,
          category: null,
          serviceId: null,
          price: null,
          days: null,
          city: null,
        })),
      ),
    )
  })
  await page.reload()
  await page.getByRole('button', { name: 'Publicações', exact: true }).click()
  await page.getByRole('button', { name: 'Próxima', exact: true }).click()
  await expect(page.locator('article.feed-card')).toHaveCount(1)
  await page.getByRole('button', { name: 'Retirar publicação', exact: true }).click()
  await expect(page.getByText('Página 1 de 1', { exact: true })).toBeVisible()
  await expect(page.locator('article.feed-card')).toHaveCount(20)
})
