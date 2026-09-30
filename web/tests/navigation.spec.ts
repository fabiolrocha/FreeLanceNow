import { test, expect } from '@playwright/test'
test.skip(process.env.E2E_DATA_MODE === 'api', 'Navegação de todas as áreas simuladas')
test('telas por perfil renderizam em celular sem erros de execução', async ({ page }) => {
  test.setTimeout(60000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (e) => {
    if (e.type() === 'error') errors.push(e.text())
  })
  await page.setViewportSize({ width: 390, height: 844 })
  async function visit(path: string) {
    await page.goto(path)
    await expect(page.locator('main h1').first()).toBeVisible()
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      path,
    ).toBe(true)
  }
  for (const path of [
    '/',
    '/servicos',
    '/servicos/11',
    '/profissionais',
    '/profissionais/marcos',
    '/cadastro',
    '/recuperar-senha',
    '/ajuda',
    '/termos',
    '/privacidade',
    '/pagina-inexistente',
  ])
    await visit(path)
  const shared = [
    '/inicio',
    '/perfil',
    '/perfil/editar',
    '/contratacoes',
    '/contratacoes/101',
    '/demandas',
    '/demandas/d1',
    '/notificacoes',
    '/mensagens',
    '/carteira',
    '/transacao',
    '/denunciar',
    '/denunciar/enviada',
  ]
  const roles = [
    {
      name: 'Cliente',
      paths: [
        ...shared,
        '/servicos/12/solicitar',
        '/demandas/nova',
        '/contratacoes/103/confirmar',
        '/contratacoes/103/contestar',
        '/contratacoes/104/avaliar',
        '/contratacoes/105/disputa',
        '/pagamento',
        '/pagamento/confirmado',
      ],
    },
    {
      name: 'Freelancer',
      paths: [
        '/painel',
        '/meus-servicos',
        '/meus-servicos/novo',
        '/meus-servicos/11/editar',
        '/solicitacoes',
        '/contratacoes/102/concluir',
        '/demandas/d1/proposta',
        '/demandas/d1/proposta/enviada',
        '/saque',
        '/saque/enviado',
      ],
    },
    {
      name: 'Admin',
      paths: [
        '/admin/usuarios',
        '/admin/categorias',
        '/admin/moderacao',
        '/admin/relatorios',
        '/admin/transacoes',
      ],
    },
  ]
  for (const role of roles) {
    await page.goto('/login')
    await page.getByRole('button', { name: role.name, exact: true }).click()
    for (const path of role.paths) await visit(path)
    await page.getByRole('button', { name: 'Abrir menu' }).click()
    await page.getByRole('button', { name: 'Sair da conta' }).click()
  }
  expect(errors).toEqual([])
})
