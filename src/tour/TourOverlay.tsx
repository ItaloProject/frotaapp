import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, SkipForward, X, Sparkles, AlertCircle, RotateCcw, LogOut } from 'lucide-react'
import { useTour } from './TourContext'
import { useLocation } from 'react-router-dom'
import { TOUR_AREAS } from './tourSteps'
import { useAuth } from '../auth/AuthContext'

type Rect = { top: number; left: number; width: number; height: number }

const PAD = 10

function TourFinishedModal() {
  const { resetTour } = useTour()
  const { logout } = useAuth()

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl border border-slate-700/80 bg-slate-900 p-8 shadow-2xl text-center">
        <div className="mb-5 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-500/15">
            <Sparkles size={32} className="text-brand-400" />
          </div>
        </div>
        <h2 className="text-xl font-black text-slate-100">Tour concluído!</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          Esta é uma conta de demonstração. Para continuar, reinicie o tour ou saia da conta.
        </p>
        <div className="mt-7 flex flex-col gap-3">
          <button
            type="button"
            onClick={resetTour}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-500 py-3 text-sm font-extrabold text-white shadow-lg shadow-brand-500/30 transition hover:bg-brand-600"
          >
            <RotateCcw size={16} />
            Reiniciar tour
          </button>
          <button
            type="button"
            onClick={() => void logout()}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-800 py-3 text-sm font-extrabold text-slate-300 transition hover:bg-slate-700 hover:text-white"
          >
            <LogOut size={16} />
            Sair da conta
          </button>
        </div>
      </div>
    </div>
  )
}

