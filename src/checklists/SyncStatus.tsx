import { useEffect, useState } from 'react'
import { getOfflineQueueSummary, subscribeOfflineQueue, type SyncSummary } from './offlineQueue'
import { syncOfflineChecklists, subscribeSyncResult } from './syncOfflineChecklists'

export function SyncStatus() {
  const [online, setOnline] = useState(() => navigator.onLine)
  const [summary, setSummary] = useState<SyncSummary>({ pending: 0, syncing: 0, error: 0 })
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    let successTimer: ReturnType<typeof setTimeout> | null = null

    const refresh = async () => {
      const next = await getOfflineQueueSummary()
      if (mounted) setSummary(next)
    }

    const handleOnline = () => {
      setOnline(true)
      void syncOfflineChecklists().then(refresh).catch(refresh)
    }
    const handleOffline = () => setOnline(false)

    // Ouve resultado de sincronização para exibir notificação de sucesso
    const unsubscribeSync = subscribeSyncResult((result) => {
      if (!mounted) return
      if (successTimer) clearTimeout(successTimer)
      setSuccessMsg(
        result.synced === 1
          ? '1 checklist sincronizado com sucesso!'
          : `${result.synced} checklists sincronizados com sucesso!`
      )
      // Some após 5 segundos
      successTimer = setTimeout(() => {
        if (mounted) setSuccessMsg(null)
      }, 5000)
    })

    void refresh()
    const unsubscribeQueue = subscribeOfflineQueue(refresh)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      mounted = false
      if (successTimer) clearTimeout(successTimer)
      unsubscribeQueue()
      unsubscribeSync()
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Notificação de sucesso (sobrepõe o banner normal por 5s)
  if (successMsg) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-extrabold text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300">
        <span>✓</span>
        {successMsg}
      </div>
    )
  }

  const totalPendencias = summary.pending + summary.syncing + summary.error
  const tone = !online
    ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300'
    : summary.error > 0
    ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300'
    : totalPendencias > 0
    ? 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-300'
    : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300'

  const label = !online
    ? 'Offline: envios serão salvos neste dispositivo'
    : summary.syncing > 0
    ? 'Sincronizando checklists pendentes...'
    : summary.error > 0
    ? `${summary.error} checklist(s) aguardando nova tentativa`
    : summary.pending > 0
    ? `${summary.pending} checklist(s) pendente(s) de sincronização`
    : 'Online: checklists serão enviados automaticamente'

  return (
    <div className={`rounded-xl border px-3 py-2 text-xs font-extrabold ${tone}`}>
      {label}
    </div>
  )
}
