import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type AgendaNotificationState = {
  count: number
  loading: boolean
}

function hojeLocalIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Busca agendamentos de correção vencidos ou de hoje que ainda não foram resolvidos.
 * Só deve ser chamado para usuários admin/super_admin.
 */
export function useAgendaNotifications(isAdmin: boolean) {
  const [state, setState] = useState<AgendaNotificationState>({ count: 0, loading: false })

  useEffect(() => {
    if (!isAdmin) {
      setState({ count: 0, loading: false })
      return
    }

    let cancelled = false

    const fetch = async () => {
      setState((s) => ({ ...s, loading: true }))
      const hoje = hojeLocalIso()
      const { data } = await supabase
        .from('apontamentos')
        .select('id')
        .eq('resolvido', false)
        .not('agendamento_data', 'is', null)
        .lte('agendamento_data', hoje)  // hoje ou vencido

      if (!cancelled) {
        setState({ count: (data ?? []).length, loading: false })
      }
    }

    void fetch()

    // Revalida a cada 5 minutos
    const interval = setInterval(() => { void fetch() }, 5 * 60 * 1000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [isAdmin])

  return state
}
