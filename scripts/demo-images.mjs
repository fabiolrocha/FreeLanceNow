// Generates illustrated photos for the demo listings and avatars for the demo accounts, then
// uploads them through the API (the same validation as the app). Run from web/ so Playwright and
// lucide-react resolve:
//
//   cd web && node ../scripts/demo-images.mjs [apiBase] [password]
//
// Defaults: http://127.0.0.1:8081/api/v1 and the local demo password. Listings that already have
// photos and accounts that already have an avatar are skipped, so running it twice is harmless.
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

const require = createRequire(path.join(process.cwd(), 'package.json'))
const { chromium } = require('@playwright/test')
const API = process.argv[2] || 'http://127.0.0.1:8081/api/v1'
const PASSWORD = process.argv[3] || 'Demo12345'
const DOMAIN = '@demo.freelancenow.test'

const iconDir = path.join(process.cwd(), 'node_modules/lucide-react/dist/esm/icons')
function icon(name, { size = 96, color = '#fff', stroke = 1.6 } = {}) {
  const src = readFileSync(path.join(iconDir, `${name}.mjs`), 'utf8')
  const alias = src.match(/export \{ default \} from '\.\/(.+)\.mjs'/)
  if (alias) return icon(alias[1], { size, color, stroke })
  const start = src.indexOf('const __iconData = ') + 'const __iconData = '.length
  // Trusted local package data (lucide-react), evaluated as a plain object literal.
  const { node } = new Function(`return ${src.slice(start, src.indexOf('\n};', start) + 2)}`)()
  const body = node
    .map(
      ([tag, attrs]) =>
        `<${tag} ${Object.entries(attrs)
          .filter(([k]) => k !== 'key')
          .map(([k, v]) => `${k}="${v}"`)
          .join(' ')}/>`,
    )
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`
}

const palettes = {
  Elétrica: ['#f7c948', '#e07b24', '#5a3708'],
  Encanamento: ['#4fb3e0', '#1d5f9e', '#0b2e52'],
  'Limpeza / diarista': ['#66d6b8', '#1f8a70', '#0b3d31'],
  'TI e informática': ['#8b97f0', '#3a3f9e', '#171a4a'],
  Pintura: ['#ff9a76', '#d1477a', '#4d1630'],
}

// Hand-written per listing so the pictures match what each one offers.
const listings = {
  'Instalação de chuveiro elétrico': {
    main: 'shower-head',
    more: ['zap', 'plug', 'shield-check', 'gauge', 'wrench'],
    items: ['Ponto elétrico conferido', 'Fiação e disjuntor adequados', 'Teste com você no local'],
  },
  'Troca de quadro de distribuição': {
    main: 'circuit-board',
    more: ['zap', 'shield-check', 'cable', 'gauge', 'lightbulb'],
    items: ['Disjuntores novos e etiquetados', 'DR e DPS de proteção', 'Laudo do que foi trocado'],
  },
  'Limpeza pós-obra completa': {
    main: 'sparkles',
    more: ['spray-can', 'brush', 'house', 'sofa', 'droplets'],
    items: [
      'Remoção de pó fino e respingos',
      'Vidros, pisos e rodapés',
      'Produtos e aspirador próprios',
    ],
  },
  'Diária de limpeza residencial': {
    main: 'house',
    more: ['sparkles', 'sofa', 'bath', 'spray-can', 'brush'],
    items: ['Cozinha e banheiros', 'Quartos e áreas comuns', 'Roupa de cama trocada'],
  },
  'Caça-vazamento sem quebra': {
    main: 'droplets',
    more: ['gauge', 'waves', 'wrench', 'house', 'shield-check'],
    items: ['Detecção com geofone', 'Sem quebrar paredes à toa', 'Relatório do ponto encontrado'],
  },
  'Desentupimento de esgoto': {
    main: 'toilet',
    more: ['wrench', 'droplet', 'bath', 'waves', 'shield-check'],
    items: ['Pias, ralos e vasos', 'Equipamento de desobstrução', 'Limpeza do local depois'],
  },
  'Configuração de rede para escritório': {
    main: 'router',
    more: ['wifi', 'laptop', 'cable', 'shield-check', 'monitor-cog'],
    items: ['Wi-Fi em todas as salas', 'Rede separada para visitantes', 'Até 15 computadores'],
  },
  'Formatação e backup de notebook': {
    main: 'laptop',
    more: ['hard-drive', 'shield-check', 'monitor-cog', 'cable', 'sparkles'],
    items: [
      'Backup completo antes de tudo',
      'Sistema, drivers e programas',
      'Devolvido pronto para usar',
    ],
  },
  'Pintura de apartamento de 2 quartos': {
    main: 'paint-roller',
    more: ['paintbrush', 'palette', 'house', 'ruler', 'sparkles'],
    items: ['Massa corrida e lixamento', 'Duas demãos de acrílica', 'Móveis e pisos protegidos'],
  },
  'Textura e grafiato em parede': {
    main: 'paintbrush',
    more: ['paint-roller', 'palette', 'hammer', 'ruler', 'house'],
    items: ['Textura ou grafiato', 'Paredes internas e muros', 'Cor à sua escolha'],
  },
}

const page = (body, w, h) => `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}
body{width:${w}px;height:${h}px;overflow:hidden;font-family:'Helvetica Neue',Arial,sans-serif}
.grain:after{content:'';position:absolute;inset:0;opacity:.07;background-image:radial-gradient(#000 1px,transparent 1px);background-size:4px 4px}
</style></head><body>${body}</body></html>`

function hero(title, l, [a, b, dark]) {
  const spots = [
    [120, 140, 150],
    [930, 120, 130],
    [990, 600, 150],
    [150, 640, 130],
    [545, 40, 110],
  ]
  const tiles = l.more
    .map(
      (n, i) =>
        `<div style="position:absolute;left:${spots[i][0]}px;top:${spots[i][1]}px;width:${spots[i][2]}px;height:${spots[i][2]}px;border-radius:32px;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.35);display:grid;place-items:center;transform:rotate(${(i % 2 ? 1 : -1) * (6 + i * 2)}deg);box-shadow:0 20px 40px rgba(0,0,0,.12)">${icon(n, { size: spots[i][2] * 0.48 })}</div>`,
    )
    .join('')
  return `<div class="grain" style="position:relative;width:100%;height:100%;background:linear-gradient(135deg,${a},${b})">
  <div style="position:absolute;width:700px;height:700px;border-radius:50%;left:-200px;top:-260px;background:radial-gradient(rgba(255,255,255,.45),transparent 65%)"></div>
  <div style="position:absolute;width:600px;height:600px;border-radius:50%;right:-180px;bottom:-240px;background:radial-gradient(${dark}55,transparent 65%)"></div>
  ${tiles}
  <div style="position:absolute;left:50%;top:46%;transform:translate(-50%,-50%);width:380px;height:380px;border-radius:96px;background:#fff;display:grid;place-items:center;box-shadow:0 40px 80px rgba(0,0,0,.25)">${icon(l.main, { size: 220, color: b, stroke: 1.4 })}</div>
  <div style="position:absolute;left:50%;bottom:70px;transform:translateX(-50%);padding:14px 28px;border-radius:999px;background:rgba(255,255,255,.92);color:${dark};font-size:30px;font-weight:700;white-space:nowrap">${title}</div>
  </div>`
}

function detail(title, l, [a, b, dark], who) {
  const pattern = Array.from({ length: 48 }, (_, i) => {
    const n = [l.main, ...l.more][i % 6]
    return `<div style="display:grid;place-items:center;opacity:.13;transform:rotate(${((i * 37) % 40) - 20}deg)">${icon(n, { size: 70 })}</div>`
  }).join('')
  return `<div class="grain" style="position:relative;width:100%;height:100%;background:${dark}">
  <div style="position:absolute;inset:-40px;display:grid;grid-template-columns:repeat(8,1fr);gap:20px">${pattern}</div>
  <div style="position:absolute;left:90px;top:150px;right:90px;bottom:150px;border-radius:44px;background:linear-gradient(135deg,${a},${b});padding:70px;display:flex;flex-direction:column;justify-content:space-between;box-shadow:0 50px 100px rgba(0,0,0,.4)">
    <div style="width:150px;height:150px;border-radius:40px;background:rgba(255,255,255,.95);display:grid;place-items:center">${icon(l.main, { size: 96, color: b, stroke: 1.6 })}</div>
    <div><div style="color:#fff;font-size:62px;font-weight:800;line-height:1.08;letter-spacing:-1px;text-shadow:0 2px 12px rgba(0,0,0,.15)">${title}</div>
    <div style="margin-top:20px;color:rgba(255,255,255,.92);font-size:30px;font-weight:600">${who}</div></div>
  </div></div>`
}

function checklist(title, l, [a, b, dark]) {
  const rows = l.items
    .map(
      (t) =>
        `<div style="display:flex;align-items:center;gap:26px;padding:26px 0;border-top:2px solid #eef1ee"><div style="width:64px;height:64px;border-radius:20px;background:${a}33;display:grid;place-items:center;flex:none">${icon('shield-check', { size: 38, color: b, stroke: 2 })}</div><div style="font-size:38px;color:#1f2a24;font-weight:600">${t}</div></div>`,
    )
    .join('')
  return `<div class="grain" style="position:relative;width:100%;height:100%;background:linear-gradient(160deg,#f7faf8,${a}55)">
  <div style="position:absolute;right:-60px;top:-60px;opacity:.25;transform:rotate(-12deg)">${icon(l.main, { size: 520, color: b, stroke: 1 })}</div>
  <div style="position:absolute;left:90px;right:240px;top:120px;background:#fff;border-radius:40px;padding:56px 60px;box-shadow:0 40px 90px rgba(20,40,30,.15)">
    <div style="color:${b};font-size:26px;font-weight:800;letter-spacing:3px;text-transform:uppercase">O que está incluído</div>
    <div style="font-size:48px;font-weight:800;color:#14211b;margin:16px 0 26px;line-height:1.1">${title}</div>${rows}
  </div></div>`
}

// Flat illustrated portraits; nobody real is depicted.
const people = {
  ana: { skin: '#e8b58f', hair: '#4a2c1d', style: 'long', shirt: '#2f8f5b', bg: '#d9efe2' },
  pedro: { skin: '#c68b64', hair: '#2b211c', style: 'short', shirt: '#3a5fa8', bg: '#dde6f6' },
  lucia: { skin: '#f0c9a6', hair: '#8a5a35', style: 'bun', shirt: '#b84a6b', bg: '#f6dfe6' },
  marcos: { skin: '#a8714c', hair: '#1d1714', style: 'buzz', shirt: '#e0962d', bg: '#fbead0' },
  juliana: { skin: '#8d5a3b', hair: '#1c1310', style: 'curly', shirt: '#1f8a70', bg: '#d4efe7' },
  rafael: { skin: '#d9a07a', hair: '#3b2a20', style: 'side', shirt: '#1d5f9e', bg: '#d8e8f5' },
  camila: { skin: '#f1cfb3', hair: '#1f1a17', style: 'bob', shirt: '#4b52b8', bg: '#e1e3f8' },
  bruno: { skin: '#b8805a', hair: '#5a3a24', style: 'beard', shirt: '#d1477a', bg: '#f8dde6' },
}
function avatar(p) {
  const hairBack =
    {
      long: `<path d="M150 230 Q150 120 256 112 Q362 120 362 230 L372 400 Q256 430 140 400 Z" fill="${p.hair}"/>`,
      curly: `<g fill="${p.hair}">${Array.from({ length: 14 }, (_, i) => {
        const t = (i / 13) * Math.PI
        return `<circle cx="${256 - Math.cos(t) * 118}" cy="${232 - Math.sin(t) * 108}" r="44"/>`
      }).join('')}<circle cx="150" cy="300" r="40"/><circle cx="362" cy="300" r="40"/></g>`,
      bun: `<circle cx="256" cy="100" r="46" fill="${p.hair}"/>`,
      bob: `<path d="M152 240 Q150 130 256 122 Q362 130 360 240 L364 330 Q330 318 322 300 L190 300 Q182 318 148 330 Z" fill="${p.hair}"/>`,
    }[p.style] || ''
  const hairTop = {
    long: `<path d="M168 220 Q190 140 256 138 Q330 140 348 222 Q300 170 220 186 Q190 196 168 220Z" fill="${p.hair}"/>`,
    bun: `<path d="M166 226 Q176 140 256 136 Q338 140 346 226 Q300 172 256 176 Q206 176 166 226Z" fill="${p.hair}"/>`,
    bob: `<path d="M164 232 Q180 142 256 138 Q334 142 350 232 Q320 180 256 186 Q196 182 164 232Z" fill="${p.hair}"/>`,
    short: `<path d="M166 214 Q170 136 256 132 Q344 136 346 214 Q330 176 256 176 Q186 176 166 214Z" fill="${p.hair}"/>`,
    buzz: `<path d="M172 206 Q186 146 256 144 Q328 146 340 206 Q300 178 256 178 Q208 178 172 206Z" fill="${p.hair}" opacity=".85"/>`,
    side: `<path d="M164 220 Q166 130 262 128 Q348 134 348 214 Q312 160 230 168 Q190 176 164 220Z" fill="${p.hair}"/>`,
    beard: `<path d="M168 210 Q176 138 256 134 Q338 138 344 210 Q306 172 256 174 Q204 172 168 210Z" fill="${p.hair}"/>`,
    curly: '',
  }[p.style]
  const beard =
    p.style === 'beard'
      ? `<path d="M188 262 Q196 352 256 360 Q316 352 324 262 Q316 316 256 322 Q196 316 188 262Z" fill="${p.hair}"/>`
      : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${p.bg}"/>
  <circle cx="420" cy="90" r="120" fill="#fff" opacity=".35"/>
  ${hairBack}
  <path d="M86 512 Q96 400 196 380 L316 380 Q416 400 426 512Z" fill="${p.shirt}"/>
  <path d="M220 340 L292 340 L296 394 Q256 420 216 394Z" fill="${p.skin}" filter="brightness(.92)"/>
  <ellipse cx="256" cy="250" rx="92" ry="108" fill="${p.skin}"/>
  <ellipse cx="164" cy="258" rx="16" ry="24" fill="${p.skin}"/><ellipse cx="348" cy="258" rx="16" ry="24" fill="${p.skin}"/>
  ${hairTop}${beard}
  <circle cx="222" cy="252" r="8" fill="#2a1d17"/><circle cx="290" cy="252" r="8" fill="#2a1d17"/>
  <path d="M206 228 Q222 220 238 228" stroke="${p.hair}" stroke-width="6" fill="none" stroke-linecap="round"/>
  <path d="M274 228 Q290 220 306 228" stroke="${p.hair}" stroke-width="6" fill="none" stroke-linecap="round"/>
  <path d="M228 300 Q256 322 284 300" stroke="#8a3b2b" stroke-width="7" fill="none" stroke-linecap="round"/>
  <ellipse cx="206" cy="290" rx="14" ry="8" fill="#e46a5a" opacity=".22"/><ellipse cx="306" cy="290" rx="14" ry="8" fill="#e46a5a" opacity=".22"/>
  </svg>`
}

async function call(pathname, { token, ...init } = {}) {
  const res = await fetch(API + pathname, {
    ...init,
    headers: { ...(init.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  })
  if (!res.ok)
    throw new Error(`${init.method || 'GET'} ${pathname}: ${res.status} ${await res.text()}`)
  return res.status === 204 ? null : res.json()
}
async function login(user) {
  const r = await call('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: user + DOMAIN, password: PASSWORD }),
  })
  return { token: r.accessToken, me: r.user }
}

const browser = await chromium.launch()
const tab = await browser.newPage()
async function shot(html, w, h) {
  await tab.setViewportSize({ width: w, height: h })
  await tab.setContent(page(html, w, h))
  return tab.screenshot({ type: 'jpeg', quality: 86 })
}

let uploaded = 0,
  avatars = 0
for (const [user, look] of Object.entries(people)) {
  const { token, me } = await login(user)
  if (!me.avatarVersion) {
    const png = await shot(avatar(look).replace('<svg', '<svg style="display:block"'), 512, 512)
    const form = new FormData()
    form.append('file', new Blob([png], { type: 'image/jpeg' }), `${user}.jpg`)
    await call('/users/me/avatar', { method: 'PUT', body: form, token })
    avatars++
  }
  if (me.role !== 'FREELANCER') continue
  const mine = await call('/freelancer/services', { token })
  for (const s of mine) {
    const l = listings[s.title]
    if (!l || (s.images && s.images.length)) continue
    const colors = palettes[s.category?.name] || palettes.Elétrica
    const who = `${me.name} · ${me.city || ''}`
    const files = [
      await shot(hero(s.title, l, colors), 1200, 900),
      await shot(detail(s.title, l, colors, who), 1200, 900),
      await shot(checklist(s.title, l, colors), 1200, 900),
    ]
    const form = new FormData()
    files.forEach((f, i) =>
      form.append('files', new Blob([f], { type: 'image/jpeg' }), `${user}-${i + 1}.jpg`),
    )
    await call(`/services/${s.id}/images`, { method: 'POST', body: form, token })
    uploaded++
    console.log(`fotos: ${s.title}`)
  }
}
await browser.close()
console.log(`${uploaded} anúncios com fotos, ${avatars} avatares enviados.`)
