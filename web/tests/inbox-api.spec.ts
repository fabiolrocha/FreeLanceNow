import { test, expect } from '@playwright/test'
test.skip(process.env.E2E_DATA_MODE !== 'api', 'Requer API e banco locais')
test('solicitação gera aviso para o profissional e o chat da contratação persiste entre contas', async ({
  page,
  request,
}) => {
  const root = 'http://127.0.0.1:8081/api/v1'
  async function actor(role: string, name: string) {
    const email = `inbox-${crypto.randomUUID()}@example.test`
    const response = await request.post(root + '/auth/register', {
      data: {
        name,
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
  const freela = await actor('FREELANCER', 'Profissional Chat'),
    client = await actor('CLIENT', 'Cliente Chat')
  const cats = await (await request.get(root + '/categories')).json()
  const service = await (
    await request.post(root + '/services', {
      headers: { Authorization: `Bearer ${freela.accessToken}` },
      data: {
        title: `Chat real ${Date.now()}`,
        description: 'Serviço para testar avisos e mensagens.',
        categoryId: cats[0].id,
        price: 120,
        deliveryDays: 1,
        status: 'ACTIVE',
      },
    })
  ).json()
  const date = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)
  const contract = await (
    await request.post(root + '/contracts', {
      headers: { Authorization: `Bearer ${client.accessToken}` },
      data: { serviceId: service.id, date, description: 'Preciso trocar uma tomada.', address: '' },
    })
  ).json()
  async function login(email: string) {
    await page.goto('/login')
    await page.getByLabel(/^E-mail/).fill(email)
    await page.getByLabel(/^Senha/).fill('Strong12345')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL(/\/inicio$/)
  }

  await login(freela.email)
  await expect(page.getByRole('link', { name: 'Notificações: 1 não lidas' })).toBeVisible()
  await page.goto('/notificacoes')
  await expect(
    page.getByRole('heading', { name: `Nova solicitação: ${service.title}` }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Ver aviso' }).first().click()
  await expect(page).toHaveURL(new RegExp(`/contratacoes/${contract.id}$`))
  await expect(page.getByText('Sem resposta, a solicitação é cancelada em')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Notificações', exact: true })).toBeVisible()

  await page.getByRole('link', { name: /Conversar com Cliente Chat/ }).click()
  await page.getByLabel('Escrever mensagem').fill('Olá! Posso ir amanhã às 9h?')
  await page.getByRole('button', { name: 'Enviar' }).click()
  await expect(page.getByText('Olá! Posso ir amanhã às 9h?')).toBeVisible()
  await page.getByRole('button', { name: 'Sair da conta' }).click()

  await login(client.email)
  await expect(page.getByRole('link', { name: 'Notificações: 1 não lidas' })).toBeVisible()
  await page.goto(`/mensagens?contratacao=${contract.id}`)
  await expect(page.getByText('Olá! Posso ir amanhã às 9h?')).toBeVisible()
  await page.getByLabel('Escrever mensagem').fill('Combinado, até amanhã.')
  await page.getByRole('button', { name: 'Enviar' }).click()
  await page.reload()
  await expect(page.getByText('Combinado, até amanhã.')).toBeVisible()
  await expect(page.getByText('Olá! Posso ir amanhã às 9h?')).toBeVisible()
})
