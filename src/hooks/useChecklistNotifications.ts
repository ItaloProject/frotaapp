import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { isOperacionalAtivosDashboardKpi } from '../frota/vehicleOperationalStatus'
import type { FleetVehicle } from '../frota/vehicleRegistry'

export type ChecklistNotification = {
  id: string           // e.g. "2026-05-19-10"
  timestamp: number    // ms quando foi gerada
  hojeIso: string
  realizaram: number
  naoRealizaram: number
  total: number
  lida: boolean
}

const STORAGE_KEY = 'frota.notifications.checklist'
const NOTIFY_HOURS = [10, 16, 18]

function hojeLocalIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function loadStored(): ChecklistNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as ChecklistNotification[]
  } catch {
    return []
  }
}

function saveStored(notifs: ChecklistNotification[]) {
  // mantém apenas os últimos 30 dias
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
  const trimmed = notifs.filter((n) => n.timestamp >= cutoff)
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed)) } catch { /* ignore */ }
}

async function fetchTodayStats(activeVehicles: FleetVehicle[]): Promise<{ realizaram: number; naoRealizaram: number; total: number }> {
  const hojeIso = hojeLocalIso()
  const { data } = await supabase
    .from('checklists')
    .select('dados_veiculo')
    .eq('progresso', 100)
    .eq('data_inspecao', hojeIso)

  const placasFeitas = new Set<string>()
  for (const row of data ?? []) {
    const dv = row.dados_veiculo && typeof row.dados_veiculo === 'object'
      ? (row.dados_veiculo as Record<string, unknown>)
      : {}
    const placa = String(dv.placa ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (placa) placasFeitas.add(placa)
  }

  const total = activeVehicles.filter(
    (v) => isOperacionalAtivosDashboardKpi(v.placa, v.prefixo ?? '', v.status),
  ).length
  const realizaram = placasFeitas.size
  const naoRealizaram = Math.max(0, total - realizaram)
  return { realizaram, naoRealizaram, total }
}

export function useChecklistNotifications(allVehicles: FleetVehicle[]) {
  const [notifications, setNotifications] = useState<ChecklistNotification[]>(loadStored)

  const unreadCount = notifications.filter((n) => !n.lida).length

  const markAllRead = useCallback(() => {
    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, lida: true }))
      saveStored(updated)
      return updated
    })
  }, [])

  const markRead = useCallback((id: string) => {
    setNotifications((prev) => {
      const updated = prev.map((n) => n.id === id ? { ...n, lida: true } : n)
      saveStored(updated)
      return updated
    })
  }, [])

  // Verifica a cada minuto se deve gerar nova notificação
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>

    const check = async () => {
      const now = new Date()
      const hojeIso = hojeLocalIso()
      const hour = now.getHours()
      const minute = now.getMinutes()

      if (!NOTIFY_HOURS.includes(hour) || minute > 5) {
        scheduleNext()
        return
      }

      const id = `${hojeIso}-${hour}`
      const stored = loadStored()

      // já gerou essa notificação hoje nesse horário?
      if (stored.some((n) => n.id === id)) {
        scheduleNext()
        return
      }

      try {
        const stats = await fetchTodayStats(allVehicles)
        const notif: ChecklistNotification = {
          id,
          timestamp: Date.now(),
          hojeIso,
          ...stats,
          lida: false,
        }
        const updated = [notif, ...stored]
        saveStored(updated)
        setNotifications(updated)
      } catch {
        // falha silenciosa
      }

      scheduleNext()
    }

    function scheduleNext() {
      // verifica de novo em 60 segundos
      timer = setTimeout(() => { void check() }, 60_000)
    }

    void check()
    return () => clearTimeout(timer)
  // allVehicles na dep array: se a frota carrega após o mount, recalcula o total corretamente
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allVehicles])

  return { notifications, unreadCount, markAllRead, markRead }
}
