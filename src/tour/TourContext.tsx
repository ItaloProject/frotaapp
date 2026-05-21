import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { TOUR_STEPS, shouldAutoStartTour, type TourStep } from './tourSteps'
import { useAuth } from '../auth/AuthContext'

type TourCtx = {
  active: boolean
  finished: boolean
  stepIndex: number
  step: TourStep | null
  total: number
  isDemo: boolean
  /** Inicia do passo salvo (retoma onde parou). */
  start: () => void
  /** Inicia sempre do passo 0, ignorando progresso salvo. */
  startFresh: () => void
  /** Encerra o tour ativo sem marcar como concluído. */
  stop: () => void
  /** Reinicia do zero (mesmo comportamento que startFresh, exposto para o botão de reset). */
  resetTour: () => void
  next: () => void
  prev: () => void
  goTo: (i: number) => void
}

const Ctx = createContext<TourCtx | null>(null)

const STORAGE_PROGRESS = 'frota.tour.progress'

function loadProgress(): number {
  try {
    const v = localStorage.getItem(STORAGE_PROGRESS)
    const n = v ? parseInt(v, 10) : 0
    return Number.isFinite(n) && n >= 0 && n < TOUR_STEPS.length ? n : 0
  } catch {
    return 0
  }
}

function saveProgress(index: number) {
  try { localStorage.setItem(STORAGE_PROGRESS, String(index)) } catch { /* ignore */ }
}

