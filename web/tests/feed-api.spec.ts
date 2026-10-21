import { test, expect } from '@playwright/test'
test.skip(process.env.E2E_DATA_MODE !== 'api', 'Requer API e banco locais')
test('publicação real persiste entre contas, falha mantém texto e moderação retira do feed', async ({
  page,
  request,
}) => {
  const root = 'http://127.0.0.1:8081/api/v1'
  async function actor(role: string) {
    const email = `feed-${crypto.randomUUID()}@example.test`
    const response = await request.post(root + '/auth/register', {
      data: {
        name: role === 'CLIENT' ? 'Cliente Feed' : 'Profissional Feed',
        email,
        password: 'Strong12345',
        phone: '61999990000',
        role,
        acceptedTerms: true,
      },
    })
    expect(response.ok()).toBe(true)
    return { email, ...(await response.json()) }
  }
  const freela = await actor('FREELANCER'),
    client = await actor('CLIENT')
  const cats = await (await request.get(root + '/categories')).json()
  const service = await (
    await request.post(root + '/services', {
      headers: { Authorization: `Bearer ${freela.accessToken}` },
      data: {
        title: `Trabalho Feed ${Date.now()}`,
        description: 'Instalação para teste do feed real.',
        categoryId: cats[0].id,
        price: 100,
        deliveryDays: 2,
        status: 'ACTIVE',
      },
    })
  ).json()
  async function login(email: string) {
    await page.goto('/login')
    await page.getByLabel(/^E-mail/).fill(email)
    await page.getByLabel(/^Senha/).fill('Strong12345')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL(/\/inicio$/)
  }
  const text = `Meu novo trabalho publicado ${crypto.randomUUID()}`
  await login(freela.email)
  await expect(page.getByRole('heading', { name: 'Feed de trabalho' })).toBeVisible()
  await page.getByLabel('Compartilhe seu trabalho').fill(text)
  await page.getByLabel('Vincular meu serviço').selectOption(service.id)
  await page.route(
    '**/api/v1/feed/posts',
    (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/problem+json',
        body: JSON.stringify({ detail: 'Falha controlada de publicação' }),
      }),
    { times: 1 },
  )
  await page.getByRole('button', { name: 'Publicar atualização', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Falha controlada')
  await expect(page.getByLabel('Compartilhe seu trabalho')).toHaveValue(text)
  await page.getByRole('button', { name: 'Publicar atualização', exact: true }).click()
  const card = page.locator('article.feed-card').filter({ hasText: text })
  await expect(card).toBeVisible()
  await expect(card.getByRole('link', { name: 'Ver serviço' })).toHaveAttribute(
    'href',
    `/servicos/${service.id}`,
  )
  await page.reload()
  await page.getByRole('button', { name: 'Publicações', exact: true }).click()
  await expect(card).toBeVisible()
  await page.getByRole('button', { name: 'Sair da conta' }).click()
  await login(client.email)
  await page.getByRole('button', { name: 'Publicações', exact: true }).click()
  await expect(card).toBeVisible()
  await expect(card.getByRole('button', { name: 'Retirar publicação' })).toHaveCount(0)
  await card.getByRole('link', { name: 'Denunciar', exact: true }).click()
  await page
    .getByLabel('O que aconteceu?')
    .fill('Relato de teste para analisar a publicação profissional no feed.')
  await page.getByRole('button', { name: 'Enviar denúncia' }).click()
  await expect(page.getByRole('heading', { name: 'Denúncia registrada' })).toBeVisible()
  const adminEmail = process.env.E2E_ADMIN_EMAIL,
    adminPassword = process.env.E2E_ADMIN_PASSWORD
  if (adminEmail && adminPassword) {
    const a = await (
      await request.post(root + '/auth/login', {
        data: { email: adminEmail, password: adminPassword },
      })
    ).json()
    const headers = { Authorization: `Bearer ${a.accessToken}` }
    const reports = await (await request.get(root + '/admin/reports', { headers })).json()
    const report = reports.find((r: { targetContent: string }) => r.targetContent === text)
    expect(report).toBeTruthy()
    expect(
      (
        await request.patch(root + '/admin/reports/' + report.id, {
          headers,
          data: { status: 'REMOVED', note: 'Publicação removida em teste integrado.' },
        })
      ).ok(),
    ).toBe(true)
    await page.goto('/inicio')
    await expect(card).toHaveCount(0)
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/inicio')
  await expect(page.getByLabel('Compartilhe seu trabalho')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
