import { useEffect, useRef, useState } from 'react'
import { DEMO_TIMING, demoDelay, resolveDemoProfile, type ChecklistDemoProfile } from './checklistDemoConfig'
import { narrateDemoStep } from './demoNarrator'
import type { DemoCursorTarget } from '../components/checklist/DemoCursor'

export type ChecklistDemoPhase = 'select' | 'identify' | 'form' | 'done'

type Options = {
  enabled: boolean
  speedFactor: number
  tipoOverride?: string | null
  loop: boolean
  hasTipo: boolean
  hasOperador: boolean
  isConcluido: boolean
  onSelectTipo: (tipo: string) => void
  onConfirmOperador: (nome: string, matricula: string) => void
  onRestart: () => void
}

export function useChecklistDemoPlayer({
  enabled,
  speedFactor,
  tipoOverride,
  loop,
  hasTipo,
  hasOperador,
  isConcluido,
  onSelectTipo,
  onConfirmOperador,
  onRestart,
}: Options) {
  const profile = resolveDemoProfile(tipoOverride)
  const [highlightTipo, setHighlightTipo] = useState<string | null>(null)
  const [demoNome, setDemoNome] = useState('')
  const [demoMatricula, setDemoMatricula] = useState('')
  const [pulseSubmit, setPulseSubmit] = useState(false)
  const [cursorTarget, setCursorTarget] = useState<DemoCursorTarget | null>(null)
  const ranSelect = useRef(false)
  const ranIdentify = useRef(false)

  const phase: ChecklistDemoPhase = !hasTipo
    ? 'select'
    : !hasOperador
      ? 'identify'
      : isConcluido
        ? 'done'
        : 'form'

  // Etapa 1 — escolha do checklist
  useEffect(() => {
    if (!enabled || phase !== 'select') {
      ranSelect.current = false
      return
    }
    if (ranSelect.current) return
    ranSelect.current = true

    let cancelled = false
    const timers: ReturnType<typeof setTimeout>[] = []
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        timers.push(setTimeout(resolve, demoDelay(ms, speedFactor)))
      })

    void (async () => {
      await narrateDemoStep('select-checklist')
      if (cancelled) return
      await wait(DEMO_TIMING.selectPause)
      if (cancelled) return
      setHighlightTipo(profile.tipo)
      // Cursor aparece e move para o botão do checklist
      setCursorTarget({ selector: `[data-demo-tipo="${profile.tipo}"]`, key: 'select' })
      await wait(DEMO_TIMING.selectHighlight)
      if (cancelled) return
      // Toque
      setCursorTarget({ selector: `[data-demo-tipo="${profile.tipo}"]`, tap: true, key: 'select-tap' })
      await wait(300)
      if (cancelled) return
      setHighlightTipo(null)
      setCursorTarget(null)
      onSelectTipo(profile.tipo)
    })()

    return () => {
      cancelled = true
      timers.forEach(clearTimeout)
    }
  }, [enabled, phase, profile.tipo, speedFactor, onSelectTipo])

  // Etapa 2 — identificação com efeito de digitação
  useEffect(() => {
    if (!enabled || phase !== 'identify') {
      ranIdentify.current = false
      setDemoNome('')
      setDemoMatricula('')
      setPulseSubmit(false)
      return
    }
    if (ranIdentify.current) return
    ranIdentify.current = true

    let cancelled = false
    const timers: ReturnType<typeof setTimeout>[] = []
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        timers.push(setTimeout(resolve, demoDelay(ms, speedFactor)))
      })

    void (async () => {
      await narrateDemoStep('identify')
      if (cancelled) return
      // Cursor vai para campo nome
      setCursorTarget({ selector: '[data-demo-field="nome"]', tap: true, key: 'id-nome' })
      await wait(DEMO_TIMING.identifyChar * 3)
      for (let i = 1; i <= profile.operador.length; i++) {
        if (cancelled) return
        setDemoNome(profile.operador.slice(0, i))
        await wait(DEMO_TIMING.identifyChar)
      }
      await wait(DEMO_TIMING.identifyPause)
      if (cancelled) return
      // Cursor vai para campo matrícula
      setCursorTarget({ selector: '[data-demo-field="matricula"]', tap: true, key: 'id-mat' })
      await wait(DEMO_TIMING.identifyChar * 3)
      for (let i = 1; i <= profile.matricula.length; i++) {
        if (cancelled) return
        setDemoMatricula(profile.matricula.slice(0, i))
        await wait(DEMO_TIMING.identifyChar)
      }
      await wait(DEMO_TIMING.identifyPause)
      if (cancelled) return
      // Rola a tela para revelar o botão antes de clicar
      const submitEl = document.querySelector('[data-demo-field="submit"]') as HTMLElement | null
      if (submitEl) {
        const scroller = document.querySelector('.checklist-phone-scroll') as HTMLElement | null
        if (scroller) scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' })
        else submitEl.scrollIntoView({ behavior: 'smooth', block: 'end' })
      }
      await wait(600)
      if (cancelled) return
      // Cursor vai para botão confirmar
      setCursorTarget({ selector: '[data-demo-field="submit"]', tap: true, key: 'id-submit' })
      setPulseSubmit(true)
      await wait(DEMO_TIMING.identifySubmit)
      if (cancelled) return
      setPulseSubmit(false)
      setCursorTarget(null)
      onConfirmOperador(profile.operador, profile.matricula)
    })()

    return () => {
      cancelled = true
      timers.forEach(clearTimeout)
    }
  }, [enabled, phase, profile.operador, profile.matricula, speedFactor, onConfirmOperador])

  // Etapa 4 — loop opcional após conclusão
  useEffect(() => {
    if (!enabled || !loop || phase !== 'done') return
    const t = setTimeout(onRestart, demoDelay(DEMO_TIMING.conclusionHold, speedFactor))
    return () => clearTimeout(t)
  }, [enabled, loop, phase, speedFactor, onRestart])

  return {
    profile,
    phase,
    highlightTipo,
    demoNome,
    demoMatricula,
    pulseSubmit,
    cursorTarget,
    setCursorTarget,
  }
}

export type { ChecklistDemoProfile }
