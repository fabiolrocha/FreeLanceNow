import { createHash } from 'node:crypto'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { createServer } from 'vite'
import type { ViteDevServer } from 'vite'

const email = 'pessoa@example.com'
const user = {
  id: 'google-user',
  name: 'Pessoa Google',
  email,
  role: 'CLIENT',
  emailVerified: true,
  googleLinked: true,
}
const session = { accessToken: 'google-session', tokenType: 'Bearer', expiresIn: 900, user }

let server: ViteDevServer
let url: string

test.beforeAll(async () => {
  server = await createServer({
    configFile: false,
    server: { host: '127.0.0.1', port: 0, strictPort: true },
    define: {
      'import.meta.env.VITE_DATA_MODE': JSON.stringify('api'),
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify('/api/v1'),
      'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(
        'fln-tests.apps.googleusercontent.com',
      ),
    },
  })
  await server.listen()
  url = server.resolvedUrls!.local[0]
})

test.afterAll(async () => {
  await server?.close()
})

async function stubGoogle(page: Page, next: 'LINK' | 'REGISTER' | 'SIGNED_IN') {
  await page.route('https://accounts.google.com/gsi/client**', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `
        window.google = { accounts: { id: {
          initialize(options) { this.options = options },
          renderButton(target) {
            const button = document.createElement('button');
            button.textContent = 'Continuar com o Google';
            button.addEventListener('click', () => {
              this.options.callback({ credential: this.options.nonce });
            });
            target.append(button);
          }
        } } };
      `,
    }),
  )
  await page.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/v1/auth/google') {
      const { credential, verifier } = route.request().postDataJSON()
      expect(credential).toBe(
        createHash('sha256').update(Buffer.from(verifier, 'base64url')).digest('base64url'),
      )
      return route.fulfill({
        json: next === 'SIGNED_IN' ? { next, session } : { next, email, name: user.name },
      })
    }
    if (path === '/api/v1/services') return route.fulfill({ json: { items: [], totalPages: 0 } })
    return route.fulfill({ json: path === '/api/v1/users/me' ? user : [] })
  })
}

test('Google registration collects the required profile and opens profile completion', async ({
  page,
}) => {
  await stubGoogle(page, 'REGISTER')
  await page.route('**/api/v1/auth/google/register', (route) => {
    expect(route.request().postDataJSON()).toMatchObject({
      name: 'Pessoa Google',
      phone: '61999990000',
      role: 'FREELANCER',
      acceptedTerms: true,
    })
    return route.fulfill({
      status: 201,
      json: { ...session, user: { ...user, role: 'FREELANCER' } },
    })
  })

  await page.goto(new URL('/cadastro', url).href)
  await page.getByRole('button', { name: 'Continuar com o Google' }).click()
  await expect(page.getByText(email, { exact: true })).toBeVisible()
  await expect(page.getByLabel('Nome completo')).toHaveValue(user.name)
  await page.getByLabel('Telefone').fill('61999990000')
  await page.getByLabel('Tipo de conta').selectOption('FREELANCER')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click()
  await expect(page).toHaveURL(/\/perfil\/completar$/)
})

test('Google linking asks for the FreeLanceNow password and allows a retry', async ({ page }) => {
  await stubGoogle(page, 'LINK')
  await page.route('**/api/v1/auth/google/link', (route) => {
    const { password } = route.request().postDataJSON()
    if (password === 'Existing123') return route.fulfill({ json: session })
    return route.fulfill({ status: 401, json: { detail: 'A senha da conta não confere.' } })
  })

  await page.goto(new URL('/login', url).href)
  await page.getByRole('button', { name: 'Continuar com o Google' }).click()
  await expect(page.getByRole('heading', { name: 'Vincular sua conta Google' })).toBeVisible()
  await page.getByLabel('Senha do FreeLanceNow').fill('Wrong123')
  await page.getByRole('button', { name: 'Vincular e entrar' }).click()
  await expect(page.getByRole('alert')).toHaveText('A senha da conta não confere.')
  await page.getByLabel('Senha do FreeLanceNow').fill('Existing123')
  await page.getByRole('button', { name: 'Vincular e entrar' }).click()
  await expect(page).toHaveURL(/\/inicio$/)
})

