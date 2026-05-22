import { useEffect, useState } from 'react'
import { Clock, Lock, Mail, MessageCircle } from 'lucide-react'
import { useAuth } from '../../auth/AuthContext'
import { InstagramIcon } from '../../branding/InstagramIcon'

const DEMO_DURATION_MS = 5 * 60 * 1000 // 5 minutos

function getElapsedMs(): number {
  try {
    const raw = sessionStorage.getItem('frota.demo.start')
    if (!raw) return 0
    return Date.now() - Number(raw)
  } catch {
    return 0
  }
}

function fmt(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function DemoTimerOverlay() {
  const { user, logout } = useAuth()
  const [remaining, setRemaining] = useState(() => Math.max(0, DEMO_DURATION_MS - getElapsedMs()))
  const [expired, setExpired] = useState(() => getElapsedMs() >= DEMO_DURATION_MS)

  useEffect(() => {
    if (!user?.isDemo) return

    const tick = () => {
      const r = Math.max(0, DEMO_DURATION_MS - getElapsedMs())
      setRemaining(r)
      if (r === 0) setExpired(true)
    }

    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [user?.isDemo])

  if (!user?.isDemo) return null

  const isWarning = remaining <= 60_000 && !expired
  const pct = Math.max(0, Math.min(100, (remaining / DEMO_DURATION_MS) * 100))

  if (expired) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#030712]/95 backdrop-blur-xl">
        {/* Glow ambiental */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/10 blur-[120px]" />
          <div className="absolute left-1/4 top-1/4 h-64 w-64 rounded-full bg-emerald-500/8 blur-[90px]" />
        </div>

        <div className="relative z-10 mx-4 w-full max-w-md">
          {/* Card principal */}
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0d1117]/90 shadow-[0_0_80px_rgba(6,182,212,0.15)] backdrop-blur-2xl">
            {/* Linha decorativa topo */}
            <div className="h-1 w-full bg-gradient-to-r from-cyan-500 via-cyan-400 to-emerald-400" />

            <div className="px-8 py-10 text-center">
              {/* Ícone animado */}
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-cyan-400/20 bg-cyan-500/10 shadow-[0_0_40px_rgba(6,182,212,0.25)]">
                <Lock size={36} className="text-cyan-400" strokeWidth={2} />
              </div>

              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                Sessão Expirada
              </div>

              <h2 className="mt-4 text-2xl font-black tracking-tight text-white">
                Sessão demo encerrada
              </h2>
              <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-400">
                Seu acesso gratuito de&nbsp;<strong className="text-white">5 minutos</strong> chegou ao fim.
                <br />
                Ficou interessado? Fale conosco!
              </p>

              {/* Botões de contato */}
              <div className="mt-8 space-y-3">
                <a
                  href="https://wa.me/5599984491810"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-3 rounded-2xl bg-emerald-600 px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-emerald-900/30 transition-all hover:brightness-110 active:scale-[0.98]"
                >
                  <MessageCircle size={18} strokeWidth={2.5} />
                  WhatsApp: +55 99 98449-1810
                </a>

                <a
                  href="https://www.instagram.com/italofontes__?utm_source=qr&igsh=NmUwbnVwZWE2ems2"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-purple-900/30 transition-all hover:brightness-110 active:scale-[0.98]"
                >
                  <InstagramIcon size={18} />
                  @italofontes__
                </a>

                <a
                  href="mailto:italo.fontes2026@gmail.com"
                  className="flex w-full items-center justify-center gap-3 rounded-2xl border border-cyan-500/40 bg-cyan-500/10 px-5 py-3.5 text-sm font-black text-cyan-300 transition-all hover:bg-cyan-500/20 active:scale-[0.98]"
                >
                  <Mail size={18} strokeWidth={2.5} />
                  italo.fontes2026@gmail.com
                </a>
              </div>

              {/* Reiniciar sessão */}
              <button
                type="button"
                onClick={() => {
                  try { sessionStorage.removeItem('frota.demo.start') } catch { /* ignore */ }
                  void logout()
                }}
                className="mt-6 text-[11px] font-black text-slate-500 transition-colors hover:text-slate-300"
              >
                Voltar para o login
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  /* Badge flutuante com contador */
  return (
    <div
      className={`fixed bottom-5 right-5 z-[9000] flex items-center gap-2.5 rounded-2xl border px-4 py-2.5 text-xs font-black shadow-xl backdrop-blur-sm transition-all duration-300 ${
        isWarning
          ? 'animate-pulse border-red-500/50 bg-red-950/80 text-red-300 shadow-red-900/40'
          : 'border-cyan-500/30 bg-[#0d1117]/90 text-cyan-300 shadow-cyan-950/30'
      }`}
    >
      <Clock size={14} strokeWidth={2.5} />
      <span className="tabular-nums">{fmt(remaining)}</span>
      {/* barra de progresso */}
      <div className="ml-1 h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${isWarning ? 'bg-red-400' : 'bg-cyan-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[9px] uppercase tracking-widest opacity-60">demo</span>
    </div>
  )
}
