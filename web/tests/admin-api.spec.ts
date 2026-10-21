import { test, expect } from '@playwright/test'
const adminEmail = process.env.E2E_ADMIN_EMAIL
const adminPassword = process.env.E2E_ADMIN_PASSWORD
test.skip(
  process.env.E2E_DATA_MODE !== 'api' || !adminEmail || !adminPassword,
  'Requer API e credenciais do ADMIN provisionado explicitamente',
)

test('admin gerencia categorias e usuários; denúncia e auditoria persistem após reload', async ({
  page,
  request,
}) => {
  test.setTimeout(60000)
  const api = 'http://localhost:8081/api/v1'
  async function register(role: string) {
    const email = `admin-flow-${crypto.randomUUID()}@example.test`
    const response = await request.post(`${api}/auth/register`, {
      data: {
        name: `Pessoa ${role}`,
        email,
        password: 'Strong12345',
        phone: '61999990000',
        role,
        acceptedTerms: true,
      },
    })
    expect(response.status()).toBe(201)
    return { ...(await response.json()), email }
  }
  const freelancer = await register('FREELANCER'),
    client = await register('CLIENT')
  const title = `Anúncio moderado ${Date.now()}`,
    categoryName = `Categoria E2E ${Date.now()}`
  const created = await request.post(`${api}/services`, {
    headers: { Authorization: `Bearer ${freelancer.accessToken}` },
    data: {
      title,
      description: 'Anúncio para validar a moderação persistente.',
      categoryId: '10000000-0000-0000-0000-000000000001',
      price: 150,
      deliveryDays: 2,
      status: 'ACTIVE',
    },
  })
  expect(created.status()).toBe(201)
  const service = await created.json()
  async function login(email: string, password: string) {
    await page.goto('/login')
    await page.getByLabel(/^E-mail/).fill(email)
    await page.getByLabel(/^Senha/).fill(password)
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).not.toHaveURL(/\/login$/)
  }
  await login(adminEmail!, adminPassword!)
  await page.goto('/admin/categorias')
  await page.getByLabel('Nome da nova categoria').fill(categoryName)
  await page.getByRole('button', { name: 'Adicionar categoria' }).click()
  await expect(page.getByRole('row').filter({ hasText: categoryName })).toBeVisible()
  await page.reload()
  const categoryRow = page.getByRole('row').filter({ hasText: categoryName })
  await expect(categoryRow).toBeVisible()
  const category = (await (await request.get(`${api}/categories`)).json()).find(
    (c: { name: string }) => c.name === categoryName,
  )
  const linkedResponse = await request.post(`${api}/services`, {
    headers: { Authorization: `Bearer ${freelancer.accessToken}` },
    data: {
      title: `Vínculo preservado ${Date.now()}`,
      description: 'Serviço para editar mantendo uma categoria desativada.',
      categoryId: category.id,
      price: 100,
      deliveryDays: 2,
      status: 'ACTIVE',
    },
  })
  expect(linkedResponse.status()).toBe(201)
  const linkedService = await linkedResponse.json()
  await categoryRow.getByRole('button', { name: 'Desativar', exact: true }).click()
  await page.reload()
  await expect(categoryRow.getByText('Desativada', { exact: true })).toBeVisible()
  await page.goto('/admin/usuarios')
  await page.getByLabel('Buscar por nome ou e-mail').fill(client.email)
  await page.getByLabel('Motivo da alteração').fill('Suspensão para verificar bloqueio do acesso')
  const userRow = page.getByRole('row').filter({ hasText: client.email })
  await userRow.getByRole('button', { name: 'Suspender', exact: true }).click()
  await expect(userRow.getByText('Suspenso', { exact: true })).toBeVisible()
  expect(
    (
      await request.get(`${api}/users/me`, {
        headers: { Authorization: `Bearer ${client.accessToken}` },
      })
    ).status(),
  ).toBe(403)
  await page.getByLabel('Motivo da alteração').fill('Reativação para continuar o ensaio')
  await userRow.getByRole('button', { name: 'Reativar', exact: true }).click()
  await expect(userRow.getByText('Ativo', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Sair da conta' }).click()
  await login(client.email, 'Strong12345')
  await page.goto(`/servicos/${service.id}`)
  await page.getByRole('link', { name: 'Denunciar anúncio' }).click()
  await page
    .getByLabel('O que aconteceu?')
    .fill(
      'Este é um relato suficientemente detalhado para analisar o conteúdo publicado no anúncio.',
    )
  await page.getByRole('button', { name: 'Enviar denúncia' }).click()
  await expect(page.getByRole('heading', { name: 'Denúncia registrada' })).toBeVisible()
  await page.getByRole('button', { name: 'Sair da conta' }).click()
  await login(adminEmail!, adminPassword!)
  await page.goto('/admin/moderacao')
  const report = page.getByRole('article').filter({ hasText: title })
  await expect(report).toBeVisible()
  await report
    .getByLabel('Justificativa da decisão')
    .fill('Conteúdo confirmado como inadequado para o catálogo')
  await report.getByRole('button', { name: 'Remover conteúdo', exact: true }).click()
  await expect(report.getByText('Removido', { exact: true })).toBeVisible()
  await page.reload()
  await expect(report.getByText('Removido', { exact: true })).toBeVisible()
  expect((await request.get(`${api}/services/${service.id}`)).status()).toBe(404)
  await page.goto('/admin/relatorios')
  await expect(page.getByRole('heading', { name: 'Auditoria administrativa' })).toBeVisible()
  await expect(page.getByText('REPORT_DECIDED').first()).toBeVisible()
  await page.getByRole('button', { name: 'Sair da conta' }).click()
  await login(freelancer.email, 'Strong12345')
  await page.goto(`/meus-servicos/${linkedService.id}/editar`)
  await expect(page.getByLabel(/^Categoria/)).toHaveValue(category.id)
  await page
    .getByLabel('Descrição detalhada')
    .fill('Descrição alterada preservando a categoria desativada do anúncio.')
  await page.getByRole('button', { name: 'Publicar serviço', exact: true }).click()
  await expect(page).toHaveURL(/\/meus-servicos$/)
  await page.goto(`/meus-servicos/${linkedService.id}/editar`)
  await expect(page.getByLabel(/^Categoria/)).toHaveValue(category.id)
})
