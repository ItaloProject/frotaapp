/**
 * Captura screenshots reais das telas do portal para a apresentação PDF.
 * Pré-requisito: servidor dev rodando (npm run dev) em localhost:5173
 * Uso: node scripts/capture-apresentacao-screenshots.mjs
 */
import { chromium } from 'playwright'
import { mkdirSync, readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '..', 'public', 'apresentacao-screenshots')
const ENV_FILE = join(__dirname, '..', '.env')

const BASE_URL = process.env.SCREENSHOT_BASE_URL ?? 'http://localhost:5173'

function loadEnv() {
  const env = {}
  if (!existsSync(ENV_FILE)) return env
  for (const line of readFileSync(ENV_FILE, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
  }
  return env
}

const DESKTOP = { width: 1280, height: 800 }
const MOBILE = { width: 390, height: 844 }

/** @type {Array<{ id: string; path: string; auth?: boolean; viewport?: typeof DESKTOP; waitFor?: string; delay?: number }>} */
const CAPTURES = [
  { id: 'login', path: '/login', waitFor: '#login-email', delay: 800 },
  { id: 'dashboard', path: '/', auth: true, waitFor: 'text=Dashboard', delay: 2500 },
  { id: 'gerenciar', path: '/gerenciar', auth: true, waitFor: '[data-tour="manage-stats"]', delay: 1500 },
  { id: 'evolucao', path: '/gerenciar/evolucao', auth: true, waitFor: '[data-tour="evolucao-kpis"]', delay: 2000 },
  { id: 'historico', path: '/gerenciar/historico', auth: true, waitFor: '[data-tour="historico-lista"]', delay: 1500 },
  { id: 'checklists', path: '/gerenciar/checklists', auth: true, waitFor: '[data-tour="checklists-actions"]', delay: 1200 },
  { id: 'resultados', path: '/gerenciar/checklists/resultados', auth: true, delay: 2500 },
  { id: 'registro', path: '/registro', auth: true, delay: 8000 },
  { id: 'checklist', path: '/checklist', viewport: MOBILE, waitFor: 'text=Escolha o checklist', delay: 1000 },
  { id: 'usuarios', path: '/usuarios', auth: true, delay: 2000 },
]

function supabaseStorageKey(supabaseUrl) {
  const ref = new URL(supabaseUrl).hostname.split('.')[0]
  return `sb-${ref}-auth-token`
}

async function supabaseLogin(supabaseUrl, anonKey, email, password) {
  const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json()
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description ?? data.msg ?? `HTTP ${res.status}`)
  }
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + (data.expires_in ?? 3600),
    expires_in: data.expires_in ?? 3600,
    token_type: 'bearer',
    user: data.user,
  }
}

function credentialCandidates(env) {
  const list = []
  const push = (email, password, label) => {
    if (email && password) list.push({ email, password, label })
  }
  push(process.env.SCREENSHOT_EMAIL, process.env.SCREENSHOT_PASSWORD, 'SCREENSHOT_*')
  push(env.VITE_ADMIN_EMAIL, env.VITE_ADMIN_PASSWORD, 'VITE_ADMIN_*')
  push('demo@cgbengenharia.com.br', env.VITE_ADMIN_PASSWORD, 'demo + admin pass')
  push('lucas.moreira@cgbengenharia.com.br', 'Cgb@2026', 'admin seed')
  push('janaina.feitosa@cgbengenharia.com.br', 'Cgb@2026', 'admin seed 2')
  return list
}

async function resolveSession(env) {
  const supabaseUrl = env.VITE_SUPABASE_URL
  const anonKey = env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) {
    throw new Error('Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env')
  }

  const errors = []
  for (const cred of credentialCandidates(env)) {
    try {
      const session = await supabaseLogin(supabaseUrl, anonKey, cred.email, cred.password)
      console.log(`Autenticado como ${cred.email} (${cred.label})`)
      return { session, storageKey: supabaseStorageKey(supabaseUrl), email: cred.email, password: cred.password }
    } catch (err) {
      errors.push(`${cred.label}: ${err instanceof Error ? err.message : err}`)
    }
  }
  throw new Error(`Nenhuma credencial funcionou:\n  ${errors.join('\n  ')}`)
}

async function waitForAppReady(page, selector, timeout = 25000) {
  if (selector) {
    await page.waitForSelector(selector, { timeout, state: 'visible' })
  }
  await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {})
}

async function bypassPasswordChange(page) {
  if (!page.url().includes('/trocar-senha')) return
  console.log('  Trocando senha temporária…')
  const nova = `CgbApresentacao${Date.now().toString().slice(-6)}!`
  const inputs = page.locator('input[type="password"]')
  await inputs.nth(0).fill(nova)
  await inputs.nth(1).fill(nova)
  await page.click('button[type="submit"]')
  await page.waitForURL((url) => !url.pathname.includes('/trocar-senha'), { timeout: 20000 })
  await page.waitForTimeout(1200)
}

async function capture() {
  const env = loadEnv()
  mkdirSync(OUT_DIR, { recursive: true })

  let authInfo = null
  try {
    authInfo = await resolveSession(env)
  } catch (err) {
    console.warn('Login Supabase indisponível — capturando apenas páginas públicas.')
    console.warn(String(err instanceof Error ? err.message : err))
  }

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: DESKTOP,
    deviceScaleFactor: 2,
    locale: 'pt-BR',
  })

  if (authInfo) {
    await context.addInitScript(
      ({ storageKey, session }) => {
        localStorage.setItem(storageKey, JSON.stringify(session))
      },
      { storageKey: authInfo.storageKey, session: authInfo.session },
    )
  } else {
    // Dev: renderiza telas autenticadas sem Supabase (layout real + dados locais/mock)
    await context.addInitScript(() => {
      localStorage.setItem('frota.screenshot.bypass', '1')
    })
    console.log('Modo captura dev: bypass de autenticação ativo')
  }

  const page = await context.newPage()

  for (const cap of CAPTURES) {
    try {
      const viewport = cap.viewport ?? DESKTOP
      await page.setViewportSize(viewport)

      console.log(`Capturando: ${cap.id} (${cap.path})`)
      await page.goto(`${BASE_URL}${cap.path}`, { waitUntil: 'domcontentloaded', timeout: 30000 })

      if (cap.auth) {
        await bypassPasswordChange(page)
        if (page.url().includes('/login')) {
          console.warn(`  ⚠ Sessão expirada em ${cap.id} — pulando`)
          continue
        }
      }

      if (cap.path === '/usuarios') {
        if (page.url().includes('/login') || (page.url().endsWith('/') && !page.url().includes('/usuarios'))) {
          console.warn('  ⚠ /usuarios inacessível (requer super_admin) — pulando')
          continue
        }
      }

      await waitForAppReady(page, cap.waitFor)
      if (cap.delay) await page.waitForTimeout(cap.delay)

      const outPath = join(OUT_DIR, `${cap.id}.png`)
      await page.screenshot({ path: outPath, fullPage: false })
      console.log(`  ✓ ${outPath}`)
    } catch (err) {
      console.warn(`  ⚠ Falha em ${cap.id}:`, err instanceof Error ? err.message : err)
    }
  }

  await browser.close()
  console.log('\nScreenshots salvos em:', OUT_DIR)
}

capture().catch((err) => {
  console.error(err)
  process.exit(1)
})
