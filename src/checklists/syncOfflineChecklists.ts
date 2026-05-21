import { supabase, type ChecklistInsert } from '../lib/supabase'
import { uploadChecklistEvidenceFile } from '../lib/checklistEvidenceUpload'
import {
  cleanupOfflineQueue,
  listPendingOfflineChecklists,
  removeOfflineChecklist,
  updateOfflineChecklist,
  type OfflineChecklistFile,
  type OfflineChecklistRecord,
} from './offlineQueue'

export type SyncResult = {
  synced: number
  failed: number
}

type SyncListener = (result: SyncResult) => void
const syncListeners = new Set<SyncListener>()

export function subscribeSyncResult(listener: SyncListener) {
  syncListeners.add(listener)
  return () => syncListeners.delete(listener)
}

function notifySyncResult(result: SyncResult) {
  for (const l of syncListeners) l(result)
}

function safeFileName(fileName: string) {
  return fileName.replace(/\s+/g, '_').replace(/[^\w.-]/g, '_')
}

async function uploadOfflineFile(schemaId: string, ts: number, file: OfflineChecklistFile, index: number): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const itemPart = file.itemId ? `item-${file.itemId}` : 'evidencia'
  const path = `${schemaId}/${ts}-${itemPart}-${index}-${safeFileName(file.name || `arquivo.${ext}`)}`
  const uploadFile = new File([file.file], file.name || `arquivo.${ext}`, { type: file.type || file.file.type })
  const url = await uploadChecklistEvidenceFile(uploadFile, path)
  if (!url) throw new Error('Falha ao enviar evidência (armazenamento)')
  return url
}

async function sendRecord(record: OfflineChecklistRecord) {
  const ts = Date.now()
  const payload: ChecklistInsert = {
    ...record.payload,
    observacoes: { ...record.payload.observacoes },
    evidencia_urls: [...record.payload.evidencia_urls],
  }
  const itemPhotoUrls = new Map<string, string[]>()

  for (const [index, file] of record.files.entries()) {
    const url = await uploadOfflineFile(payload.tipo, ts, file, index)
    payload.evidencia_urls.push(url)
    if (file.itemId) {
      const urls = itemPhotoUrls.get(file.itemId) ?? []
      urls.push(url)
      itemPhotoUrls.set(file.itemId, urls)
    }
  }

  for (const [itemId, urls] of itemPhotoUrls.entries()) {
    const current = payload.observacoes[itemId] ?? ''
    payload.observacoes[itemId] = current
      ? `${current}\n__fotos__:${urls.join('|')}`
      : `__fotos__:${urls.join('|')}`
  }

  const { error } = await supabase.from('checklists').insert(payload)
  if (error) throw error
}

let syncingPromise: Promise<SyncResult> | null = null

export function syncOfflineChecklists(): Promise<SyncResult> {
  if (syncingPromise) return syncingPromise

  syncingPromise = (async (): Promise<SyncResult> => {
    const records = await listPendingOfflineChecklists()
    let synced = 0
    let failed = 0

    for (const record of records) {
      const syncingRecord: OfflineChecklistRecord = {
        ...record,
        status: 'syncing',
        attempts: record.attempts + 1,
        lastError: null,
      }
      await updateOfflineChecklist(syncingRecord)
      try {
        await sendRecord(syncingRecord)
        await removeOfflineChecklist(syncingRecord.localId)
        synced++
      } catch (error) {
        await updateOfflineChecklist({
          ...syncingRecord,
          status: 'error',
          lastError: error instanceof Error ? error.message : 'Erro desconhecido ao sincronizar',
        })
        failed++
      }
    }

    await cleanupOfflineQueue()

    const result: SyncResult = { synced, failed }
    if (synced > 0) notifySyncResult(result)
    return result
  })().finally(() => {
    syncingPromise = null
  })

  return syncingPromise
}

// Registra background sync no SW para quando o app estiver fechado
export function requestBackgroundSync() {
  if (!('serviceWorker' in navigator)) return
  navigator.serviceWorker.ready.then((reg) => {
    reg.active?.postMessage({ type: 'REGISTER_BACKGROUND_SYNC' })
  }).catch(() => {})
}
