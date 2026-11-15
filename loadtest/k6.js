// Load test for the FreeLanceNow API (F10). Run it against a local or staging API, never against
// production with real users. See docs/testes-e-demonstracao.md for the command and the results.
import http from 'k6/http'
import { check, group, sleep } from 'k6'

const BASE = (__ENV.API_URL || 'http://localhost:8081') + '/api/v1'
const EMAIL = __ENV.LOGIN_EMAIL
const PASSWORD = __ENV.LOGIN_PASSWORD

export const options = {
  scenarios: {
    // Visitors browsing the catalog: the most common traffic.
    browse: {
      executor: 'ramping-vus',
      exec: 'browse',
      stages: [
        { duration: '30s', target: 40 },
        { duration: '1m', target: 40 },
        { duration: '15s', target: 0 },
      ],
    },
    // Signed-in clients opening their dashboard data.
    signedIn: {
      executor: 'constant-vus',
      exec: 'signedIn',
      vus: 10,
      duration: '1m45s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{scenario:browse}': ['p(95)<500'],
    'http_req_duration{scenario:signedIn}': ['p(95)<800'],
  },
}

const json = (res) => {
  try {
    return res.json()
  } catch {
    return null
  }
}

export function browse() {
  group('catálogo', () => {
    http.get(`${BASE}/categories`, { tags: { name: 'categories' } })
    const page = json(http.get(`${BASE}/services?size=12`, { tags: { name: 'services' } }))
    check(page, { 'lista de serviços': (p) => p && p.items && p.items.length > 0 })
    const items = (page && page.items) || []
    if (items.length) {
      const s = items[Math.floor(Math.random() * items.length)]
      http.get(`${BASE}/services/${s.id}`, { tags: { name: 'service' } })
      http.get(`${BASE}/services/${s.id}/reviews`, { tags: { name: 'service-reviews' } })
    }
    http.get(`${BASE}/services?q=limpeza&size=12`, { tags: { name: 'search' } })
    http.get(`${BASE}/freelancers`, { tags: { name: 'freelancers' } })
  })
  sleep(1 + Math.random() * 2)
}

// Each virtual user signs in once and reuses the token, as the web app does.
let token = null
export function signedIn() {
  if (!EMAIL || !PASSWORD) throw new Error('Defina LOGIN_EMAIL e LOGIN_PASSWORD.')
  if (!token) {
    const res = http.post(`${BASE}/auth/login`, JSON.stringify({ email: EMAIL, password: PASSWORD }), {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'login' },
    })
    check(res, { 'login 200': (r) => r.status === 200 })
    token = (json(res) || {}).accessToken
  }
  const auth = { headers: { Authorization: `Bearer ${token}` } }
  group('painel do cliente', () => {
    http.get(`${BASE}/users/me`, { ...auth, tags: { name: 'me' } })
    http.get(`${BASE}/contracts`, { ...auth, tags: { name: 'contracts' } })
    http.get(`${BASE}/notifications/unread-count`, { ...auth, tags: { name: 'unread' } })
    http.get(`${BASE}/users/me/favorites`, { ...auth, tags: { name: 'favorites' } })
    http.get(`${BASE}/feed`, { ...auth, tags: { name: 'feed' } })
  })
  sleep(2 + Math.random() * 2)
}
