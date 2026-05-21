import { lazy, Suspense, useEffect, useId, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  type LucideIcon,
  AlertTriangle,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  ClipboardX,
  Gauge,
  Truck,
} from 'lucide-react'

import { BASE_FILTER_SELECT_OPTIONS, matchesBaseFilter } from '../data/baseFilterOptions'
import { COORDENADOR_FILTER_SELECT_OPTIONS, matchesCoordenadorFilter } from '../data/coordenadorFilterOptions'
import { SUPERVISOR_FILTER_SELECT_OPTIONS, matchesSupervisorFilter } from '../data/supervisorFilterOptions'
import { Select } from '../components/ui/Select'
import {
  getVehicleOperationalStatusSummary,
  getVehicleOperationalStatusRowsWithLocals,
} from '../frota/vehicleOperationalStatus'
import { useFleet } from '../frota/FleetContext'
import { useTheme } from '../theme/ThemeProvider'
import { useApontamentos } from '../apontamentos/ApontamentosContext'
import { buildManageTableRows, type ApontamentoGroup } from '../apontamentos/groupApontamentos'
import type { DashboardAdesaoChartRow } from './DashboardAdesaoCharts'

const LazyDashboardAdesaoCharts = lazy(() =>
  import('./DashboardAdesaoCharts').then((m) => ({ default: m.DashboardAdesaoCharts })),
)

const PERIODO_OPTIONS = [
  { label: 'Hoje', value: 'hoje' },
  { label: 'Últimos 7 dias', value: '7d' },
  { label: 'Últimos 30 dias', value: '30d' },
  { label: 'Últimos 90 dias', value: '90d' },
  { label: 'Intervalo personalizado', value: 'custom' },
] as const

type DashboardChartLabelMode = 'hoje' | '7d' | '30d'

/** Data local YYYY-MM-DD (alinhado a `data_inspecao` gravada no checklist). */
function hojeLocalIso(): string {
  const d = new Date()
  return dateToLocalIso(d)
}

function dateToLocalIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function defaultCustomDesdeIso(): string {
  const d = new Date()
  d.setDate(d.getDate() - 6)
  d.setHours(0, 0, 0, 0)
  return dateToLocalIso(d)
}

type DashboardPeriodoLimites = {
  inicioIso: string
  fimIso: string
  inicioMs: number
  fimMsEnd: number
  chartMode: DashboardChartLabelMode
}

function computePeriodoLimites(
  periodo: string,
  customDesde: string,
  customAte: string,
): DashboardPeriodoLimites {
  const hoje = hojeLocalIso()
  if (periodo === 'custom') {
    let a = customDesde.trim()
    let b = customAte.trim()
    const isoOk = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s)
    if (!isoOk(a)) a = defaultCustomDesdeIso()
    if (!isoOk(b)) b = hoje
    if (a > b) [a, b] = [b, a]
    const d0 = new Date(a + 'T12:00:00')
    const d1 = new Date(b + 'T12:00:00')
    const spanDays = Math.max(1, Math.round((d1.getTime() - d0.getTime()) / 86_400_000) + 1)
    const chartMode: DashboardChartLabelMode = spanDays <= 1 ? 'hoje' : spanDays <= 7 ? '7d' : '30d'
    return {
      inicioIso: a,
      fimIso: b,
      inicioMs: new Date(a + 'T00:00:00').getTime(),
      fimMsEnd: new Date(b + 'T23:59:59.999').getTime(),
      chartMode,
    }
  }

  if (periodo === 'hoje') {
    return {
      inicioIso: hoje,
      fimIso: hoje,
      inicioMs: new Date(hoje + 'T00:00:00').getTime(),
      fimMsEnd: new Date(hoje + 'T23:59:59.999').getTime(),
      chartMode: 'hoje',
    }
  }

  const t = new Date()
  t.setHours(0, 0, 0, 0)
  const daysBack =
    periodo === '7d' ? 6 : periodo === '30d' ? 29 : periodo === '90d' ? 89 : 29
  t.setDate(t.getDate() - daysBack)
  const inicioIso = dateToLocalIso(t)
  const chartMode: DashboardChartLabelMode = periodo === '7d' ? '7d' : '30d'
  return {
    inicioIso,
    fimIso: hoje,
    inicioMs: new Date(inicioIso + 'T00:00:00').getTime(),
    fimMsEnd: new Date(hoje + 'T23:59:59.999').getTime(),
    chartMode,
  }
}



