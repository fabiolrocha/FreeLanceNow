import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { loginAs } from './login'

// Finance screens against the local API (F09). Without STRIPE_SECRET_KEY the checkout stays off,
// but wallets, receipts and the admin panel show the demo seed's simulated escrow history.
test.skip(
  process.env.E2E_DATA_MODE !== 'api',
  'Requer API e banco locais com o seed de demonstração',
)

async function axe(page: Page) {
  await page.waitForTimeout(300)
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  return violations.map((v) => `${page.url()} ${v.id}: ${v.help}`)
}

for (const width of [1280, 390]) {
  test(`carteira, comprovante e saque do profissional em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await loginAs(page, 'marcos')
    await page.goto('/carteira')
    await expect(page.getByRole('heading', { name: 'Carteira', exact: true })).toBeVisible()
    await expect(page.getByText('Disponível', { exact: true })).toBeVisible()
    await expect(page.getByText(/demonstração\)/).first()).toBeVisible()
    const found = await axe(page)

    await page.getByRole('link', { name: 'Comprovante' }).first().click()
    await expect(page.getByRole('heading', { name: 'Comprovante' })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Comissão da plataforma' }).first()).toBeVisible()
    found.push(...(await axe(page)))

    await page.goto('/saque')
    await expect(page.getByRole('heading', { name: 'Solicitar saque' })).toBeVisible()
    found.push(...(await axe(page)))
    expect(found, found.join('\n')).toEqual([])
  })
}

test('cliente vê seus pagamentos e o saque continua restrito a profissionais', async ({ page }) => {
  await loginAs(page, 'ana')
  await page.goto('/carteira')
  await expect(page.getByRole('heading', { name: 'Pagamentos', exact: true })).toBeVisible()
  await expect(page.getByText('Em custódia', { exact: true })).toBeVisible()
  expect(await axe(page)).toEqual([])
  await page.goto('/saque')
  await expect(page.getByText('Esta área é para contas de profissional.')).toBeVisible()
})

test('saque simulado diminui o saldo disponível', async ({ page }) => {
  await loginAs(page, 'marcos')
  await page.goto('/saque')
  const field = page.getByLabel(/^Valor/)
  const available = Number(await field.inputValue())
  expect(available).toBeGreaterThan(1)
  await field.fill('1')
  await page.getByRole('button', { name: 'Registrar saque simulado' }).click()
  await expect(page).toHaveURL(/\/saque\/enviado$/)
  const after = (available - 1).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  await expect(page.getByText(`Saldo disponível agora: ${after}.`)).toBeVisible()
})

const adminEmail = process.env.E2E_ADMIN_EMAIL,
  adminPassword = process.env.E2E_ADMIN_PASSWORD
test('admin vê totais e transações', async ({ page }) => {
  test.skip(!adminEmail || !adminPassword, 'Requer credenciais do ADMIN local')
  await page.goto('/login')
  await page.getByLabel(/^E-mail/).fill(adminEmail!)
  await page.getByLabel(/^Senha/).fill(adminPassword!)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/usuarios$/)
  await page.getByRole('link', { name: 'Transações' }).first().click()
  await expect(page.getByRole('heading', { name: 'Transações e custódia' })).toBeVisible()
  await expect(page.getByText('Comissões', { exact: true })).toBeVisible()
  expect(await axe(page)).toEqual([])
  await page.getByRole('link', { name: 'Comprovante' }).first().click()
  await expect(page.getByRole('heading', { name: 'Comprovante' })).toBeVisible()
})