function clearProgress() {
  try { localStorage.removeItem(STORAGE_PROGRESS) } catch { /* ignore */ }
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [active, setActive] = useState(false)
  const [finished, setFinished] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const lastLoginEmailRef = useRef<string | null>(null)

  // Espelha o stepIndex atual para uso em callbacks sem stale closure,
  // evitando ter de chamar efeitos colaterais dentro de updaters do setState
  // (impuros e executados 2x no Strict Mode).
  const stepIndexRef = useRef(0)
  useEffect(() => { stepIndexRef.current = stepIndex }, [stepIndex])

  // Índice aguardando a rota chegar antes de ser aplicado ao state.
  // -1 = nenhuma navegação pendente.
  const pendingIndexRef = useRef<number>(-1)

  // Espelha o pathname atual para uso em callbacks sem stale closure.
  const locationRef = useRef(location.pathname)
  useEffect(() => { locationRef.current = location.pathname }, [location.pathname])

  // ── Ativa o tour num índice, navegando para a rota do step se necessário ──
  // Se a rota destino difere da atual, marca pendingIndexRef para que o efeito
  // de guarda não encerre o tour antes da rota chegar.
  const beginAt = useCallback((index: number) => {
    const target = TOUR_STEPS[index] ? index : 0
    const targetPath = TOUR_STEPS[target]?.path ?? '/'
    setFinished(false)
    setActive(true)
    if (locationRef.current !== targetPath) {
      pendingIndexRef.current = target
      setStepIndex(target)
      navigate(targetPath)
    } else {
      pendingIndexRef.current = -1
      setStepIndex(target)
    }
  }, [navigate])

  const beginAtRef = useRef(beginAt)
  useEffect(() => { beginAtRef.current = beginAt }, [beginAt])

  // ── Auto-start: reinicia do zero a cada novo login do usuário demo ────────
  useEffect(() => {
    if (!user?.email) {
      lastLoginEmailRef.current = null
      return
    }
    if (!shouldAutoStartTour(user.email)) return

    // Gravação do checklist (/checklist/demo) — não redirecionar para o tour/dashboard.
    if (location.pathname.startsWith('/checklist')) {
      lastLoginEmailRef.current = user.email
      return
    }

    if (lastLoginEmailRef.current === user.email) return
    lastLoginEmailRef.current = user.email
    clearProgress()
    beginAtRef.current(0)
  }, [user?.email, location.pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Persiste progresso sempre que o passo muda (enquanto ativo) ──────────
  useEffect(() => {
    if (active) saveProgress(stepIndex)
  }, [active, stepIndex])

  // ── Confirma stepIndex quando a rota destino chega ───────────────────────
  // Quando next()/prev() precisam trocar de rota, eles apenas chamam navigate()
  // e guardam o índice em pendingIndexRef. Este efeito aplica o índice ao state
  // somente depois que o React Router confirma que a nova rota chegou, garantindo
  // que o overlay exiba o conteúdo do step certo para a página certa.
  useEffect(() => {
    if (!active) return

    const pending = pendingIndexRef.current
    if (pending >= 0) {
      const targetStep = TOUR_STEPS[pending]
      if (targetStep && location.pathname === targetStep.path) {
        // Rota chegou: aplica o índice agora.
        pendingIndexRef.current = -1
        setStepIndex(pending)
      }
      // Ainda em trânsito — aguarda a próxima mudança de location.
      return
    }

    // Sem navegação pendente: verifica se o usuário saiu manualmente da rota.
    const step = TOUR_STEPS[stepIndex]
    if (step && location.pathname !== step.path) {
      setActive(false)
      clearProgress()
    }
  }, [active, stepIndex, location.pathname])

  const isDemo = shouldAutoStartTour(user?.email)

  // ── Helper de transição entre steps ──────────────────────────────────────
  // Chamado uma única vez por clique (fora de updaters de setState, para não
  // executar 2x no Strict Mode). Acessado via ref por next/prev/goTo para
  // sempre usar a versão atual sem recriar esses callbacks.
  const applyIndex = useCallback((current: number, target: number) => {
    if (target >= TOUR_STEPS.length) {
      setActive(false)
      clearProgress()
      pendingIndexRef.current = -1
      if (isDemo) setFinished(true)
      return
    }
    if (target < 0) return

    const curStep = TOUR_STEPS[current]
    const targetStep = TOUR_STEPS[target]
    if (targetStep && curStep && targetStep.path !== curStep.path) {
      // Troca de rota: navega primeiro, aplica índice só quando a rota chegar.
      pendingIndexRef.current = target
      navigate(targetStep.path)
    } else {
      // Mesma rota: aplica imediatamente.
      pendingIndexRef.current = -1
      setStepIndex(target)
    }
  }, [isDemo, navigate])

  const applyIndexRef = useRef(applyIndex)
  useEffect(() => { applyIndexRef.current = applyIndex }, [applyIndex])

  // Inicia retomando progresso salvo
  const start = useCallback(() => {
    beginAtRef.current(loadProgress())
  }, [])

  // Inicia sempre do zero
  const startFresh = useCallback(() => {
    clearProgress()
    beginAtRef.current(0)
  }, [])

  const stop = useCallback(() => {
    setActive(false)
    setFinished(false)
    clearProgress()
    pendingIndexRef.current = -1
  }, [])

  const resetTour = useCallback(() => {
    clearProgress()
    beginAtRef.current(0)
  }, [])

  const next = useCallback(() => {
    applyIndexRef.current(stepIndexRef.current, stepIndexRef.current + 1)
  }, [])

  const prev = useCallback(() => {
    const cur = stepIndexRef.current
    applyIndexRef.current(cur, Math.max(0, cur - 1))
  }, [])

  const goTo = useCallback((target: number) => {
    if (target < 0 || target >= TOUR_STEPS.length) return
    applyIndexRef.current(stepIndexRef.current, target)
  }, [])

  const value = useMemo<TourCtx>(
    () => ({
      active,
      finished,
      stepIndex,
      step: active ? TOUR_STEPS[stepIndex] ?? null : null,
      total: TOUR_STEPS.length,
      isDemo,
      start,
      startFresh,
      stop,
      resetTour,
      next,
      prev,
      goTo,
    }),
    [active, finished, stepIndex, isDemo, start, startFresh, stop, resetTour, next, prev, goTo],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTour() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useTour must be used inside TourProvider')
  return c
}
