import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  ClipboardX,
  FileDown,
  Camera,
  LayoutGrid,
  List,
  Maximize2,
  Minimize2,
  Search,
  Trophy,
  X,
} from 'lucide-react'

import {
  generateChecklistDetalharPdf,
  type ChecklistDetalharPdfScope,
} from '../checklists/generateChecklistDetalharPdf'

import { BASE_FILTER_SELECT_OPTIONS, matchesBaseFilter } from '../data/baseFilterOptions'
import { COORDENADOR_FILTER_SELECT_OPTIONS, matchesCoordenadorFilter } from '../data/coordenadorFilterOptions'
import { SUPERVISOR_FILTER_SELECT_OPTIONS, matchesSupervisorFilter } from '../data/supervisorFilterOptions'
import { getBasesByGerenciaAndResponsavel, getResponsaveisByGerencia } from '../data/gerenciaMap'
import { Select } from '../components/ui/Select'
import { ChecklistTop10Section, CHECKLIST_TOP10_GROUP_OPTIONS, buildChecklistAdherenceRanking, type ChecklistTop10GroupBy } from '../components/checklist/ChecklistTop10Section'
import { listDaysInPeriod } from '../checklists/checklistTop10Ranking'
import { downloadDataUrl, generateRankingScreenshot } from '../checklists/generateRankingScreenshot'
import { getVehicleOperationalStatusRowsWithLocals, getVehicleOperationalStatusSummary } from '../frota/vehicleOperationalStatus'
import { useFleet } from '../frota/FleetContext'

// ─── helpers ───────────────────────────────────────────────────────────────

function normNome(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ')
}

function hojeLocalIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function dateToLocalIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatIsoDateBR(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  })
}

function defaultDesde(): string {
  const d = new Date()
  d.setDate(d.getDate() - 6)
  return dateToLocalIso(d)
}

function normPlaca(s: string): string {
  return s.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

const PERIODO_OPTIONS = [
  { label: 'Hoje', value: 'hoje' },
  { label: 'Últimos 7 dias', value: '7d' },
  { label: 'Últimos 30 dias', value: '30d' },
  { label: 'Últimos 90 dias', value: '90d' },
  { label: 'Intervalo personalizado', value: 'custom' },
] as const

function computeLimites(periodo: string, desde: string, ate: string): { ini: string; fim: string } {
  const hoje = hojeLocalIso()
  if (periodo === 'hoje') return { ini: hoje, fim: hoje }
  if (periodo === '7d') {
    const d = new Date(); d.setDate(d.getDate() - 6)
    return { ini: dateToLocalIso(d), fim: hoje }
  }
  if (periodo === '30d') {
    const d = new Date(); d.setDate(d.getDate() - 29)
    return { ini: dateToLocalIso(d), fim: hoje }
  }
  if (periodo === '90d') {
    const d = new Date(); d.setDate(d.getDate() - 89)
    return { ini: dateToLocalIso(d), fim: hoje }
  }
  // custom
  const isoOk = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s)
  let a = isoOk(desde) ? desde : defaultDesde()
  let b = isoOk(ate) ? ate : hoje
  if (a > b) [a, b] = [b, a]
  return { ini: a, fim: b }
}

const FILTROS_STORAGE_KEY = 'frota.filtros.checklist-detalhar.v1'
const FILTROS_VISIBLE_LEGACY_KEY = 'frota.filtros.checklist-detalhar'

type ViewMode = 'cards' | 'list' | 'ranking'

type ChecklistDetalharFiltersState = {
  periodo: string
  customDesde: string
  customAte: string
  base: string
  gerencia: string
  supervisor: string
  responsavel: string
  busca: string
  filtrosVisiveis: boolean
  viewMode: ViewMode
}