function fmtChartLabel(chartMode: DashboardChartLabelMode, dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  if (chartMode === 'hoje') {
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }
  if (chartMode === '7d') {
    return d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
  }
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

function GomanLogo({
  mode = 'full',
  className = '',
  variant = 'light',
}: {
  mode?: 'full' | 'icon'
  className?: string
  variant?: 'light' | 'dark'
}) {
  const uid = useId().replace(/:/g, '')
  const gradId = `gomanGrad-${uid}`
  const svg = (
    <svg
      viewBox="0 0 60 60"
      className={mode === 'icon' ? 'h-10 w-10 drop-shadow-md' : 'h-10 w-10 shrink-0 drop-shadow-md'}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1E40AF" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>
      </defs>
      <circle cx="30" cy="30" r="28" fill={`url(#${gradId})`} />
      <path
        d="M18 32L26 40L42 22"
        stroke="white"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )

  if (mode === 'icon') {
    return <div className={`flex items-center justify-center ${className}`}>{svg}</div>
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {svg}
      <span
        className={`flex items-baseline text-2xl font-black tracking-tighter ${
          variant === 'dark' ? 'text-sky-300' : 'text-[#1E3A8A] dark:text-blue-400'
        }`}
      >
        FrotaApp
      </span>
    </div>
  )
}


type Stat = {
  label: string
  value: string
  Icon: LucideIcon
  iconWrap: string
  cardHover: string
  href?: string
}

export function DashboardPage() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const areaGradId = useId().replace(/:/g, '')
  const [viewMode, setViewMode] = useState<'bar' | 'area'>('bar')
  const [periodo, setPeriodo] = useState<string>('7d')
  const [customDesde, setCustomDesde] = useState<string>(defaultCustomDesdeIso)
  const [customAte, setCustomAte] = useState<string>(() => hojeLocalIso())
  const [filtroBase, setFiltroBase] = useState<string>('todos')
  const [filtroCoordenador, setFiltroCoordenador] = useState<string>('todos')
  const [filtroSupervisor, setFiltroSupervisor] = useState<string>('todos')
  const [filtrosAvancadosVisiveis, setFiltrosAvancadosVisiveis] = useState(() => {
    try { return localStorage.getItem('frota.filtros.dashboard') === 'true' }
    catch { return false }
  })

  const navigate = useNavigate()

  const irParaDetalhar = () => {
    const params = new URLSearchParams()
    params.set('periodo', periodo)
    if (periodo === 'custom') {
      params.set('desde', customDesde)
      params.set('ate', customAte)
    }
    if (filtroBase !== 'todos') params.set('base', filtroBase)
    if (filtroCoordenador !== 'todos') params.set('gerencia', filtroCoordenador)
    if (filtroSupervisor !== 'todos') params.set('supervisor', filtroSupervisor)
    navigate(`/checklists/detalhar?${params.toString()}`)
  }

  const { vehicles: fleetVehicles } = useFleet()

  const placaParaBaseOperacional = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of getVehicleOperationalStatusRowsWithLocals(fleetVehicles)) {
      m.set(r.placa.trim().toUpperCase(), (r.base ?? '').trim())
    }
    return m
  }, [])

  const periodoLimites = useMemo(
    () => computePeriodoLimites(periodo, customDesde, customAte),
    [periodo, customDesde, customAte],
  )
  const periodoInicioIso = periodoLimites.inicioIso
  const periodoFimIso = periodoLimites.fimIso
  const periodoChartMode = periodoLimites.chartMode

  // Checklists concluídos (progresso 100) por dia — dados reais do Supabase, filtrados pela base via placa.
  const [checklistsPorDia, setChecklistsPorDia] = useState<{ data: string; realizados: number; comNc: number }[]>([])

  useEffect(() => {
    // Modo demo: usa dados mock do portfólio
    void import('../apontamentos/mockData').then(({ MOCK_CHECKLISTS_POR_DIA }) => {
      const filtered = MOCK_CHECKLISTS_POR_DIA.filter(
        (r) => r.data >= periodoInicioIso && r.data <= periodoFimIso,
      )
      setChecklistsPorDia(filtered)
    })
  }, [periodoInicioIso, periodoFimIso, filtroBase, placaParaBaseOperacional])

  const { rows } = useApontamentos()

  // Apontamentos filtrados (pendentes = não resolvidos)
  const pendenciasFiltradas = useMemo(() => {
    return rows.filter((r) => {
      if (r.resolvido) return false
      if (filtroBase !== 'todos' && !matchesBaseFilter(r.base, filtroBase)) return false
      if (filtroCoordenador !== 'todos' && !matchesCoordenadorFilter(r.coordenador, filtroCoordenador)) return false
      if (filtroSupervisor !== 'todos' && !matchesSupervisorFilter(r.responsavel, filtroSupervisor)) return false
      return true
    })
  }, [rows, filtroBase, filtroCoordenador, filtroSupervisor])

  const gruposRecorrentes = useMemo(() => {
    // Pega todos os rows como ManageTableRows e extrai os grupos
    const tableRows = buildManageTableRows(pendenciasFiltradas, true, 'desc')
    return tableRows
      .filter((r): r is { type: 'group'; group: ApontamentoGroup; sortKey: string } => r.type === 'group')
      .map((r) => r.group)
      .filter((g) => g.diasConsecutivos >= 3)
      .slice(0, 5) // máx 5 alertas
  }, [pendenciasFiltradas])

  const checklistsPorDiaNoPeriodo = useMemo(() => {
    return checklistsPorDia
      .filter((d) => d.data >= periodoInicioIso && d.data <= periodoFimIso)
      .sort((a, b) => a.data.localeCompare(b.data))
  }, [checklistsPorDia, periodoInicioIso, periodoFimIso])

  // Gráfico: realizados vs com NC no período
  const chartData = useMemo<DashboardAdesaoChartRow[]>(() => {
    return checklistsPorDiaNoPeriodo.map((d) => ({
      name: fmtChartLabel(periodoChartMode, d.data),
      realizados: d.realizados,
      naoRealizados: d.comNc,
    }))
  }, [checklistsPorDiaNoPeriodo, periodoChartMode])

  // KPIs
  const stats = useMemo<Stat[]>(() => {
    const { fimMsEnd } = periodoLimites
    const inicioMs = periodoLimites.inicioMs

    const checklistsNoPeriodo = checklistsPorDiaNoPeriodo.reduce((s, d) => s + d.realizados, 0)
    const comNcNoPeriodo = checklistsPorDiaNoPeriodo.reduce((s, d) => s + d.comNc, 0)
    const hojeIso = hojeLocalIso()
    const checklistsRealizadosHoje =
      checklistsPorDia.find((d) => d.data === hojeIso)?.realizados ?? 0
    const conformidade = checklistsNoPeriodo > 0
      ? `${Math.round(((checklistsNoPeriodo - comNcNoPeriodo) / checklistsNoPeriodo) * 100)}%`
      : '—'

    /** Mesmo critério do Status da frota: planilha total + categorias operacionais; ATIVOS no KPI = caixa ATIVOS + TRANSPORTE. */
    const todasLinhas = getVehicleOperationalStatusRowsWithLocals(fleetVehicles)
    const linhasOperacionais =
      filtroBase === 'todos'
        ? todasLinhas
        : todasLinhas.filter((r) => r.base.toLowerCase().includes(filtroBase))
    const resumoBase = getVehicleOperationalStatusSummary(linhasOperacionais)
    const ativosOperacionais =
      (resumoBase.find((s) => s.label === 'ATIVOS')?.count ?? 0) +
      (resumoBase.find((s) => s.label === 'TRANSPORTE')?.count ?? 0)

    const aderencia =
      ativosOperacionais > 0 && checklistsNoPeriodo > 0
        ? `${Math.min(999, Math.round((checklistsNoPeriodo / ativosOperacionais) * 100))}%`
        : '—'

    // Pendentes no período e filtro atual
    const pendentesNoPeriodo = pendenciasFiltradas.filter((r) => {
      const t = new Date(r.dataApontamento + 'T00:00:00').getTime()
      return t >= inicioMs && t <= fimMsEnd
    }).length

    return [
      {
        label: 'Total de veículos ativos',
        value: String(ativosOperacionais),
        Icon: Truck,
        iconWrap: 'bg-purple-50 text-purple-600 group-hover:scale-110 dark:bg-purple-950/50 dark:text-purple-400',
        cardHover: 'hover:border-purple-400 dark:hover:border-purple-500',
        href: '/veiculos/status',
      },
      {
        label: 'Checklists realizados hoje',
        value: String(checklistsRealizadosHoje),
        Icon: ClipboardCheck,
        iconWrap: 'bg-blue-50 text-blue-600 group-hover:scale-110 dark:bg-blue-950/50 dark:text-blue-400',
        cardHover: 'hover:border-blue-400 dark:hover:border-blue-500',
        href: '/gerenciar/checklists',
      },
      {
        label: 'Conformidade',
        value: conformidade,
        Icon: CheckCircle2,
        iconWrap: 'bg-emerald-50 text-emerald-600 group-hover:scale-110 dark:bg-emerald-950/50 dark:text-emerald-400',
        cardHover: 'hover:border-emerald-400 dark:hover:border-emerald-500',
      },
      {
        label: 'Pendentes',
        value: String(pendentesNoPeriodo),
        Icon: ClipboardX,
        iconWrap: 'bg-orange-50 text-orange-600 group-hover:scale-110 dark:bg-orange-950/50 dark:text-orange-400',
        cardHover: 'hover:border-orange-400 dark:hover:border-orange-500',
        href: '/gerenciar',
      },
      {
        label: 'Aderência da Frota',
        value: aderencia,
        Icon: Gauge,
        iconWrap: 'bg-sky-50 text-sky-600 group-hover:scale-110 dark:bg-sky-950/50 dark:text-sky-400',
        cardHover: 'hover:border-sky-400 dark:hover:border-sky-500',
      },
    ]
  }, [checklistsPorDia, checklistsPorDiaNoPeriodo, pendenciasFiltradas, periodoLimites, filtroBase, fleetVehicles])

  const chartUi = useMemo(
    () => ({
      grid: isDark ? 'rgba(148,163,184,0.14)' : '#e2e8f0',
      tick: isDark ? '#94a3b8' : '#64748b',
    }),
    [isDark],
  )

  return (
    <div className="-mx-3 -my-3 flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden bg-transparent text-slate-900 dark:text-slate-100 sm:-mx-4 sm:-my-4 lg:-mx-8 lg:-my-6">
      <div className="shrink-0 overflow-hidden border-b border-slate-200/80 bg-transparent dark:border-slate-800/60 dark:bg-transparent sm:rounded-t-xl lg:rounded-t-2xl">
        <header className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 sm:py-3.5 lg:px-8">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:gap-5 lg:gap-8">
            <GomanLogo mode="full" />
            <div className="hidden h-8 w-px shrink-0 bg-slate-200 dark:bg-slate-700 md:block" />
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
              <div className="relative min-w-0">
                <Calendar
                  className="pointer-events-none absolute left-3 top-1/2 z-10 size-3.5 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                  aria-hidden
                />
                <select
                  id="dashboard-periodo-preset"
                  value={periodo}
                  onChange={(e) => setPeriodo(e.target.value)}
                  aria-label="Período do dashboard"
                  className="w-full min-w-[132px] appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-9 text-sm font-bold text-slate-900 shadow-sm outline-none transition-colors hover:bg-slate-50 focus:ring-2 focus:ring-blue-500/40 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900/60 sm:min-w-[158px]"
                >
                  {PERIODO_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                  aria-hidden
                />
              </div>
              {periodo === 'custom' ? (
                <div
                  className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-end sm:gap-2"
                  role="group"
                  aria-labelledby="dashboard-periodo-preset"
                >
                  <label className="flex min-w-0 flex-1 flex-col gap-1 sm:min-w-[9.5rem]">
                    <span className="pl-0.5 text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                      De
                    </span>
                    <input
                      type="date"
                      value={customDesde}
                      max={hojeLocalIso()}
                      onChange={(e) => setCustomDesde(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-bold tabular-nums text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </label>
                  <label className="flex min-w-0 flex-1 flex-col gap-1 sm:min-w-[9.5rem]">
                    <span className="pl-0.5 text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                      Até
                    </span>
                    <input
                      type="date"
                      value={customAte}
                      min={customDesde}
                      max={hojeLocalIso()}
                      onChange={(e) => setCustomAte(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-bold tabular-nums text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </label>
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
            <button
              type="button"
              id="dashboard-toggle-filtros"
              aria-expanded={filtrosAvancadosVisiveis}
              aria-controls="dashboard-filtros-avancados"
              onClick={() => setFiltrosAvancadosVisiveis((v) => {
                const next = !v
                try { localStorage.setItem('frota.filtros.dashboard', String(next)) } catch { /* ignore */ }
                return next
              })}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-transparent px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-700 transition hover:bg-slate-100/60 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-600/60 dark:bg-transparent dark:text-slate-200 dark:hover:bg-white/5 sm:gap-2 sm:px-3.5 sm:text-[11px]"
            >
              {filtrosAvancadosVisiveis ? (
                <ChevronUp size={15} className="shrink-0 text-slate-500 dark:text-slate-400" aria-hidden />
              ) : (
                <ChevronDown size={15} className="shrink-0 text-slate-500 dark:text-slate-400" aria-hidden />
              )}
              <span className="max-w-[9rem] truncate sm:max-w-none">
                {filtrosAvancadosVisiveis ? 'Ocultar filtros' : 'Mostrar filtros'}
              </span>
            </button>
            <button
              type="button"
              onClick={irParaDetalhar}
              className="flex items-center justify-center rounded-xl bg-[#1E3A8A] px-4 py-2.5 text-[11px] font-black uppercase tracking-widest text-white shadow-lg shadow-blue-900/15 transition-all duration-300 ease-out will-change-transform hover:-translate-y-0.5 hover:scale-[1.03] hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-900/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white active:translate-y-0 active:scale-[0.98] active:shadow-lg dark:shadow-blue-950/30 dark:focus-visible:ring-offset-slate-950 sm:rounded-2xl sm:px-5 sm:text-xs sm:py-3"
            >
              Detalhar
            </button>
          </div>
        </header>

        <div
          id="dashboard-filtros-avancados"
          className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${filtrosAvancadosVisiveis ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
        >
          <div className="overflow-hidden">
            <div className="border-t border-slate-100/80 bg-transparent px-4 py-3 dark:border-slate-800/60 dark:bg-transparent sm:px-6 sm:py-4 lg:px-8">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3 lg:gap-4">
                <Select
                  label="Base"
                  value={filtroBase}
                  onChange={setFiltroBase}
                  options={BASE_FILTER_SELECT_OPTIONS}
                />
                <Select
                  label="Gerência"
                  value={filtroCoordenador}
                  onChange={setFiltroCoordenador}
                  options={COORDENADOR_FILTER_SELECT_OPTIONS}
                />
                <Select
                  label="Supervisor"
                  value={filtroSupervisor}
                  onChange={setFiltroSupervisor}
                  options={SUPERVISOR_FILTER_SELECT_OPTIONS}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3 sm:gap-4 sm:p-4 lg:flex-row lg:gap-5 lg:p-5">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden sm:gap-4">
          <div className="grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 sm:gap-4">
            {stats.map((s) => {
              const Card = s.href ? Link : 'div'
              const isLast = stats[stats.length - 1]?.label === s.label
              return (
              <Card
                key={s.label}
                to={s.href ?? '#'}
                className={`group flex flex-col items-center text-center rounded-2xl border border-slate-200/70 bg-transparent p-4 transition-all duration-300 dark:border-slate-700/50 dark:bg-transparent sm:rounded-[2rem] sm:p-5 ${isLast ? 'col-span-2 sm:col-span-1' : ''} ${s.cardHover} ${s.href ? 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-400/40' : ''}`}
              >
                <div className={`mb-3 shrink-0 rounded-xl p-3 transition-transform sm:rounded-2xl sm:p-3.5 ${s.iconWrap}`}>
                  <s.Icon size={26} aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="mb-1 text-[9px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500 sm:text-[10px]">
                    {s.label}
                  </p>
                  <h3 className="text-2xl font-black tabular-nums tracking-tighter text-slate-800 dark:text-white sm:text-3xl min-[1100px]:text-4xl">
                    {s.value}
                  </h3>
                </div>
              </Card>
            )})}
          </div>

          {gruposRecorrentes.length > 0 && (
            <div data-tour="dashboard-recorrentes" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/40 dark:bg-rose-950/20">
              <div className="mb-3 flex items-center gap-2">
                <AlertTriangle size={16} className="shrink-0 text-rose-600 dark:text-rose-400" />
                <span className="text-sm font-extrabold text-rose-800 dark:text-rose-200">
                  {gruposRecorrentes.length} defeito{gruposRecorrentes.length > 1 ? 's' : ''} recorrente{gruposRecorrentes.length > 1 ? 's' : ''} (3+ dias seguidos)
                </span>
              </div>
              <ul className="flex flex-col gap-2">
                {gruposRecorrentes.map((g) => (
                  <li key={g.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-rose-900 dark:text-rose-200">
                    <span className="rounded bg-rose-100 px-1.5 py-0.5 font-mono font-black dark:bg-rose-900/40">
                      {g.representative.prefixo || g.placa}
                    </span>
                    <span className="flex-1 leading-snug">{g.representative.defeito}</span>
                    <span className="shrink-0 font-extrabold text-rose-700 dark:text-rose-300">
                      {g.diasConsecutivos}d seguidos · {g.count}x
                    </span>
                  </li>
                ))}
              </ul>
              <Link
                to="/gerenciar?severidade=imperativo"
                className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-extrabold text-rose-700 underline-offset-2 hover:underline dark:text-rose-300"
              >
                Ver no Gerenciar →
              </Link>
            </div>
          )}

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-transparent dark:border-slate-700/50 dark:bg-transparent sm:rounded-[2.5rem]">
            <div className="flex shrink-0 flex-col gap-2 border-b border-slate-100/80 bg-transparent p-4 dark:border-slate-800/60 dark:bg-transparent sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="rounded-xl bg-[#1E3A8A] p-2.5 text-white shadow-md shadow-blue-900/20 dark:shadow-blue-950/40 sm:rounded-2xl sm:p-3">
                  <BarChart3 size={20} aria-hidden />
                </div>
                <div className="min-w-0">
                  <h2 className="text-xs font-black uppercase tracking-tighter text-slate-800 dark:text-white sm:text-sm">
                    Adesão aos checklists
                  </h2>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 sm:text-[10px]">
                    Realizados vs. com NC
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 rounded-xl border border-slate-200/60 bg-transparent p-1 dark:border-slate-600/50 dark:bg-transparent sm:rounded-2xl sm:p-1.5">
                <button
                  type="button"
                  onClick={() => setViewMode('bar')}
                  className={`rounded-lg px-3 py-2 text-[9px] font-black transition-all sm:rounded-xl sm:px-5 sm:py-2.5 sm:text-[10px] ${
                    viewMode === 'bar'
                      ? 'bg-white/90 text-blue-600 shadow-sm dark:bg-slate-900/90 dark:text-blue-400'
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                  }`}
                >
                  BARRAS
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('area')}
                  className={`rounded-lg px-3 py-2 text-[9px] font-black transition-all sm:rounded-xl sm:px-5 sm:py-2.5 sm:text-[10px] ${
                    viewMode === 'area'
                      ? 'bg-white/90 text-blue-600 shadow-sm dark:bg-slate-900/90 dark:text-blue-400'
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                  }`}
                >
                  ÁREA
                </button>
              </div>
            </div>

            <div className="flex h-[min(52vh,480px)] min-h-[260px] min-w-0 flex-1 flex-col p-3 sm:min-h-[300px] sm:p-4 lg:h-[min(56vh,560px)] lg:p-5">
              <Suspense
                fallback={
                  <div className="flex min-h-[240px] flex-1 items-center justify-center gap-2 text-sm font-semibold text-slate-400 dark:text-slate-500">
                    <span
                      className="size-5 shrink-0 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600 dark:border-slate-600 dark:border-t-slate-300"
                      aria-hidden
                    />
                    A carregar gráfico…
                  </div>
                }
              >
                <LazyDashboardAdesaoCharts
                  chartData={chartData}
                  viewMode={viewMode}
                  chartUi={chartUi}
                  isDark={isDark}
                  areaGradId={areaGradId}
                />
              </Suspense>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 20px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #475569; }
      `}</style>
    </div>
  )
}
