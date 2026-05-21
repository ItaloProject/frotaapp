const CACHE_NAME = 'frota-checklists-v12'
const BACKGROUND_SYNC_TAG = 'frota-sync-checklists'

// Apenas o shell estático que raramente muda
const APP_SHELL = [
  '/manifest.webmanifest',
  '/branding/app-icon-any.png',
  '/branding/app-icon-maskable.png',
  '/branding/favicon.png',
  '/branding/cgb-logo-on-light.svg',
  '/branding/cgb-logo-on-dark.svg',
  '/branding/cgb-sidebar-mark.png',
  '/icons.svg',
]

// ---------------------------------------------------------------------------
// Install — pré-cacheia apenas o shell estático; JS/CSS têm hash no nome,
// serão cacheados individualmente pelo fetch handler.
// ---------------------------------------------------------------------------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),  // ativa imediatamente sem esperar tabs fecharem
  )
})

// ---------------------------------------------------------------------------
// Activate — remove caches antigos e notifica clientes sobre nova versão.
// ---------------------------------------------------------------------------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim())
      .then(async () => {
        // Avisa todos os clientes abertos que há uma nova versão disponível
        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        for (const client of clients) {
          client.postMessage({ type: 'SW_UPDATED' })
        }
      }),
  )
})

// ---------------------------------------------------------------------------
// Fetch — estratégia por tipo de recurso:
//   • Navegação (HTML): network-first com fallback offline
//   • Assets com hash (JS/CSS): cache-first (hash garante frescor)
//   • Outros: network-first com cache como fallback
// ---------------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Ignora requisições externas (Supabase, Nominatim, etc.)
  if (url.origin !== self.location.origin) return

  // Navegação — network-first, fallback para / em offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
          return response
        })
        .catch(async () => {
          const cached = await caches.match(request)
          if (cached) return cached
          const root = await caches.match('/')
          if (root) return root
          return new Response('Offline', { status: 503 })
        }),
    )
    return
  }

  // Assets com hash no nome (ex: index-Abc123.js) — cache-first
  const hasHash = /\.[0-9a-f]{8,}\.(js|css)$/i.test(url.pathname)
  if (hasHash) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
          return response
        })
      }),
    )
    return
  }

  // Demais recursos — network-first com fallback do cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
        return response
      })
      .catch(async () => {
        const cached = await caches.match(request)
        return cached || new Response('Offline', { status: 503 })
      }),
  )
})

// ---------------------------------------------------------------------------
// Background Sync
// ---------------------------------------------------------------------------
self.addEventListener('sync', (event) => {
  if (event.tag === BACKGROUND_SYNC_TAG) {
    event.waitUntil(notifyClientsToSync())
  }
})

async function notifyClientsToSync() {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  for (const client of clients) {
    client.postMessage({ type: 'SW_BACKGROUND_SYNC' })
  }
}

self.addEventListener('message', (event) => {
  if (event.data?.type === 'REGISTER_BACKGROUND_SYNC') {
    if ('SyncManager' in self) {
      self.registration.sync.register(BACKGROUND_SYNC_TAG).catch(() => {})
    }
  }
})
