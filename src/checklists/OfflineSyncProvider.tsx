import { useEffect } from 'react'
import { syncOfflineChecklists } from './syncOfflineChecklists'
import { getOfflineQueueSummary } from './offlineQueue'

/** Background Sync API (SyncManager) — não incluída nos tipos DOM padrão do TypeScript. */
type ServiceWorkerRegistrationWithSync = ServiceWorkerRegistration & {
  readonly sync: { register(tag: string): Promise<void> }
}

const RETRY_INTERVAL_MS = 2 * 60 * 1000

async function registerBackgroundSync() {
  if (!('serviceWorker' in navigator) || !('SyncManager' in window)) return
  try {
    const reg = (await navigator.serviceWorker.ready) as ServiceWorkerRegistrationWithSync
    await reg.sync.register('frota-sync-checklists')
  } catch {
    // Background Sync não suportado — sem problema, cai no retry por interval
  }
}

export function OfflineSyncProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const sync = async () => {
      if (!navigator.onLine) return
      await syncOfflineChecklists()
      // Após sincronizar, registra background sync para quando fechar o app
      void registerBackgroundSync()
    }

    // Ao voltar online: sincroniza e registra background sync
    const handleOnline = () => void sync()

    // Ouve mensagens do Service Worker (background sync com app fechado)
    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SW_BACKGROUND_SYNC') {
        void sync()
      }
    }

    void sync()
    window.addEventListener('online', handleOnline)
    navigator.serviceWorker?.addEventListener('message', handleSwMessage)
    const interval = setInterval(() => void sync(), RETRY_INTERVAL_MS)

    // Registra background sync inicial (para caso já haja pendentes)
    getOfflineQueueSummary().then((s) => {
      if (s.pending > 0 || s.error > 0) void registerBackgroundSync()
    })

    return () => {
      window.removeEventListener('online', handleOnline)
      navigator.serviceWorker?.removeEventListener('message', handleSwMessage)
      clearInterval(interval)
    }
  }, [])

  return <>{children}</>
}