test('a linked Google account signs in directly and returns to the requested page', async ({
  page,
}) => {
  await stubGoogle(page, 'SIGNED_IN')
  await page.goto(new URL('/perfil/completar', url).href)
  await expect(page).toHaveURL(/\/login$/)
  await page.getByRole('button', { name: 'Continuar com o Google' }).click()
  await expect(page).toHaveURL(/\/perfil\/completar$/)
})

test('a pending Google response cannot overwrite a session after leaving the login page', async ({
  page,
}) => {
  await stubGoogle(page, 'SIGNED_IN')
  let finishRequest!: () => void
  const responseAllowed = new Promise<void>((resolve) => {
    finishRequest = resolve
  })
  await page.route('**/api/v1/auth/google', async (route) => {
    await responseAllowed
    await route.fulfill({ json: { next: 'SIGNED_IN', session } }).catch(() => {})
  })

  await page.goto(new URL('/login', url).href)
  await page.getByRole('button', { name: 'Continuar com o Google' }).click()
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeDisabled()
  const aborted = page.waitForEvent('requestfailed', (request) =>
    request.url().endsWith('/auth/google'),
  )
  await page.getByRole('link', { name: 'Esqueci minha senha' }).click()
  try {
    await aborted
    await expect(page).toHaveURL(/\/recuperar-senha$/)
  } finally {
    finishRequest()
  }
})

test('account settings allow deletion by reauthenticating the linked Google account', async ({
  page,
}) => {
  await stubGoogle(page, 'SIGNED_IN')
  await page.route('**/api/v1/auth/google/delete-account', (route) => {
    const { credential, verifier } = route.request().postDataJSON()
    expect(route.request().headers().authorization).toBe('Bearer google-session')
    expect(credential).toBe(
      'delete-account-' +
        createHash('sha256').update(Buffer.from(verifier, 'base64url')).digest('base64url'),
    )
    return route.fulfill({ status: 204 })
  })

  await page.goto(new URL('/perfil/editar', url).href)
  await page.getByRole('button', { name: 'Continuar com o Google' }).click()
  await expect(page).toHaveURL(/\/perfil\/editar$/)
  await page.getByRole('button', { name: 'Excluir com Google' }).click()
  await page.getByRole('button', { name: 'Prosseguir com Google' }).click()
  await page.getByRole('button', { name: 'Continuar com o Google' }).click()
  await expect(page).toHaveURL(new URL('/', url).href)
})

test('a pending password response cannot overwrite Google sign-in on another page', async ({
  page,
}) => {
  await stubGoogle(page, 'SIGNED_IN')
  let finishRequest!: () => void
  const responseAllowed = new Promise<void>((resolve) => {
    finishRequest = resolve
  })
  await page.route('**/api/v1/auth/login', async (route) => {
    await responseAllowed
    await route.fulfill({ json: { ...session, accessToken: 'password-session' } }).catch(() => {})
  })
  await page.goto(new URL('/login', url).href)
  const login = page.locator('.auth-panel')
  await login.getByLabel(/^E-mail/).fill(email)
  await login.getByLabel(/^Senha/).fill('Existing123')
  const sent = page.waitForRequest((request) => request.url().endsWith('/auth/login'))
  await login.getByRole('button', { name: 'Entrar', exact: true }).click()
  await sent
  const aborted = page.waitForEvent('requestfailed', (request) =>
    request.url().endsWith('/auth/login'),
  )
  try {
    await login.getByRole('link', { name: 'Criar conta', exact: true }).click()
    await aborted
    await page.getByRole('button', { name: 'Continuar com o Google' }).click()
    await expect(page).toHaveURL(/\/inicio$/)
    expect(
      await page.evaluate(() => JSON.parse(localStorage.getItem('fln-session')!).accessToken),
    ).toBe('google-session')
  } finally {
    finishRequest()
  }
})