function loadChecklistDetalharFilters(): Partial<ChecklistDetalharFiltersState> | null {
  try {
    const raw = localStorage.getItem(FILTROS_STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Partial<ChecklistDetalharFiltersState>
    const legacyVisible = localStorage.getItem(FILTROS_VISIBLE_LEGACY_KEY)
    if (legacyVisible != null) return { filtrosVisiveis: legacyVisible === 'true' }
  } catch {
    /* ignore */
  }
  return null
}

function saveChecklistDetalharFilters(state: ChecklistDetalharFiltersState) {
  try {
    localStorage.setItem(FILTROS_STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
}

function pickFilter(
  urlValue: string | null,
  saved: Partial<ChecklistDetalharFiltersState> | null | undefined,
  savedKey: keyof Omit<ChecklistDetalharFiltersState, 'filtrosVisiveis' | 'busca'>,
  fallback: string,
) {
  if (urlValue != null && urlValue !== '') return urlValue
  const savedValue = saved?.[savedKey]
  return typeof savedValue === 'string' ? savedValue : fallback
}

// ─── tipos ─────────────────────────────────────────────────────────────────

type VeiculoRow = {
  placa: string
  modelo: string
  base: string
  supervisor: string
  coordenador: string
  responsavel: string
  processo: string
}

type ChecklistRow = {
  placa: string
  modelo: string
  base: string
  supervisor: string
  coordenador: string
  responsavel: string
  processo: string
  data: string
  hora: string
  temNc: boolean
}

function ListaNaoRealizaram({ items }: { items: VeiculoRow[] }) {
  return (
    <div className="custom-scrollbar max-h-[62vh] overflow-y-auto xl:max-h-none xl:flex-1">
      <table className="w-full min-w-[520px] border-collapse text-left">
        <thead className="sticky top-0 z-[1] bg-rose-50/95 text-[9px] font-black uppercase tracking-wider text-rose-700 backdrop-blur dark:bg-rose-950/90 dark:text-rose-300">
          <tr className="border-b border-rose-100 dark:border-rose-950/50">
            <th className="px-3 py-2.5">Placa</th>
            <th className="px-3 py-2.5">Base</th>
            <th className="px-3 py-2.5">Modelo</th>
            <th className="px-3 py-2.5">Supervisor</th>
            <th className="px-3 py-2.5">Gerência</th>
          </tr>
        </thead>
        <tbody>
          {items.map((v) => (
            <tr
              key={v.placa}
              className="border-b border-slate-100 transition hover:bg-rose-50/50 dark:border-slate-800 dark:hover:bg-rose-950/15"
            >
              <td className="px-3 py-2 text-xs font-black tracking-wide text-slate-950 dark:text-white">{v.placa}</td>
              <td className="px-3 py-2 text-[11px] font-bold text-slate-500 dark:text-slate-400">{v.base || '—'}</td>
              <td className="max-w-[140px] truncate px-3 py-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300">{v.modelo}</td>
              <td className="max-w-[120px] truncate px-3 py-2 text-[11px] font-bold text-slate-600 dark:text-slate-300">{v.supervisor || '—'}</td>
              <td className="max-w-[120px] truncate px-3 py-2 text-[11px] font-bold text-slate-600 dark:text-slate-300">{v.coordenador || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ListaRealizaram({ items }: { items: ChecklistRow[] }) {
  return (
    <div className="custom-scrollbar max-h-[62vh] overflow-y-auto xl:max-h-none xl:flex-1">
      <table className="w-full min-w-[560px] border-collapse text-left">
        <thead className="sticky top-0 z-[1] bg-emerald-50/95 text-[9px] font-black uppercase tracking-wider text-emerald-700 backdrop-blur dark:bg-emerald-950/90 dark:text-emerald-300">
          <tr className="border-b border-emerald-100 dark:border-emerald-950/50">
            <th className="px-3 py-2.5">Placa</th>
            <th className="px-3 py-2.5">Base</th>
            <th className="px-3 py-2.5">Modelo</th>
            <th className="px-3 py-2.5">Hora</th>
            <th className="px-3 py-2.5">NC</th>
            <th className="px-3 py-2.5">Supervisor</th>
            <th className="px-3 py-2.5">Gerência</th>
          </tr>
        </thead>
        <tbody>
          {items.map((v) => (
            <tr
              key={v.placa}
              className="border-b border-slate-100 transition hover:bg-emerald-50/50 dark:border-slate-800 dark:hover:bg-emerald-950/15"
            >
              <td className="px-3 py-2 text-xs font-black tracking-wide text-slate-950 dark:text-white">{v.placa}</td>
              <td className="px-3 py-2 text-[11px] font-bold text-slate-500 dark:text-slate-400">{v.base || '—'}</td>
              <td className="max-w-[140px] truncate px-3 py-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300">{v.modelo}</td>
              <td className="px-3 py-2 text-[11px] font-black text-emerald-700 dark:text-emerald-300">{v.hora}</td>
              <td className="px-3 py-2">
                {v.temNc ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">NC</span>
                ) : (
                  <span className="text-[10px] font-semibold text-slate-400">—</span>
                )}
              </td>
              <td className="max-w-[120px] truncate px-3 py-2 text-[11px] font-bold text-slate-600 dark:text-slate-300">{v.supervisor || '—'}</td>
              <td className="max-w-[120px] truncate px-3 py-2 text-[11px] font-bold text-slate-600 dark:text-slate-300">{v.coordenador || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── componente ────────────────────────────────────────────────────────────

export function ChecklistDetalharPage() {
  const [searchParams] = useSearchParams()
  const savedFilters = useMemo(() => loadChecklistDetalharFilters(), [])

  // URL do dashboard tem prioridade; senão restaura o último estado salvo pelo usuário
  const [periodo, setPeriodo] = useState(() => pickFilter(searchParams.get('periodo'), savedFilters, 'periodo', 'hoje'))
  const [customDesde, setCustomDesde] = useState(() =>
    pickFilter(searchParams.get('desde'), savedFilters, 'customDesde', defaultDesde()),
  )
  const [customAte, setCustomAte] = useState(() =>
    pickFilter(searchParams.get('ate'), savedFilters, 'customAte', hojeLocalIso()),
  )
  const [filtroBase, setFiltroBase] = useState(() => pickFilter(searchParams.get('base'), savedFilters, 'base', 'todos'))
  const [filtroCoordenador, setFiltroCoordenador] = useState(() =>
    pickFilter(searchParams.get('gerencia'), savedFilters, 'gerencia', 'todos'),
  )
  const [filtroSupervisor, setFiltroSupervisor] = useState(() =>
    pickFilter(searchParams.get('supervisor'), savedFilters, 'supervisor', 'todos'),
  )
  const [filtroResponsavel, setFiltroResponsavel] = useState(() =>
    pickFilter(searchParams.get('responsavel'), savedFilters, 'responsavel', 'todos'),
  )
  const [busca, setBusca] = useState(() => savedFilters?.busca ?? '')
  const [filtrosVisiveis, setFiltrosVisiveis] = useState(() => savedFilters?.filtrosVisiveis ?? false)
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = savedFilters?.viewMode
    if (saved === 'cards' || saved === 'list' || saved === 'ranking') return saved
    return 'list'
  })
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [pdfModalOpen, setPdfModalOpen] = useState(false)
  const [pdfGerando, setPdfGerando] = useState(false)
  const [capturandoFoto, setCapturandoFoto] = useState(false)
  const [rankingGroupBy, setRankingGroupBy] = useState<ChecklistTop10GroupBy>('responsavel')
  const columnsRef = useRef<HTMLDivElement>(null)

  const { vehicles: allVehicles } = useFleet()

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  const toggleFullscreen = useCallback(async () => {
    const el = columnsRef.current
    if (!el) return
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await el.requestFullscreen()
    } catch {
      /* navegador bloqueou */
    }
  }, [])

  useEffect(() => {
    saveChecklistDetalharFilters({
      periodo,
      customDesde,
      customAte,
      base: filtroBase,
      gerencia: filtroCoordenador,
      supervisor: filtroSupervisor,
      responsavel: filtroResponsavel,
      busca,
      filtrosVisiveis,
      viewMode,
    })
  }, [
    periodo,
    customDesde,
    customAte,
    filtroBase,
    filtroCoordenador,
    filtroSupervisor,
    filtroResponsavel,
    busca,
    filtrosVisiveis,
    viewMode,
  ])

  const limites = useMemo(
    () => computeLimites(periodo, customDesde, customAte),
    [periodo, customDesde, customAte],
  )

  // ── frota ATIVA — mesmo critério do Dashboard (ATIVOS + TRANSPORTE) ──
  const frotaMap = useMemo(() => {
    const opRows = getVehicleOperationalStatusRowsWithLocals(allVehicles)
    const resumo = getVehicleOperationalStatusSummary(opRows)
    const ativasVehicles = [
      ...(resumo.find((s) => s.label === 'ATIVOS')?.vehicles ?? []),
      ...(resumo.find((s) => s.label === 'TRANSPORTE')?.vehicles ?? []),
    ]
    const ativasSet = new Set(ativasVehicles.map((r) => normPlaca(r.placa)))
    const m = new Map<string, VeiculoRow>()
    for (const v of allVehicles) {
      const placa = normPlaca(v.placa)
      if (!placa || !ativasSet.has(placa)) continue
      m.set(placa, {
        placa,
        modelo: v.modelo ?? '—',
        base: v.base ?? '',
        supervisor: v.supervisor ?? '',
        coordenador: v.coordenador ?? '',
        responsavel: v.responsavel ?? '',
        processo: v.prefixo ?? '',
      })
    }
    return m
  }, [allVehicles])

  // ── checklists do período ─────────────────────────────────────────────────
  const [rawChecklists, setRawChecklists] = useState<ChecklistRow[]>([])
  const [checklistCompletionsByDay, setChecklistCompletionsByDay] = useState<Set<string>>(() => new Set())
  const [loading, setLoading] = useState(true)

  const periodDays = useMemo(() => listDaysInPeriod(limites.ini, limites.fim), [limites])
  const diasNoPeriodo = periodDays.length

  const [mockFrotaAtiva, setMockFrotaAtiva] = useState<Map<string, VeiculoRow>>(() => new Map())

  useEffect(() => {
    void import('../apontamentos/mockData').then(({ MOCK_FROTA_ATIVA }) => {
      const m = new Map<string, VeiculoRow>()
      for (const v of MOCK_FROTA_ATIVA) {
        const placa = normPlaca(v.placa)
        if (placa) m.set(placa, { placa, modelo: v.modelo, base: v.base, supervisor: v.supervisor, coordenador: v.coordenador, responsavel: v.responsavel, processo: v.processo })
      }
      setMockFrotaAtiva(m)
    })
  }, [])

  // frotaMap efetivo: FleetContext quando disponível, senão fallback do mock
  const frotaMapEfetivo = useMemo(() => {
    if (frotaMap.size > 0) return frotaMap
    return mockFrotaAtiva
  }, [frotaMap, mockFrotaAtiva])

  useEffect(() => {
    if (frotaMapEfetivo.size === 0) return
    setLoading(true)
    void import('../apontamentos/mockData').then(({ MOCK_CHECKLIST_ROWS }) => {
      const completions = new Set<string>()
      const seen = new Map<string, ChecklistRow>()

      const filtered = MOCK_CHECKLIST_ROWS.filter(
        (r) => r.data >= limites.ini && r.data <= limites.fim,
      )

      for (const row of filtered) {
        const placa = normPlaca(row.placa)
        if (!placa) continue
        completions.add(`${placa}|${row.data}`)
        if (seen.has(placa)) continue
        const frotaInfo = frotaMapEfetivo.get(placa)
        seen.set(placa, {
          placa,
          modelo: frotaInfo?.modelo ?? row.modelo,
          base: frotaInfo?.base ?? row.base,
          supervisor: frotaInfo?.supervisor ?? row.supervisor,
          coordenador: frotaInfo?.coordenador ?? row.coordenador,
          responsavel: frotaInfo?.responsavel ?? row.responsavel,
          processo: frotaInfo?.processo ?? '',
          data: row.data,
          hora: row.hora,
          temNc: row.temNc,
        })
      }

      setChecklistCompletionsByDay(completions)
      setRawChecklists(Array.from(seen.values()))
      setLoading(false)
    })
  }, [limites, frotaMapEfetivo])

  // ── aplicar filtros ───────────────────────────────────────────────────────
  const passaFiltros = useCallback(
    (r: { base: string; supervisor: string; coordenador: string; responsavel: string }) => {
      if (filtroBase !== 'todos' && !matchesBaseFilter(r.base, filtroBase)) return false
      if (filtroSupervisor !== 'todos' && !matchesSupervisorFilter(r.supervisor, filtroSupervisor)) return false
      if (filtroCoordenador !== 'todos' && !matchesCoordenadorFilter(r.coordenador, filtroCoordenador)) return false
      if (filtroResponsavel !== 'todos' && normNome(r.responsavel) !== normNome(filtroResponsavel)) return false
      return true
    },
    [filtroBase, filtroSupervisor, filtroCoordenador, filtroResponsavel],
  )

  const placasRealizaram = useMemo(
    () => rawChecklists.filter(passaFiltros),
    [rawChecklists, passaFiltros],
  )

  const placasRealizaramSet = useMemo(
    () => new Set(placasRealizaram.map((r) => r.placa)),
    [placasRealizaram],
  )

  const placasNaoRealizaram = useMemo(
    () => Array.from(frotaMapEfetivo.values()).filter((v) => !placasRealizaramSet.has(v.placa) && passaFiltros(v)),
    [frotaMapEfetivo, placasRealizaramSet, passaFiltros],
  )

  const frotaFiltrada = useMemo(
    () => Array.from(frotaMapEfetivo.values()).filter(passaFiltros),
    [frotaMapEfetivo, passaFiltros],
  )

  // ── busca ─────────────────────────────────────────────────────────────────
  const q = busca.trim().toUpperCase()

  const realizaramFiltrados = useMemo(() => {
    if (!q) return placasRealizaram
    return placasRealizaram.filter(
      (r) => r.placa.includes(q) || r.modelo.toUpperCase().includes(q) || r.base.toUpperCase().includes(q),
    )
  }, [placasRealizaram, q])

  const naoRealizaramFiltrados = useMemo(() => {
    if (!q) return placasNaoRealizaram
    return placasNaoRealizaram.filter(
      (r) => r.placa.includes(q) || r.modelo.toUpperCase().includes(q) || r.base.toUpperCase().includes(q),
    )
  }, [placasNaoRealizaram, q])

  const total = placasRealizaram.length + placasNaoRealizaram.length
  const pct = total > 0 ? Math.round((placasRealizaram.length / total) * 100) : 0
  const periodoLabel = PERIODO_OPTIONS.find((o) => o.value === periodo)?.label ?? 'Período'
  const periodoResumo = limites.ini === limites.fim
    ? formatIsoDateBR(limites.ini)
    : `${formatIsoDateBR(limites.ini)} a ${formatIsoDateBR(limites.fim)}`
  // ── opções em cascata ────────────────────────────────────────────────────
  const responsaveisDaGerencia = useMemo(
    () => getResponsaveisByGerencia(filtroCoordenador),
    [filtroCoordenador],
  )

  const basesDaCascata = useMemo(
    () => getBasesByGerenciaAndResponsavel(filtroCoordenador, filtroResponsavel),
    [filtroCoordenador, filtroResponsavel],
  )

  const responsavelOptions = useMemo(() => {
    const nomes = new Set<string>()
    for (const v of allVehicles) {
      const nome = v.responsavel?.trim()
      if (!nome || nome === 'NÃO ATRIBUÍDO') continue
      // se a gerência tem mapeamento, exibe só os responsáveis dela (comparação sem acento)
      if (responsaveisDaGerencia && !responsaveisDaGerencia.some((r) => normNome(r) === normNome(nome))) continue
      nomes.add(nome)
    }
    const sorted = Array.from(nomes).sort((a, b) => a.localeCompare(b, 'pt-BR'))
    return [{ value: 'todos', label: 'Todos' }, ...sorted.map((n) => ({ value: n, label: n }))]
  }, [allVehicles, responsaveisDaGerencia])

  const baseOptions = useMemo(() => {
    if (!basesDaCascata) return BASE_FILTER_SELECT_OPTIONS
    const allowed = new Set(basesDaCascata.map((b) => b.toLowerCase()))
    return BASE_FILTER_SELECT_OPTIONS.filter((o) => o.value === 'todos' || allowed.has(o.value.toLowerCase()))
  }, [basesDaCascata])

  // reset de filtros dependentes quando a gerência muda
  useEffect(() => {
    if (responsaveisDaGerencia && filtroResponsavel !== 'todos') {
      if (!responsaveisDaGerencia.some((r) => normNome(r) === normNome(filtroResponsavel))) setFiltroResponsavel('todos')
    }
  }, [filtroCoordenador, responsaveisDaGerencia, filtroResponsavel])

  useEffect(() => {
    if (basesDaCascata && filtroBase !== 'todos') {
      const allowed = basesDaCascata.map((b) => b.toLowerCase())
      if (!allowed.includes(filtroBase.toLowerCase())) setFiltroBase('todos')
    }
  }, [filtroCoordenador, filtroResponsavel, basesDaCascata, filtroBase])

  const filtrosAtivos =
    filtroBase !== 'todos' ||
    filtroCoordenador !== 'todos' ||
    filtroSupervisor !== 'todos' ||
    filtroResponsavel !== 'todos' ||
    busca.trim().length > 0

  const exportarPdf = useCallback(
    async (scope: ChecklistDetalharPdfScope) => {
      setPdfGerando(true)
      try {
        await generateChecklistDetalharPdf(
          scope,
          {
            periodoLabel,
            periodoResumo,
            busca: q || undefined,
          },
          naoRealizaramFiltrados,
          realizaramFiltrados,
        )
        setPdfModalOpen(false)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Não foi possível gerar o PDF.'
        window.alert(msg)
      } finally {
        setPdfGerando(false)
      }
    },
    [periodoLabel, periodoResumo, q, naoRealizaramFiltrados, realizaramFiltrados],
  )

  const capturarRanking = useCallback(async () => {
    setCapturandoFoto(true)
    try {
      const groupLabel =
        CHECKLIST_TOP10_GROUP_OPTIONS.find((o) => o.value === rankingGroupBy)?.label ?? 'Responsável'
      const dataUrl = generateRankingScreenshot({
        periodoLabel,
        periodoResumo,
        diasNoPeriodo,
        groupLabel,
        pior: buildChecklistAdherenceRanking(
          frotaFiltrada,
          checklistCompletionsByDay,
          periodDays,
          rankingGroupBy,
          'worst',
        ),
        melhor: buildChecklistAdherenceRanking(
          frotaFiltrada,
          checklistCompletionsByDay,
          periodDays,
          rankingGroupBy,
          'best',
        ),
      })
      downloadDataUrl(dataUrl, `ranking-checklist-${limites.ini}-${limites.fim}.png`)
    } catch {
      window.alert('Não foi possível capturar a imagem do ranking.')
    } finally {
      setCapturandoFoto(false)
    }
  }, [
    periodoLabel,
    periodoResumo,
    diasNoPeriodo,
    rankingGroupBy,
    frotaFiltrada,
    checklistCompletionsByDay,
    periodDays,
    limites.ini,
    limites.fim,
  ])

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto bg-slate-50/70 px-4 py-5 dark:bg-slate-950 sm:px-6 lg:px-8">

      {/* Cabeçalho */}
      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-soft dark:border-slate-800 dark:bg-slate-900">
        <div className="relative">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(181,22,73,0.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.16),transparent_34%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(181,22,73,0.32),transparent_32%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.20),transparent_34%)]" />
          <div className="relative grid gap-5 p-5 sm:p-6 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.9fr)] xl:items-stretch">
            <div className="flex flex-col justify-between gap-5">
              <div>
                <div className="mb-5 flex flex-wrap items-center gap-2">
                  <Link
                    to="/"
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white/85 px-3 py-2 text-xs font-extrabold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-white hover:text-slate-950 dark:border-slate-700 dark:bg-slate-950/75 dark:text-slate-200 dark:hover:bg-slate-950 dark:hover:text-white"
                  >
                    <ArrowLeft size={14} />
                    Voltar ao dashboard
                  </Link>
                  <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-950 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white shadow-sm dark:border-slate-700 dark:bg-slate-950/80">
                    <Calendar size={12} />
                    {periodoLabel} · {periodoResumo}
                  </div>
                </div>

                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                  Checklist operacional
                </p>
                <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white sm:text-4xl">
                  Detalhar checklists
                </h1>
                <p className="mt-2 max-w-2xl text-sm font-semibold text-slate-500 dark:text-slate-400">
                  Acompanhe a aderência da frota e identifique rapidamente quem ainda precisa realizar o checklist.
                </p>
              </div>

              {!loading && total > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white/75 p-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/45">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Aderência no período</p>
                      <p className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-300">
                        {placasRealizaram.length} de {total} veículos realizaram checklist.
                      </p>
                    </div>
                    <span className={`rounded-2xl px-3 py-1.5 text-xl font-black ${pct >= 80 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : pct >= 50 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'}`}>
                      {pct}%
                    </span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200/70 dark:bg-slate-800 dark:ring-slate-700/70">
                    <div
                      className={`h-full rounded-full shadow-[0_0_22px_currentColor] ${pct >= 80 ? 'bg-emerald-500 text-emerald-500' : pct >= 50 ? 'bg-amber-500 text-amber-500' : 'bg-rose-500 text-rose-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white/85 p-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/55">
                <div className="absolute inset-y-0 left-0 w-1 bg-slate-400/70" />
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Veículos ativos</p>
                <p className="mt-2 text-3xl font-black text-slate-950 dark:text-white">{total}</p>
                <p className="mt-1 text-[11px] font-semibold text-slate-400">ativos no recorte atual</p>
              </div>
              <div className="group relative overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 shadow-sm backdrop-blur dark:border-emerald-900/60 dark:bg-emerald-950/25">
                <div className="absolute inset-y-0 left-0 w-1 bg-emerald-500" />
                <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700/70 dark:text-emerald-300/80">Realizaram</p>
                <p className="mt-2 text-3xl font-black text-emerald-700 dark:text-emerald-300">{placasRealizaram.length}</p>
                <p className="mt-1 text-[11px] font-semibold text-emerald-700/60 dark:text-emerald-300/60">checklists concluídos</p>
              </div>
              <div className="group relative overflow-hidden rounded-2xl border border-rose-200 bg-rose-50/80 p-4 shadow-sm backdrop-blur dark:border-rose-900/60 dark:bg-rose-950/25">
                <div className="absolute inset-y-0 left-0 w-1 bg-rose-500" />
                <p className="text-[10px] font-black uppercase tracking-wider text-rose-700/70 dark:text-rose-300/80">Não realizaram</p>
                <p className="mt-2 text-3xl font-black text-rose-700 dark:text-rose-300">{placasNaoRealizaram.length}</p>
                <p className="mt-1 text-[11px] font-semibold text-rose-700/60 dark:text-rose-300/60">pendentes no período</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Filtros e busca */}
      <section className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-soft dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Filtros</p>
            {filtrosAtivos && !filtrosVisiveis ? (
              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-black text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
                Ativos
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">

            {filtrosAtivos && filtrosVisiveis ? (
              <button
                type="button"
                onClick={() => {
                  setFiltroBase('todos')
                  setFiltroCoordenador('todos')
                  setFiltroSupervisor('todos')
                  setFiltroResponsavel('todos')
                  setBusca('')
                }}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200/80 bg-transparent px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-700 transition hover:bg-slate-100/60 dark:border-slate-600/60 dark:text-slate-200 dark:hover:bg-white/5"
              >
                <X size={13} className="text-slate-400" />
                Limpar
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setFiltrosVisiveis((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-transparent px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-700 transition hover:bg-slate-100/60 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-600/60 dark:text-slate-200 dark:hover:bg-white/5"
            >
              {filtrosVisiveis ? (
                <>
                  <ChevronUp size={13} className="text-slate-400" />
                  Ocultar filtros
                </>
              ) : (
                <>
                  <ChevronDown size={13} className="text-slate-400" />
                  Mostrar filtros
                </>
              )}
            </button>
          </div>
        </div>

        <div
          className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${filtrosVisiveis ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
        >
          <div className="overflow-hidden">
            <div className="flex flex-col gap-3 p-4">
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                Refine por período, localidade, gestão e supervisor.
              </p>

              <div className="grid gap-3 lg:grid-cols-[minmax(220px,0.75fr)_minmax(0,1.35fr)]">
                <div className="relative">
                  <Calendar size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <select
                    value={periodo}
                    onChange={(e) => setPeriodo(e.target.value)}
                    className="h-11 w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 pl-9 pr-9 text-sm font-extrabold text-slate-700 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                  >
                    {PERIODO_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>

                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 dark:border-slate-700 dark:bg-slate-950">
                  <Search size={15} className="shrink-0 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar por placa, modelo ou base..."
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-700 placeholder:text-slate-400 outline-none dark:text-slate-200"
                  />
                  {busca && (
                    <button type="button" onClick={() => setBusca('')} className="text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200">
                      <X size={15} />
                    </button>
                  )}
                </div>
              </div>

              {periodo === 'custom' && (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    type="date"
                    value={customDesde}
                    onChange={(e) => setCustomDesde(e.target.value)}
                    className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                  />
                  <span className="hidden text-xs font-bold text-slate-400 sm:inline">até</span>
                  <input
                    type="date"
                    value={customAte}
                    onChange={(e) => setCustomAte(e.target.value)}
                    className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                  />
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Select label="Gerência" value={filtroCoordenador} onChange={setFiltroCoordenador} options={COORDENADOR_FILTER_SELECT_OPTIONS} />
                <Select label="Responsável" value={filtroResponsavel} onChange={setFiltroResponsavel} options={responsavelOptions} />
                <Select label="Base" value={filtroBase} onChange={setFiltroBase} options={baseOptions} />
                <Select label="Supervisor" value={filtroSupervisor} onChange={setFiltroSupervisor} options={SUPERVISOR_FILTER_SELECT_OPTIONS} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Abas + listas */}
      {loading ? (
        <div className="flex flex-1 items-center justify-center py-20">
          <span className="size-7 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600 dark:border-slate-600 dark:border-t-blue-400" />
        </div>
      ) : (
        <div
          ref={columnsRef}
          className={`flex min-h-0 flex-1 flex-col gap-3 ${isFullscreen ? 'bg-slate-50 p-4 dark:bg-slate-950' : ''}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {viewMode === 'ranking' ? 'Rankings do período' : 'Resultados por veículo'}
            </p>
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  title="Visão em cards"
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide transition ${
                    viewMode === 'cards'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                      : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                  }`}
                >
                  <LayoutGrid size={13} />
                  Cards
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  title="Visão em lista"
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide transition ${
                    viewMode === 'list'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                      : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                  }`}
                >
                  <List size={13} />
                  Lista
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('ranking')}
                  title="Visão em ranking"
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide transition ${
                    viewMode === 'ranking'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                      : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                  }`}
                >
                  <Trophy size={13} />
                  Ranking
                </button>
              </div>
              {viewMode === 'ranking' ? (
                <button
                  type="button"
                  onClick={() => void capturarRanking()}
                  disabled={capturandoFoto}
                  title="Capturar imagem do ranking"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <Camera size={14} className={capturandoFoto ? 'animate-pulse' : ''} />
                  {capturandoFoto ? 'Gerando…' : 'Foto'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setPdfModalOpen(true)}
                  title="Exportar PDF"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <FileDown size={14} />
                  PDF
                </button>
              )}
              <button
                type="button"
                onClick={() => void toggleFullscreen()}
                title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                {isFullscreen ? 'Sair' : 'Tela cheia'}
              </button>
            </div>
          </div>

        {viewMode === 'ranking' ? (
          <ChecklistTop10Section
            frota={frotaFiltrada}
            completions={checklistCompletionsByDay}
            diasNoPeriodo={diasNoPeriodo}
            periodDays={periodDays}
            periodoLabel={periodoLabel}
            periodoResumo={periodoResumo}
            groupBy={rankingGroupBy}
            onGroupByChange={setRankingGroupBy}
            fullscreen={isFullscreen}
          />
        ) : (
        <div className={`grid min-h-0 flex-1 gap-4 xl:grid-cols-2 xl:items-stretch ${isFullscreen ? 'min-h-0' : ''}`}>

          {/* Coluna: Não realizaram */}
          <div className={`flex flex-col overflow-hidden rounded-[1.5rem] border border-rose-200/80 bg-white shadow-soft dark:border-rose-950/60 dark:bg-slate-900 ${isFullscreen ? 'min-h-0 flex-1' : 'min-h-[420px]'}`}>
            <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-rose-100 bg-rose-50/85 px-4 py-3 backdrop-blur dark:border-rose-950/50 dark:bg-rose-950/25">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-white text-rose-500 shadow-sm dark:bg-slate-950">
                <ClipboardX size={15} />
              </span>
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-rose-700 dark:text-rose-300">Não realizaram</span>
                <p className="text-[10px] font-semibold text-rose-500/70 dark:text-rose-300/60">Veículos sem checklist no período</p>
              </div>
              <span className="ml-auto rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-black text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
                {naoRealizaramFiltrados.length}
              </span>
            </div>

            {naoRealizaramFiltrados.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-14 text-slate-400">
                <CheckCircle2 size={28} className="text-emerald-400" />
                <p className="text-xs font-semibold">
                  {q ? 'Sem resultados.' : 'Todos realizaram o checklist!'}
                </p>
              </div>
            ) : viewMode === 'list' ? (
              <ListaNaoRealizaram items={naoRealizaramFiltrados} />
            ) : (
              <div className={`custom-scrollbar space-y-3 overflow-y-auto p-3 ${isFullscreen ? 'flex-1' : 'max-h-[62vh]'}`}>
                {naoRealizaramFiltrados.map((v) => (
                  <div
                    key={v.placa}
                    className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-gradient-to-br from-white to-rose-50/35 p-3.5 shadow-sm transition hover:-translate-y-0.5 hover:border-rose-200 hover:shadow-lg dark:border-slate-800/60 dark:from-[#0d1117] dark:to-[#161b22] dark:hover:border-rose-900/50"
                  >
                    <div className="absolute inset-y-0 left-0 w-1 bg-rose-400/70 dark:bg-rose-500/70" />
                    <div className="flex items-start gap-3 pl-1">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-rose-100 text-xs font-black text-rose-700 shadow-sm ring-1 ring-rose-200/80 dark:bg-rose-950/45 dark:text-rose-300 dark:ring-rose-900/60">
                        {v.placa.slice(0, 2)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-sm font-black tracking-wide text-slate-950 dark:text-white">{v.placa}</span>
                          {v.base && (
                            <span className="shrink-0 rounded-full bg-slate-200/70 px-2 py-0.5 text-[10px] font-black text-slate-600 ring-1 ring-slate-300/50 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
                              {v.base}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-xs font-semibold text-slate-500 dark:text-slate-400">{v.modelo}</p>
                      </div>
                    </div>
                    {(v.supervisor || v.coordenador) && (
                      <div className="mt-3 grid gap-2 pl-1 sm:grid-cols-2">
                        {v.supervisor && (
                          <div className="rounded-xl bg-white/70 px-3 py-2 ring-1 ring-slate-100 dark:bg-slate-900/60 dark:ring-slate-800">
                            <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Supervisor</p>
                            <p className="mt-0.5 truncate text-[11px] font-bold text-slate-600 dark:text-slate-300">{v.supervisor}</p>
                          </div>
                        )}
                        {v.coordenador && (
                          <div className="rounded-xl bg-white/70 px-3 py-2 ring-1 ring-slate-100 dark:bg-slate-900/60 dark:ring-slate-800">
                            <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Gerência</p>
                            <p className="mt-0.5 truncate text-[11px] font-bold text-slate-600 dark:text-slate-300">{v.coordenador}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Coluna: Realizaram */}
          <div className={`flex flex-col overflow-hidden rounded-[1.5rem] border border-emerald-200/80 bg-white shadow-soft dark:border-emerald-950/60 dark:bg-slate-900 ${isFullscreen ? 'min-h-0 flex-1' : 'min-h-[420px]'}`}>
            <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-emerald-100 bg-emerald-50/85 px-4 py-3 backdrop-blur dark:border-emerald-950/50 dark:bg-emerald-950/25">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-white text-emerald-500 shadow-sm dark:bg-slate-950">
                <ClipboardCheck size={15} />
              </span>
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Realizaram</span>
                <p className="text-[10px] font-semibold text-emerald-500/70 dark:text-emerald-300/60">Último envio encontrado por veículo</p>
              </div>
              <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                {realizaramFiltrados.length}
              </span>
            </div>

            {realizaramFiltrados.length === 0 ? (
              <div className="py-14 text-center text-xs font-semibold text-slate-400">
                {q ? 'Sem resultados.' : 'Nenhum checklist realizado no período.'}
              </div>
            ) : viewMode === 'list' ? (
              <ListaRealizaram items={realizaramFiltrados} />
            ) : (
              <div className={`custom-scrollbar space-y-3 overflow-y-auto p-3 ${isFullscreen ? 'flex-1' : 'max-h-[62vh]'}`}>
                {realizaramFiltrados.map((v) => (
                  <div
                    key={v.placa}
                    className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-gradient-to-br from-white to-emerald-50/35 p-3.5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lg dark:border-slate-800/60 dark:from-[#0d1117] dark:to-[#161b22] dark:hover:border-emerald-900/50"
                  >
                    <div className="absolute inset-y-0 left-0 w-1 bg-emerald-400/70 dark:bg-emerald-500/70" />
                    <div className="flex items-start gap-3 pl-1">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-xs font-black text-emerald-700 shadow-sm ring-1 ring-emerald-200/80 dark:bg-emerald-950/45 dark:text-emerald-300 dark:ring-emerald-900/60">
                        {v.placa.slice(0, 2)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-black tracking-wide text-slate-950 dark:text-white">{v.placa}</span>
                          {v.base && (
                            <span className="shrink-0 rounded-full bg-slate-200/70 px-2 py-0.5 text-[10px] font-black text-slate-600 ring-1 ring-slate-300/50 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
                              {v.base}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-xs font-semibold text-slate-500 dark:text-slate-400">{v.modelo}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black text-emerald-700 ring-1 ring-emerald-200/70 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/60">
                          {v.hora}
                        </span>
                        {v.temNc && (
                          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black text-amber-700 ring-1 ring-amber-200/70 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/60">
                            NC
                          </span>
                        )}
                      </div>
                    </div>
                    {(v.supervisor || v.coordenador) && (
                      <div className="mt-3 grid gap-2 pl-1 sm:grid-cols-2">
                        {v.supervisor && (
                          <div className="rounded-xl bg-white/70 px-3 py-2 ring-1 ring-slate-100 dark:bg-slate-900/60 dark:ring-slate-800">
                            <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Supervisor</p>
                            <p className="mt-0.5 truncate text-[11px] font-bold text-slate-600 dark:text-slate-300">{v.supervisor}</p>
                          </div>
                        )}
                        {v.coordenador && (
                          <div className="rounded-xl bg-white/70 px-3 py-2 ring-1 ring-slate-100 dark:bg-slate-900/60 dark:ring-slate-800">
                            <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Gerência</p>
                            <p className="mt-0.5 truncate text-[11px] font-bold text-slate-600 dark:text-slate-300">{v.coordenador}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
        )}

        {pdfModalOpen &&
          createPortal(
            <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-black text-slate-900 dark:text-slate-100">Exportar PDF</p>
                <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Escolha quais checklists incluir no relatório.
                </p>
              </div>
              <button
                type="button"
                onClick={() => !pdfGerando && setPdfModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                disabled={pdfGerando || naoRealizaramFiltrados.length === 0}
                onClick={() => void exportarPdf('nao')}
                className="flex w-full items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-left transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-950/60 dark:bg-rose-950/20 dark:hover:bg-rose-950/30"
              >
                <ClipboardX size={18} className="shrink-0 text-rose-600 dark:text-rose-400" />
                <div>
                  <p className="text-sm font-extrabold text-rose-800 dark:text-rose-200">Somente não realizados</p>
                  <p className="text-[11px] font-semibold text-rose-600/80 dark:text-rose-300/70">
                    {naoRealizaramFiltrados.length} veículo(s)
                  </p>
                </div>
              </button>

              <button
                type="button"
                disabled={pdfGerando || realizaramFiltrados.length === 0}
                onClick={() => void exportarPdf('sim')}
                className="flex w-full items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-950/60 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/30"
              >
                <ClipboardCheck size={18} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <p className="text-sm font-extrabold text-emerald-800 dark:text-emerald-200">Somente realizados</p>
                  <p className="text-[11px] font-semibold text-emerald-600/80 dark:text-emerald-300/70">
                    {realizaramFiltrados.length} veículo(s)
                  </p>
                </div>
              </button>

              <button
                type="button"
                disabled={pdfGerando || (naoRealizaramFiltrados.length === 0 && realizaramFiltrados.length === 0)}
                onClick={() => void exportarPdf('ambos')}
                className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800/60 dark:hover:bg-slate-800"
              >
                <FileDown size={18} className="shrink-0 text-slate-600 dark:text-slate-300" />
                <div>
                  <p className="text-sm font-extrabold text-slate-800 dark:text-slate-100">Ambos</p>
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    {naoRealizaramFiltrados.length} não realizados · {realizaramFiltrados.length} realizados
                  </p>
                </div>
              </button>
            </div>

            <button
              type="button"
              disabled={pdfGerando}
              onClick={() => setPdfModalOpen(false)}
              className="mt-5 w-full rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-extrabold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {pdfGerando ? 'Gerando PDF…' : 'Cancelar'}
            </button>
          </div>
            </div>,
            (document.fullscreenElement as HTMLElement | null) ?? document.body,
          )}
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 20px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #475569; }
      `}</style>
    </div>
  )
}