export function TourOverlay() {
  const { active, finished, step, stepIndex, total, next, prev, stop } = useTour()
  const location = useLocation()
  const [rect, setRect] = useState<Rect | null>(null)
  const [ready, setReady] = useState(false)
  const [selectorMissing, setSelectorMissing] = useState(false)
  // chave para disparar animação a cada troca de passo
  const [animKey, setAnimKey] = useState(0)
  const prevStepRef = useRef(stepIndex)

  // ── Dispara animação a cada mudança de passo ────────────────────────────
  useEffect(() => {
    if (prevStepRef.current !== stepIndex) {
      setAnimKey((k) => k + 1)
      prevStepRef.current = stepIndex
    }
  }, [stepIndex])

  // ── Aguarda a rota mudar antes de buscar o elemento ─────────────────────
  useEffect(() => {
    setReady(false)
    setRect(null)
    setSelectorMissing(false)
    if (!active || !step) return
    if (location.pathname !== step.path) return

    const waitMs = step.waitMs ?? 300
    const timer = window.setTimeout(() => setReady(true), waitMs)
    return () => window.clearTimeout(timer)
  }, [active, step, location.pathname, stepIndex])

  // ── Calcula a posição do elemento destacado ─────────────────────────────
  useLayoutEffect(() => {
    if (!ready || !step) return
    if (!step.selector) { setRect(null); setSelectorMissing(false); return }

    const selector = step.selector
    let cancelled = false
    const timers: number[] = []

    const measure = (el: HTMLElement) => {
      const r = el.getBoundingClientRect()
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
    }

    const update = () => {
      if (cancelled) return
      const el = document.querySelector(selector) as HTMLElement | null
      if (!el) {
        setRect(null)
        setSelectorMissing(true)
        return
      }
      setSelectorMissing(false)
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
      timers.push(window.setTimeout(() => { if (!cancelled) measure(el) }, 300))
    }

    // Tenta encontrar o elemento de imediato; se ainda não existir (página
    // com dados assíncronos), faz algumas re-tentativas curtas antes de
    // marcar como ausente.
    const tryFind = (attempt: number) => {
      if (cancelled) return
      const el = document.querySelector(selector) as HTMLElement | null
      if (el) {
        update()
      } else if (attempt < 8) {
        timers.push(window.setTimeout(() => tryFind(attempt + 1), 250))
      } else {
        setRect(null)
        setSelectorMissing(true)
      }
    }
    tryFind(0)

    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      cancelled = true
      timers.forEach((t) => window.clearTimeout(t))
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [ready, step])

  if (finished) return <TourFinishedModal />
  if (!active || !step) return null

  const hasSpotlight = !!step.selector && rect !== null && !selectorMissing
  const isCentered = !step.selector || !rect

  // ── Posição do tooltip para spotlight ──────────────────────────────────
  let tooltipStyle: React.CSSProperties = {}
  if (hasSpotlight && rect) {
    const placement = step.placement ?? 'auto'
    const TOOLTIP_W = 380
    const TOOLTIP_H = 260
    const vh = window.innerHeight
    const vw = window.innerWidth

    let top = 0
    let left = 0

    if (placement === 'top' || (placement === 'auto' && rect.top > vh / 2)) {
      top = rect.top - TOOLTIP_H - PAD - 12
      left = rect.left + rect.width / 2 - TOOLTIP_W / 2
    } else if (placement === 'left') {
      top = rect.top + rect.height / 2 - TOOLTIP_H / 2
      left = rect.left - TOOLTIP_W - PAD - 12
    } else if (placement === 'right') {
      top = rect.top + rect.height / 2 - TOOLTIP_H / 2
      left = rect.left + rect.width + PAD + 12
    } else {
      top = rect.top + rect.height + PAD + 12
      left = rect.left + rect.width / 2 - TOOLTIP_W / 2
    }

    left = Math.max(12, Math.min(vw - TOOLTIP_W - 12, left))
    top = Math.max(12, Math.min(vh - TOOLTIP_H - 12, top))

    tooltipStyle = { top, left, width: TOOLTIP_W, position: 'fixed' }
  }

  const isLast = stepIndex === total - 1
  const isFirst = stepIndex === 0
  const progress = ((stepIndex + 1) / total) * 100

  // Mini-mapa: índice da área atual
  const currentAreaIndex = TOUR_AREAS.indexOf(step.area)

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999]">

      {/* ── Overlay ────────────────────────────────────────────────────────── */}
      {hasSpotlight && rect ? (
        <>
          <div className="pointer-events-auto absolute bg-black/65 backdrop-blur-[2px] transition-all duration-300"
            style={{ top: 0, left: 0, right: 0, height: Math.max(0, rect.top - PAD) }} />
          <div className="pointer-events-auto absolute bg-black/65 backdrop-blur-[2px] transition-all duration-300"
            style={{ top: rect.top + rect.height + PAD, left: 0, right: 0, bottom: 0 }} />
          <div className="pointer-events-auto absolute bg-black/65 backdrop-blur-[2px] transition-all duration-300"
            style={{ top: Math.max(0, rect.top - PAD), left: 0, width: Math.max(0, rect.left - PAD), height: rect.height + PAD * 2 }} />
          <div className="pointer-events-auto absolute bg-black/65 backdrop-blur-[2px] transition-all duration-300"
            style={{ top: Math.max(0, rect.top - PAD), left: rect.left + rect.width + PAD, right: 0, height: rect.height + PAD * 2 }} />
          {/* Borda pulsante */}
          <div className="pointer-events-none absolute rounded-2xl ring-2 ring-brand-400/80 transition-all duration-300"
            style={{ top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2, animation: 'tour-pulse 2s ease-in-out infinite' }} />
        </>
      ) : isCentered ? (
        <>
          <div className="pointer-events-none absolute inset-0"
            style={{ background: 'radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.35) 100%)' }} />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/50 to-transparent" />
        </>
      ) : null}

      {/* ── Card ───────────────────────────────────────────────────────────── */}
      <div
        className={[
          'pointer-events-auto rounded-2xl border shadow-2xl',
          'border-slate-700/80 bg-slate-900/95 backdrop-blur-md',
          isCentered ? 'fixed bottom-6 left-1/2 w-[92%] max-w-lg -translate-x-1/2' : '',
        ].join(' ')}
        style={isCentered ? undefined : tooltipStyle}
      >
        {/* Barra de progresso */}
        <div className="h-1 overflow-hidden rounded-t-2xl bg-slate-800">
          <div className="h-full bg-gradient-to-r from-brand-400 to-brand-600 transition-all duration-500"
            style={{ width: `${progress}%` }} />
        </div>

        {/* ── Mini-mapa de áreas ──────────────────────────────────────────── */}
        <div className="flex items-center gap-1 overflow-x-auto px-5 pt-3 pb-0 scrollbar-none">
          {TOUR_AREAS.map((area, i) => (
            <div key={area} className="flex shrink-0 items-center gap-1">
              <span className={[
                'rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider transition-all duration-300',
                i === currentAreaIndex
                  ? 'bg-brand-500 text-white'
                  : i < currentAreaIndex
                  ? 'bg-slate-700 text-slate-400'
                  : 'bg-slate-800 text-slate-600',
              ].join(' ')}>
                {area}
              </span>
              {i < TOUR_AREAS.length - 1 && (
                <span className={['text-[8px] transition-colors duration-300', i < currentAreaIndex ? 'text-slate-500' : 'text-slate-700'].join(' ')}>›</span>
              )}
            </div>
          ))}
        </div>

        {/* ── Conteúdo animado ────────────────────────────────────────────── */}
        <div key={animKey} className="tour-step-enter p-5">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-brand-400" />
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-brand-400">
                Passo {stepIndex + 1} de {total}
              </span>
            </div>
            <button type="button" onClick={stop}
              className="text-slate-500 transition hover:text-slate-200" title="Fechar tour">
              <X size={16} />
            </button>
          </div>

          <h3 className="mb-2 text-lg font-black text-slate-100">{step.title}</h3>
          <p className="text-sm leading-relaxed text-slate-300">{step.content}</p>

          {/* Aviso quando selector não encontrado */}
          {selectorMissing && step.selector && (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-700/40 bg-amber-950/40 px-3 py-2 text-xs font-semibold text-amber-400">
              <AlertCircle size={13} className="shrink-0" />
              Elemento não encontrado nesta tela — pode requerer permissão de admin.
            </div>
          )}

          <div className="mt-5 flex items-center justify-between gap-2">
            <button type="button" onClick={stop}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200">
              <SkipForward size={12} />
              Pular tour
            </button>

            <div className="flex items-center gap-2">
              <button type="button" onClick={prev} disabled={isFirst}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-extrabold text-slate-300 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-30">
                <ChevronLeft size={14} />
                Voltar
              </button>
              <button type="button" onClick={isLast ? stop : next}
                className="inline-flex items-center gap-1 rounded-lg bg-brand-500 px-4 py-1.5 text-xs font-extrabold text-white shadow-lg shadow-brand-500/30 transition hover:bg-brand-600">
                {isLast ? 'Concluir' : 'Próximo'}
                {!isLast && <ChevronRight size={14} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes tour-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(56,189,248,0.6); }
          50%       { box-shadow: 0 0 0 8px rgba(56,189,248,0); }
        }
        @keyframes tour-step-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .tour-step-enter {
          animation: tour-step-in 0.22s ease-out both;
        }
        .scrollbar-none::-webkit-scrollbar { display: none; }
        .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  )
}
