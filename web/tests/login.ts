import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

// Contas fictícias do modo mock (web/src/data/fixtures.ts), senha Demo12345.
export async function loginAs(page: Page, user: 'ana' | 'marcos' | 'admin') {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(`${user}@demo.freelancenow.test`)
  await page.getByLabel('Senha').fill('Demo12345')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(user === 'admin' ? /\/admin\/usuarios$/ : /\/inicio$/)
}
