import { test, expect } from '@playwright/test'
test.skip(process.env.E2E_DATA_MODE !== 'api', 'Requer API e banco locais')

// PNG válido de 1×1 pixel, gerado só para o teste.
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)
const photo = (name: string) => ({ name, mimeType: 'image/png', buffer: png })

test('freelancer envia fotos do anúncio, a capa aparece na busca e a remoção persiste', async ({
  page,
}) => {
  const email = `fotos-${crypto.randomUUID()}@example.test`,
    title = `Serviço com fotos ${Date.now()}`
  await page.goto('/cadastro?tipo=freelancer')
  await page.getByLabel('Nome completo').fill('Profissional Fotos')
  await page.getByLabel(/^E-mail/).fill(email)
  await page.getByLabel('Telefone').fill('61999990002')
  await page.getByLabel(/^Senha/).fill('Strong12345')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click()
  await expect(page).toHaveURL(/\/perfil\/completar$/)

  await page.goto('/meus-servicos/novo')
  await page.getByLabel('Título do serviço').fill(title)
  await page.getByLabel('Categoria').selectOption({ label: 'Elétrica' })
  await page.getByLabel('Descrição detalhada').fill('Anúncio com fotos enviadas pela API real.')
  await page.getByLabel('Valor estimado').fill('150')
  const picker = page.getByLabel('Adicionar fotos do serviço')
  await picker.setInputFiles({ name: 'animado.gif', mimeType: 'image/gif', buffer: png })
  await expect(page.getByRole('alert')).toContainText('JPG ou PNG')
  await picker.setInputFiles([photo('frente.png'), photo('detalhe.png')])
  await expect(page.getByText('Será enviada ao salvar')).toHaveCount(2)
  await page.getByRole('button', { name: 'Publicar serviço', exact: true }).click()
  await expect(page).toHaveURL(/\/meus-servicos$/)

  await page.goto(`/servicos?q=${encodeURIComponent(title)}`)
  const cover = page.getByRole('img', { name: `Foto de ${title}` })
  await expect(cover).toBeVisible()
  expect(await cover.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1)
  await page.getByRole('link', { name: title, exact: true }).click()
  await expect(page.getByRole('button', { name: /Ver foto/ })).toHaveCount(2)

  await page.goto('/meus-servicos')
  await page.getByRole('link', { name: 'Editar' }).click()
  await page.getByRole('button', { name: 'Remover foto 1' }).click()
  await expect(page.getByText('Foto removida.')).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: /Remover foto/ })).toHaveCount(1)
})
