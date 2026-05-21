import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CalendarClock, CheckCircle2, ClipboardCheck, ClipboardX, X } from 'lucide-react'
import { useChecklistNotifications } from '../../hooks/useChecklistNotifications'
import { useAgendaNotifications } from '../../hooks/useAgendaNotifications'
import { useFleet } from '../../frota/FleetContext'
import { useAuth } from '../../auth/AuthContext'

const HOUR_LABELS: Record<number, string> = { 10: '10h', 16: '16h', 18: '18h' }

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function hourFromId(id: string): string {
  const hour = parseInt(id.split('-').at(-1) ?? '', 10)
  return HOUR_LABELS[hour] ?? `${hour}h`
}

export function NotificationBell() {
  const { vehicles } = useFleet()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'

  const { notifications, unreadCount, markAllRead } = useChecklistNotifications(vehicles)
  const { count: agendaCount } = useAgendaNotifications(isAdmin)

  const [open, setOpen] = useState(false)
  const [agendaLida, setAgendaLida] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  // Reseta leitura da agenda quando a contagem muda (novo agendamento do dia)
  useEffect(() => {
    if (agendaCount > 0) setAgendaLida(false)
  }, [agendaCount])

  // fecha ao clicar fora
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const agendaUnread = isAdmin && agendaCount > 0 && !agendaLida
  const totalUnread = unreadCount + (agendaUnread ? 1 : 0)

  const toggle = () => {
    setOpen((v) => {
      if (!v) {
        markAllRead()
        if (agendaCount > 0) setAgendaLida(true)
      }
      return !v
    })
  }

  const irParaDetalhar = () => {
    markAllRead()
    setOpen(false)
    navigate(`/checklists/detalhar?periodo=hoje`)
  }

  const irParaAgenda = () => {
    setAgendaLida(true)
    setOpen(false)
    navigate(`/gerenciar`)
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        data-tour="notification-bell"
        className="relative inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
        aria-label="Notificações"
      >
        <Bell size={18} />
        {totalUnread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-black text-white">
            {totalUnread > 9 ? '9+' : totalUnread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-[200] flex w-80 flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:w-96">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100">Notificações</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X size={14} />
            </button>
          </div>

          {/* Lista */}
          <div className="custom-nb-scroll max-h-[420px] overflow-y-auto">

            {/* Card de agendamentos — visível apenas para admin quando há itens para hoje/vencidos */}
            {isAdmin && agendaCount > 0 && (
              <div className={`relative border-b border-slate-50 px-4 py-3.5 dark:border-slate-800/60 ${
                agendaUnread ? 'bg-amber-50/60 dark:bg-amber-950/20' : ''
              }`}>
                {agendaUnread && (
                  <span className="absolute left-1.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-amber-500" />
                )}

                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <CalendarClock size={13} className="text-amber-500" />
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                      Agenda de correções
                    </span>
                  </div>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
                    {agendaCount} {agendaCount === 1 ? 'item' : 'itens'}
                  </span>
                </div>

                <p className="mb-3 text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {agendaCount === 1
                    ? '1 correção agendada para hoje ou vencida aguarda ação.'
                    : `${agendaCount} correções agendadas para hoje ou vencidas aguardam ação.`}
                </p>

                <button
                  type="button"
                  onClick={irParaAgenda}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-3 py-2 text-[11px] font-extrabold text-white transition-colors hover:bg-amber-600"
                >
                  <CalendarClock size={12} />
                  Ver agendamentos
                </button>
              </div>
            )}

            {/* Notificações de checklist */}
            {notifications.length === 0 && !(isAdmin && agendaCount > 0) ? (
              <div className="flex flex-col items-center gap-2 py-12 text-slate-400">
                <Bell size={24} className="opacity-30" />
                <p className="text-xs font-semibold">Sem notificações</p>
                <p className="text-[10px] text-slate-400">As notificações aparecem às 10h, 16h e 18h</p>
              </div>
            ) : (
              notifications.map((n) => {
                const pct = n.total > 0 ? Math.round((n.realizaram / n.total) * 100) : 0
                const isHoje = n.hojeIso === new Date().toISOString().slice(0, 10)
                return (
                  <div
                    key={n.id}
                    className={`relative border-b border-slate-50 px-4 py-3.5 last:border-0 dark:border-slate-800/60 ${
                      !n.lida ? 'bg-blue-50/60 dark:bg-blue-950/20' : ''
                    }`}
                  >
                    {!n.lida && (
                      <span className="absolute left-1.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-blue-500" />
                    )}

                    {/* Data + hora */}
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400">
                        {isHoje ? 'Hoje' : formatDate(n.hojeIso)} · {hourFromId(n.id)}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                        pct >= 80 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                        : pct >= 50 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400'
                        : 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400'
                      }`}>
                        {pct}% aderência
                      </span>
                    </div>

                    {/* Contadores */}
                    <div className="mb-3 flex gap-3">
                      <div className="flex items-center gap-1.5">
                        <ClipboardCheck size={13} className="text-emerald-500" />
                        <span className="text-xs font-extrabold text-slate-700 dark:text-slate-200">
                          {n.realizaram}
                        </span>
                        <span className="text-[10px] font-medium text-slate-400">realizaram</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <ClipboardX size={13} className="text-rose-400" />
                        <span className="text-xs font-extrabold text-slate-700 dark:text-slate-200">
                          {n.naoRealizaram}
                        </span>
                        <span className="text-[10px] font-medium text-slate-400">não realizaram</span>
                      </div>
                    </div>

                    {/* Botão detalhar */}
                    <button
                      type="button"
                      onClick={() => irParaDetalhar()}
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-[11px] font-extrabold text-white transition-colors hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                    >
                      <CheckCircle2 size={12} />
                      Ver detalhe
                    </button>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer */}
          {(notifications.length > 0 || (isAdmin && agendaCount > 0)) && (
            <div className="border-t border-slate-100 px-4 py-2.5 dark:border-slate-800">
              <p className="text-center text-[10px] font-medium text-slate-400">
                Atualizado automaticamente às 10h, 16h e 18h
              </p>
            </div>
          )}
        </div>
      )}

      <style>{`
        .custom-nb-scroll::-webkit-scrollbar { width: 4px; }
        .custom-nb-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-nb-scroll::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 20px; }
        .dark .custom-nb-scroll::-webkit-scrollbar-thumb { background: #475569; }
      `}</style>
    </div>
  )
}
