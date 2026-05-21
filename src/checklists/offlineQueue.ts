import type { ChecklistInsert } from '../lib/supabase'

const DB_NAME = 'frota-checklists-offline'
const DB_VERSION = 1
const STORE_NAME = 'pending-checklists'

/** Número máximo de tentativas antes de abandonar o checklist. */
export const MAX_RETRY_ATTEMPTS = 5

/** Checklists sincronizados há mais de X dias são removidos automaticamente. */
const SYNCED_CLEANUP_DAYS = 30

export type OfflineChecklistFile = {
  name: string
  type: string
  itemId: string | null
  file: Blob
}

export type OfflineChecklistStatus = 'pending' | 'syncing' | 'synced' | 'error'

export type OfflineChecklistRecord = {
  localId: string
  createdAt: string
  updatedAt: string
  status: OfflineChecklistStatus
  attempts: number
  lastError: string | null
  payload: ChecklistInsert
  files: OfflineChecklistFile[]
}

export type SyncSummary = {
  pending: number
  syncing: number
  error: number
}

type Listener = () => void

const listeners = new Set<Listener>()

function notify() {
  for (const listener of listeners) listener()
}

export function subscribeOfflineQueue(listener: Listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'localId' })
        store.createIndex('status', 'status')
        store.createIndex('createdAt', 'createdAt')
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => {
      dbPromise = null  // permite retry na próxima chamada
      reject(request.error)
    }
  })
  return dbPromise
}

export async function enqueueChecklist(payload: ChecklistInsert, files: OfflineChecklistFile[]) {
  const now = new Date().toISOString()
  const record: OfflineChecklistRecord = {
    localId: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    status: 'pending',
    attempts: 0,
    lastError: null,
    payload,
    files,
  }

  const db = await openDb()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  tx.objectStore(STORE_NAME).put(record)
  await txDone(tx)

  // Registra background sync no SW para sincronizar mesmo com app fechado
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then((reg) => {
      if ('sync' in reg) {
        return (reg.sync as { register: (tag: string) => Promise<void> }).register('frota-sync-checklists')
      }
    }).catch(() => {})
  }
  notify()
  return record
}

export async function listOfflineChecklists(): Promise<OfflineChecklistRecord[]> {
  const db = await openDb()
  const tx = db.transaction(STORE_NAME, 'readonly')
  const records = await requestToPromise<OfflineChecklistRecord[]>(tx.objectStore(STORE_NAME).getAll())
  await txDone(tx)
  return records.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export async function listPendingOfflineChecklists(): Promise<OfflineChecklistRecord[]> {
  const records = await listOfflineChecklists()
  // Registros presos em 'syncing' por mais de 5 minutos são tratados como 'error'
  const SYNCING_TIMEOUT_MS = 5 * 60 * 1000
  const now = Date.now()
  return records.filter((r) => {
    if (r.status === 'syncing') {
      return now - new Date(r.updatedAt).getTime() > SYNCING_TIMEOUT_MS && r.attempts < MAX_RETRY_ATTEMPTS
    }
    return (r.status === 'pending' || r.status === 'error') && r.attempts < MAX_RETRY_ATTEMPTS
  })
}

export async function updateOfflineChecklist(record: OfflineChecklistRecord) {
  const db = await openDb()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  tx.objectStore(STORE_NAME).put({ ...record, updatedAt: new Date().toISOString() })
  await txDone(tx)
  notify()
}

export async function removeOfflineChecklist(localId: string) {
  const db = await openDb()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  tx.objectStore(STORE_NAME).delete(localId)
  await txDone(tx)
  notify()
}

export async function getOfflineQueueSummary(): Promise<SyncSummary> {
  const records = await listOfflineChecklists()
  return records.reduce<SyncSummary>(
    (acc, record) => {
      if (record.status === 'pending') acc.pending++
      if (record.status === 'syncing') acc.syncing++
      if (record.status === 'error' && record.attempts < MAX_RETRY_ATTEMPTS) acc.error++
      return acc
    },
    { pending: 0, syncing: 0, error: 0 },
  )
}

/**
 * Remove registros já sincronizados com mais de SYNCED_CLEANUP_DAYS dias,
 * e registros com erro que esgotaram todas as tentativas.
 * Chamado automaticamente pelo syncOfflineChecklists após cada sync.
 */
export async function cleanupOfflineQueue(): Promise<void> {
  const records = await listOfflineChecklists()
  const cutoff = Date.now() - SYNCED_CLEANUP_DAYS * 86_400_000
  const toRemove = records.filter(
    (r) =>
      (r.status === 'synced' && new Date(r.updatedAt).getTime() < cutoff) ||
      (r.status === 'error' && r.attempts >= MAX_RETRY_ATTEMPTS),
  )
  await Promise.all(toRemove.map((r) => removeOfflineChecklist(r.localId)))
}
