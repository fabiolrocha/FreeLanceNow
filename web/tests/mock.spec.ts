import { test, expect } from '@playwright/test'
test.skip(process.env.E2E_DATA_MODE === 'api', 'Suíte exclusiva do modo mock')
test('cliente solicita serviço e freelancer aceita, executa; cliente confirma e avalia', async ({
  page,
}) => {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Cliente', exact: true }).click()
  await page.goto('/servicos/12/solicitar')
  await page
    .getByLabel('Descrição da demanda')
    .fill('Preciso de instalação no apartamento da demonstração.')
  await page.getByRole('button', { name: 'Confirmar solicitação' }).click()
  await expect(page.getByRole('heading', { name: 'Solicitação enviada' })).toBeVisible()
  await page.getByRole('link', { name: 'Acompanhar contratação' }).click()
  const contractUrl = page.url()
  await page.getByRole('button', { name: 'Sair da conta' }).click()
  await page.goto('/login')
  await page.getByRole('button', { name: 'Freelancer', exact: true }).click()
  await page.goto(contractUrl)
  await page.getByRole('button', { name: 'Aceitar solicitação' }).click()
  await page.getByRole('button', { name: 'Iniciar serviço' }).click()
  await page.getByRole('link', { name: 'Marcar como concluído' }).click()
  await page.getByRole('button', { name: 'Confirmar conclusão' }).click()
  await page.getByRole('button', { name: 'Sair da conta' }).click()
  await page.goto('/login')
  await page.getByRole('button', { name: 'Cliente', exact: true }).click()
  await page.goto(contractUrl)
  await page.getByRole('link', { name: 'Confirmar ou contestar' }).click()
  await page.getByRole('button', { name: 'Confirmar recebimento' }).click()
  await page.getByRole('link', { name: 'Avaliar serviço' }).click()
  await page.getByRole('button', { name: '4 estrelas', exact: true }).click()
  await page.getByLabel('Comentário').fill('Serviço concluído conforme o combinado.')
  await page.getByRole('button', { name: 'Enviar avaliação' }).click()
  await expect(page.getByRole('heading', { name: 'Avaliação publicada' })).toBeVisible()
})
test('rascunho não aparece na busca e publicação o torna disponível', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Freelancer', exact: true }).click()
  await page.goto('/meus-servicos/novo')
  await page.getByLabel('Título do serviço').fill('Pintura de teste da equipe')
  await page.getByLabel('Categoria', { exact: false }).selectOption({ label: 'Pintura' })
  await page.getByLabel('Descrição detalhada').fill('Pintura para demonstração acadêmica.')
  await page.getByLabel('Valor estimado').fill('200')
  await page.getByRole('button', { name: 'Salvar rascunho' }).click()
  await expect(page.getByText('Rascunho', { exact: true })).toBeVisible()
  await page.goto('/servicos?q=Pintura%20de%20teste%20da%20equipe')
  await expect(page.getByRole('heading', { name: 'Pintura de teste da equipe' })).toHaveCount(0)
  await page.goto('/meus-servicos')
  await page
    .locator('article')
    .filter({ hasText: 'Pintura de teste da equipe' })
    .getByRole('button', { name: 'Publicar', exact: true })
    .click()
  await page.goto('/servicos?q=Pintura%20de%20teste%20da%20equipe')
  await expect(page.getByRole('heading', { name: 'Pintura de teste da equipe' })).toBeVisible()
})
test('mobile, acesso restrito e sessão expirada', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'Encontre quem resolve o que você precisa.' }),
  ).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await page.goto('/login')
  await page.getByRole('button', { name: 'Cliente', exact: true }).click()
  await page.goto('/meus-servicos')
  await expect(page.getByRole('heading', { name: 'Acesso restrito' })).toBeVisible()
  await page.getByRole('button', { name: 'Abrir menu' }).click()
  await expect(page.getByRole('button', { name: 'Sair da conta' })).toBeVisible()
  await page.evaluate(() => {
    const s = JSON.parse(sessionStorage.getItem('fln-session')!)
    s.expiresAt = Date.now() - 1000
    sessionStorage.setItem('fln-session', JSON.stringify(s))
  })
  await page.reload()
  await expect(page).toHaveURL(/\/login$/)
})
async function loginAs(page: import('@playwright/test').Page, role: string) {
  await page.goto('/login')
  await page.getByRole('button', { name: role, exact: true }).click()
  await expect(page).toHaveURL(role === 'Admin' ? /\/admin\/usuarios$/ : /\/inicio$/)
}
async function logout(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Sair da conta' }).click()
}
test('demanda recebe proposta, aceite gera contratação e demanda encerrada recusa propostas', async ({
  page,
}) => {
  const title = `Troca de tomadas ${Date.now()}`
  await loginAs(page, 'Cliente')
  await page.goto('/demandas/nova')
  await page.getByLabel('Título da demanda').fill(title)
  await page.getByLabel('Descrição').fill('Trocar seis tomadas antigas da sala e da cozinha.')
  await page.getByLabel('Orçamento').fill('300')
  await page.getByLabel('Prazo').fill('3')
  await page.getByRole('button', { name: 'Publicar demanda' }).click()
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  const demandUrl = page.url()
  await logout(page)

  await loginAs(page, 'Freelancer')
  await page.goto(demandUrl)
  await page.getByRole('link', { name: 'Enviar proposta' }).click()
  await page.getByLabel('Valor da proposta').fill('280')
  await page.getByLabel('Prazo de execução').fill('2')
  await page.getByLabel('Mensagem ao cliente').fill('Levo as tomadas novas e testo cada ponto.')
  await page.getByRole('button', { name: 'Enviar proposta' }).click()
  await expect(page.getByRole('heading', { name: 'Proposta enviada' })).toBeVisible()
  await page.goto(`${demandUrl}/proposta`)
  await page.getByLabel('Valor da proposta').fill('250')
  await page.getByLabel('Prazo de execução').fill('2')
  await page.getByLabel('Mensagem ao cliente').fill('Segunda proposta não deve ser aceita.')
  await page.getByRole('button', { name: 'Enviar proposta' }).click()
  await expect(page.getByText('Você já enviou uma proposta para esta demanda.')).toBeVisible()
  await logout(page)

  await loginAs(page, 'Cliente')
  await page.goto(demandUrl)
  await page.getByRole('button', { name: 'Aceitar proposta' }).click()
  await expect(page).toHaveURL(/\/contratacoes\/[^/]+$/)
  await expect(page.getByText('Aceito', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  await logout(page)

  await loginAs(page, 'Freelancer')
  await page.goto(`${demandUrl}/proposta`)
  await expect(page.getByRole('heading', { name: 'Demanda encerrada' })).toBeVisible()
  await page.goto('/demandas')
  await expect(page.getByRole('heading', { name: title })).toHaveCount(0)
})
test('cliente contesta conclusão e admin decide a disputa na moderação', async ({ page }) => {
  await loginAs(page, 'Cliente')
  await page.goto('/contratacoes/103/contestar')
  await page
    .getByLabel('Motivo da contestação')
    .fill('O chuveiro continua sem aquecer depois da instalação.')
  await page.getByRole('button', { name: 'Enviar contestação' }).click()
  await expect(page.getByText('O chuveiro continua sem aquecer')).toBeVisible()
  await expect(page.getByText('Em disputa', { exact: true }).first()).toBeVisible()
  await page.goto('/contratacoes/103/confirmar')
  await page.getByRole('button', { name: 'Confirmar recebimento' }).click()
  await expect(
    page.getByText('Esta mudança de status não é permitida para seu perfil.'),
  ).toBeVisible()
  await logout(page)

  await loginAs(page, 'Admin')
  await page.goto('/admin/moderacao')
  const dispute = page.locator('article').filter({ hasText: 'O chuveiro continua sem aquecer' })
  await dispute.getByRole('button', { name: 'Confirmar conclusão' }).click()
  await expect(dispute).toHaveCount(0)
  await logout(page)

  await loginAs(page, 'Cliente')
  await page.goto('/contratacoes/103')
  await expect(page.getByText('Concluído', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'Avaliar serviço' })).toBeVisible()
})
test('denúncia entra na fila do admin, recebe decisão e relatório exporta CSV', async ({
  page,
}) => {
  await loginAs(page, 'Cliente')
  await page.goto('/servicos/11')
  await page.getByRole('link', { name: 'Denunciar anúncio' }).click()
  await page.getByLabel('Motivo').selectOption('Anúncio incorreto')
  await page
    .getByLabel('O que aconteceu?')
    .fill('O valor anunciado não corresponde ao que foi cobrado na visita técnica.')
  await page.getByRole('button', { name: 'Enviar denúncia' }).click()
  await expect(page.getByRole('heading', { name: 'Denúncia registrada' })).toBeVisible()
  await logout(page)

  await loginAs(page, 'Admin')
  await page.goto('/admin/moderacao')
  const report = page.locator('article').filter({ hasText: 'Anúncio incorreto' })
  await expect(report.getByText('Pendente')).toBeVisible()
  await report.getByRole('button', { name: 'Manter conteúdo' }).click()
  await expect(report.getByText('Mantido')).toBeVisible()

  await page.goto('/admin/relatorios')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar CSV' }).click()
  const file = await download
  expect(file.suggestedFilename()).toBe('metricas-demo.csv')
  const csv = await (await file.createReadStream()).toArray()
  expect(Buffer.concat(csv).toString('utf8')).toContain('"Serviços ativos"')
})
