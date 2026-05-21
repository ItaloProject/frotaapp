import { useMemo, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  RotateCcw,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { useApontamentos, type Apontamento } from '../apontamentos/ApontamentosContext'
import { formatDefeitoParaExibicao } from '../apontamentos/defeitoExibicao'
import {
  type EvolucaoFiltros,
  type PontoEvolucao,
  buildMonthlyChartPoints,
  buildResolvidosCsv,
  buildWeeklyChartPoints,
  diasEntreApontamentoEResolucao,
  downloadCsv,
  filterResolvidosParaEvolucao,
  mediaDiasApontamentoResolucao,
  mondayKeyFromDateIso,
  parseIsoDate,
} from '../apontamentos/evolucaoAnalytics'
import { BASE_FILTER_SELECT_OPTIONS, matchesBaseFilter } from '../data/baseFilterOptions'
import { COORDENADOR_FILTER_SELECT_OPTIONS, matchesCoordenadorFilter } from '../data/coordenadorFilterOptions'
import { Select, type SelectOption } from '../components/ui/Select'

const TOOLTIP_EXEMPLOS_MAX = 5
const TOOLTIP_W = 240
const TOOLTIP_H = 220

const DATA_OPTS: SelectOption[] = [
  { value: 'todos', label: 'Todos' },
  { value: '30', label: 'Últimos 30 dias (resolução)' },
  { value: '90', label: 'Últimos 90 dias (resolução)' },
  { value: '365', label: 'Últimos 12 meses (resolução)' },
  { value: 'ano', label: 'Ano atual (resolução)' },
]

function uniqSorted(values: string[]): SelectOption[] {
  const u = [...new Set(values)].filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  return u.map((v) => ({ value: v, label: v }))
}

function classifyCelula(dias: number | null) {
  if (dias == null) return { cellClass: 'bg-slate-600 dark:bg-slate-700', textClass: 'text-slate-200', label: 'Sem dados' }
  if (dias <= 15) return { cellClass: 'bg-emerald-600 dark:bg-emerald-700', textClass: 'text-emerald-50', label: 'Bom (verde)' }
  if (dias <= 30) return { cellClass: 'bg-orange-500 dark:bg-orange-600', textClass: 'text-orange-950 dark:text-orange-100', label: 'Atenção (laranja)' }
  return { cellClass: 'bg-red-600 dark:bg-red-700', textClass: 'text-red-50', label: 'Crítico (vermelho)' }
}

function diasColor(dias: number | null) {
  if (dias == null) return '#64748b'
  if (dias <= 15) return '#16a34a'
  if (dias <= 30) return '#f97316'
  return '#dc2626'
}

function gapColor(n: number): string {
  if (n === 0) return 'text-green-600 dark:text-green-500'
  if (n === 1) return 'text-amber-600 dark:text-amber-400'
  if (n <= 3) return 'text-orange-600 dark:text-orange-400'
  return 'text-red-600 dark:text-red-400'
}

function bordaDefeitos(abertos: number, resolvidos: number): string {
  if (abertos === 0) return '#374151'
  const pct = resolvidos / abertos
  if (pct >= 1) return '#16a34a'
  if (pct >= 0.5) return '#ca8a04'
  return '#dc2626'
}

function cardTextStyle(dias: number | null): string {
  if (!dias) return 'text-slate-500 dark:text-slate-400'
  if (dias <= 15) return 'text-emerald-600 dark:text-emerald-400'
  if (dias <= 30) return 'text-orange-600 dark:text-orange-400'
  return 'text-red-600 dark:text-red-400'
}

function tooltipPosition(x: number, y: number) {
  if (typeof window === 'undefined') return { left: x + 14, top: y - 10 }
  return {
    left: Math.max(8, Math.min(x + 14, window.innerWidth - TOOLTIP_W)),
    top: Math.max(8, Math.min(y - 10, window.innerHeight - TOOLTIP_H)),
  }
}

const LEGENDA_CORES = [
  { className: 'bg-emerald-600 dark:bg-emerald-700', label: '≤15d', desc: 'Verde' },
  { className: 'bg-orange-500 dark:bg-orange-600', label: '16–30d', desc: 'Laranja' },
  { className: 'bg-red-600 dark:bg-red-700', label: '≥31d', desc: 'Vermelho' },
  { className: 'bg-slate-600 dark:bg-slate-700', label: 'Sem dados', desc: '' },
] as const

// ── Gráfico de barras + linha de dias médios ────────────────────────────────
type BarChartDatum = {
  periodo: string
  chave: string
  resolvidos: number
  pendentes: number
  abertos: number
  diasMedios: number | null
}

function BarLineChart({ data, agregacao }: { data: BarChartDatum[]; agregacao: 'semana' | 'mes' }) {
  const [hov, setHov] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [svgW, setSvgW] = useState(800)

  useEffect(() => {
    if (!svgRef.current) return
    const ro = new ResizeObserver(() => setSvgW(svgRef.current?.clientWidth ?? 800))
    ro.observe(svgRef.current)
    setSvgW(svgRef.current.clientWidth)
    return () => ro.disconnect()
  }, [])

  if (data.length === 0) return null

  const H = 200
  const padTop = 24
  const padBot = 48
  const padLeft = 44
  const padRight = 16
  const chartW = svgW - padLeft - padRight
  const chartH = H - padTop - padBot

  const maxBars = Math.max(...data.map((d) => d.resolvidos + d.pendentes), 1)
  const maxDias = Math.max(...data.map((d) => d.diasMedios ?? 0), 1)

  const barW = Math.max(4, Math.floor(chartW / data.length) - 4)
  const barCx = (i: number) => padLeft + (i + 0.5) * (chartW / data.length)

  const yBar = (v: number) => padTop + chartH - (v / maxBars) * chartH
  const yLine = (v: number) => padTop + chartH - (v / maxDias) * chartH

  const linePoints = data
    .map((d, i) => d.diasMedios != null ? `${barCx(i).toFixed(1)},${yLine(d.diasMedios).toFixed(1)}` : null)
    .filter(Boolean) as string[]

  // grid horizontais
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    y: padTop + chartH * (1 - t),
    val: Math.round(maxBars * t),
  }))

  const labelEvery = data.length > 20 ? Math.ceil(data.length / 10) : data.length > 10 ? 2 : 1

  return (
    <div className="relative w-full select-none">
      <svg ref={svgRef} width="100%" height={H} viewBox={`0 0 ${svgW} ${H}`} className="overflow-visible">
        {/* grid */}
        {gridLines.map(({ y, val }) => (
          <g key={y}>
            <line x1={padLeft} y1={y} x2={svgW - padRight} y2={y} stroke="currentColor" strokeOpacity="0.07" strokeWidth="1" className="text-slate-900 dark:text-white" />
            <text x={padLeft - 6} y={y + 4} textAnchor="end" fontSize="10" fill="currentColor" fillOpacity="0.35" className="text-slate-900 dark:text-white">{val}</text>
          </g>
        ))}

        {/* barras */}
        {data.map((d, i) => {
          const cx = barCx(i)
          const half = barW / 2
          const rTot = d.resolvidos + d.pendentes
          const hResolv = rTot > 0 ? (d.resolvidos / maxBars) * chartH : 0
          const hPend = rTot > 0 ? (d.pendentes / maxBars) * chartH : 0
          const isHov = hov === i
          return (
            <g key={d.chave} onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}>
              {/* pendentes (base) */}
              {hPend > 0 && (
                <rect
                  x={cx - half} y={yBar(rTot)} width={barW} height={hPend}
                  rx="2" fill="#dc2626" opacity={isHov ? 0.95 : 0.65}
                />
              )}
              {/* resolvidos (topo) */}
              {hResolv > 0 && (
                <rect
                  x={cx - half} y={yBar(d.resolvidos)} width={barW} height={hResolv}
                  rx="2" fill="#16a34a" opacity={isHov ? 1 : 0.8}
                />
              )}
              {/* label topo */}
              {isHov && rTot > 0 && (
                <text x={cx} y={yBar(rTot) - 4} textAnchor="middle" fontSize="10" fontWeight="800" fill="#94a3b8">{rTot}</text>
              )}
              {/* label eixo X */}
              {i % labelEvery === 0 && (
                <text
                  x={cx} y={H - 4}
                  textAnchor="middle" fontSize="9" fill="currentColor" fillOpacity="0.4"
                  className="text-slate-900 dark:text-white"
                >
                  {d.periodo.split(' ')[0]}
                </text>
              )}
            </g>
          )
        })}

        {/* linha dias médios */}
        {linePoints.length >= 2 && (
          <polyline
            points={linePoints.join(' ')}
            fill="none"
            stroke="#f59e0b"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity="0.85"
          />
        )}
        {data.map((d, i) => {
          if (d.diasMedios == null) return null
          const cx = barCx(i)
          const cy = yLine(d.diasMedios)
          const isHov = hov === i
          return (
            <circle
              key={d.chave + 'dot'}
              cx={cx} cy={cy} r={isHov ? 5 : 3}
              fill={diasColor(d.diasMedios)}
              stroke="white" strokeWidth="1.5"
              onMouseEnter={() => setHov(i)}
              onMouseLeave={() => setHov(null)}
            />
          )
        })}

        {/* tooltip flutuante */}
        {hov != null && data[hov] && (() => {
          const d = data[hov]!
          const cx = barCx(hov)
          const bw = 130
          const bh = 80
          const tx = Math.min(cx - bw / 2, svgW - padRight - bw)
          const ty = padTop - 8 - bh
          return (
            <g pointerEvents="none">
              <rect x={tx} y={ty} width={bw} height={bh} rx="8" fill="rgb(15,23,42)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
              <text x={tx + bw / 2} y={ty + 15} textAnchor="middle" fontSize="10" fontWeight="800" fill="#e2e8f0">{d.periodo}</text>
              <text x={tx + 10} y={ty + 32} fontSize="10" fill="#4ade80" fontWeight="700">✓ {d.resolvidos} resolvidos</text>
              <text x={tx + 10} y={ty + 48} fontSize="10" fill="#f87171" fontWeight="700">⏳ {d.pendentes} pendentes</text>
              <text x={tx + 10} y={ty + 64} fontSize="10" fill="#fbbf24" fontWeight="700">
                {d.diasMedios != null ? `⊘ ${d.diasMedios}d médios` : '⊘ sem média'}
              </text>
            </g>
          )
        })()}
      </svg>

      {/* legenda */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 pt-1">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-emerald-600 opacity-80" />
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Resolvidos</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-red-600 opacity-65" />
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Pendentes</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-5 rounded-full bg-amber-400 opacity-85" />
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Dias médios (resolução)</span>
        </div>
        <span className="ml-auto text-[10px] font-semibold text-slate-400">
          {data.length} {agregacao === 'semana' ? 'semana(s)' : 'mês(es)'}
        </span>
      </div>
    </div>
  )
}

// ── Gráfico por tipo de defeito ────────────────────────────────────────────
type DefeitoDatum = {
  defeito: string
  ocorrencias: number
  prazoMedioDias: number
}

function buildDefeitoData(rows: Apontamento[]): DefeitoDatum[] {
  const map = new Map<string, { ocorrencias: number; somaDias: number }>()
  for (const r of rows) {
    if (!r.resolvido || !r.dataResolvido) continue
    const key = formatDefeitoParaExibicao(r.defeito?.trim() || '') || '(sem descrição)'
    if (!map.has(key)) map.set(key, { ocorrencias: 0, somaDias: 0 })
    const e = map.get(key)!
    e.ocorrencias++
    e.somaDias += diasEntreApontamentoEResolucao(r)
  }
  return [...map.entries()]
    .map(([defeito, e]) => ({
      defeito,
      ocorrencias: e.ocorrencias,
      prazoMedioDias: Math.max(0, Math.round(e.somaDias / e.ocorrencias)),
    }))
    .sort((a, b) => b.prazoMedioDias - a.prazoMedioDias)
    .slice(0, 20)
}

const DEFEITOS_TOP_OPTIONS = [
  { value: 5,  label: 'Top 5' },
  { value: 10, label: 'Top 10' },
  { value: 20, label: 'Top 20' },
] as const

function DefeitosChart({ rows }: { rows: Apontamento[] }) {
  const [topN, setTopN] = useState<5 | 10 | 20>(10)
  const [busca, setBusca] = useState('')

  const data = useMemo(() => {
    const q = busca.trim().toLowerCase()
    const filtered = rows.filter((r) => {
      if (!r.resolvido || !r.dataResolvido) return false
      if (q && !formatDefeitoParaExibicao(r.defeito).toLowerCase().includes(q)) return false
      return true
    })
    return buildDefeitoData(filtered)
  }, [rows, busca])

  const topRows = data.slice(0, topN)
  const maxPrazo = Math.max(1, ...topRows.map((d) => d.prazoMedioDias))

  if (topRows.length === 0) return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">Pesquisar defeito</div>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Digite parte do defeito..."
          className="mt-1 w-full bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-300 dark:text-slate-100"
        />
      </div>
      <div className="flex min-h-[120px] items-center justify-center text-sm font-semibold text-slate-400 dark:text-slate-500">
        Nenhum defeito corrigido encontrado com a pesquisa atual.
      </div>
    </div>
  )

  return (
    <div className="w-full space-y-4">

      {/* pesquisa na aba defeitos */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">Pesquisar defeito</div>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Digite parte do defeito..."
          className="mt-1 w-full bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-300 dark:text-slate-100"
        />
      </div>

      {/* cabeçalho com top-N */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          Exibindo defeitos corrigidos e o prazo médio de correção
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-900">
          {DEFEITOS_TOP_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => setTopN(o.value)}
              className={[
                'rounded-lg px-2.5 py-1 text-[10px] font-black transition',
                topN === o.value
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'text-slate-500 hover:bg-white dark:text-slate-400 dark:hover:bg-slate-800',
              ].join(' ')}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* tabela */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full min-w-[520px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-500">
              <th className="w-8 px-3 py-2.5 text-center">#</th>
              <th className="px-3 py-2.5">Defeito</th>
              <th className="min-w-[220px] px-3 py-2.5">Prazo de correção</th>
            </tr>
          </thead>
          <tbody>
            {topRows.map((d, i) => {
              return (
                <tr
                  key={d.defeito}
                  className={[
                    'group border-b transition-colors last:border-0',
                    i === 0 && d.prazoMedioDias > 30
                      ? 'border-red-100 bg-red-50/40 dark:border-red-950/30 dark:bg-red-950/10'
                      : 'border-slate-100 hover:bg-slate-50/80 dark:border-slate-800/60 dark:hover:bg-slate-800/30',
                  ].join(' ')}
                >
                  {/* rank */}
                  <td className="px-3 py-3 text-center align-middle">
                    <span className={[
                      'inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black',
                      i === 0 ? 'bg-red-500 text-white' :
                      i === 1 ? 'bg-orange-400 text-white' :
                      i === 2 ? 'bg-amber-400 text-slate-900' :
                      'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
                    ].join(' ')}>
                      {i + 1}
                    </span>
                  </td>

                  {/* defeito */}
                  <td className="px-3 py-3 align-middle">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                      {d.defeito}
                    </span>
                  </td>
                  <td className="px-3 py-3 align-middle">
                    <div className="flex items-center gap-2">
                      <div className="h-2 min-w-[120px] flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                        <div
                          className={[
                            'h-full rounded-full transition-all duration-500',
                            d.prazoMedioDias <= 15 ? 'bg-emerald-500' : d.prazoMedioDias <= 30 ? 'bg-amber-400' : 'bg-red-500',
                          ].join(' ')}
                          style={{ width: `${Math.max(6, Math.round((d.prazoMedioDias / maxPrazo) * 100))}%` }}
                        />
                      </div>
                      <div className="min-w-[74px] text-right">
                        <span className="text-xs font-black tabular-nums text-slate-700 dark:text-slate-200">
                          {d.prazoMedioDias} dias
                        </span>
                        <span className="ml-1 text-[10px] font-semibold text-slate-400">
                          ({d.ocorrencias})
                        </span>
                      </div>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="text-right text-[10px] font-semibold text-slate-400">
        Ordenado por maior prazo médio de correção · {data.length} tipos encontrados
      </p>
    </div>
  )
}

// ── Gauge de taxa de resolução ──────────────────────────────────────────────
function TaxaGauge({ resolvidos, total }: { resolvidos: number; total: number }) {
  const pct = total > 0 ? Math.round((resolvidos / total) * 100) : 0
  const R = 36, cx = 44, cy = 44
  const circ = 2 * Math.PI * R
  const filled = (pct / 100) * circ
  const color = pct >= 70 ? '#16a34a' : pct >= 40 ? '#f97316' : '#dc2626'

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={88} height={88} viewBox="0 0 88 88">
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="currentColor" strokeOpacity="0.1" strokeWidth="8" className="text-slate-900 dark:text-white" />
        <circle
          cx={cx} cy={cy} r={R} fill="none"
          stroke={color} strokeWidth="8"
          strokeDasharray={`${filled.toFixed(1)} ${circ.toFixed(1)}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
        <text x={cx} y={cy + 5} textAnchor="middle" fontSize="16" fontWeight="900" fill={color}>{pct}%</text>
      </svg>
      <span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">Taxa resolução</span>
    </div>
  )
}

export function EvolucaoPage() {
  const { rows } = useApontamentos()
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [wrapW, setWrapW] = useState(0)
  const [agregacao, setAgregacao] = useState<'semana' | 'mes'>('semana')
  const [tooltipCell, setTooltipCell] = useState<{ point: PontoEvolucao; x: number; y: number } | null>(null)
  const [tooltipLine2, setTooltipLine2] = useState<{
    chave: string; periodo: string; abertos: number; resolvidos: number; pendentes: number; x: number; y: number
  } | null>(null)

  const [visao, setVisao] = useState<'grafico' | 'heatmap' | 'defeitos'>('grafico')
  const [filtrosVisiveis, setFiltrosVisiveis] = useState(() => {
    try { return localStorage.getItem('frota.filtros.evolucao') === 'true' }
    catch { return false }
  })
  const [filtroBase, setFiltroBase] = useState('todos')
  const [filtroCoord, setFiltroCoord] = useState('todos')
  const [filtroResp, setFiltroResp] = useState('todos')
  const [filtroPrefixo, setFiltroPrefixo] = useState('todos')
  const [filtroData, setFiltroData] = useState<EvolucaoFiltros['data']>('todos')

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setWrapW(el.clientWidth))
    ro.observe(el)
    setWrapW(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  const optResp = useMemo(() => {
    const opts = uniqSorted(rows.map((r) => r.responsavel))
    return [{ value: 'todos', label: 'Todos' }, ...opts]
  }, [rows])

  const optPrefixo = useMemo(() => {
    const opts = uniqSorted(rows.map((r) => r.prefixo))
    return [{ value: 'todos', label: 'Todos' }, ...opts]
  }, [rows])

  const filtrosObj = useMemo<EvolucaoFiltros>(
    () => ({ base: filtroBase, coordenador: filtroCoord, responsavel: filtroResp, prefixo: filtroPrefixo, data: filtroData }),
    [filtroBase, filtroCoord, filtroResp, filtroPrefixo, filtroData],
  )

  const resolvidosFiltrados = useMemo(() => filterResolvidosParaEvolucao(rows, filtrosObj), [rows, filtrosObj])

  const boundaryRange = useMemo(() => {
    const now = new Date()
    const p2 = (n: number) => String(n).padStart(2, '0')
    const toIso = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
    const todayIso = toIso(now)
    if (filtroData === 'todos') return undefined
    return filtroData === 'ano'
      ? { from: `${now.getFullYear()}-01-01`, to: todayIso }
      : { from: toIso(new Date(now.getTime() - Number(filtroData) * 86_400_000)), to: todayIso }
  }, [filtroData])

  const chartData = useMemo(() => {
    return agregacao === 'semana'
      ? buildWeeklyChartPoints(resolvidosFiltrados, boundaryRange)
      : buildMonthlyChartPoints(resolvidosFiltrados, boundaryRange)
  }, [resolvidosFiltrados, agregacao, boundaryRange])

  const mediaGeralDias = useMemo(() => mediaDiasApontamentoResolucao(resolvidosFiltrados), [resolvidosFiltrados])

  const heatmapStats = useMemo(() => {
    const totalResolvido = chartData.reduce((s, p) => s + p.resolvidos, 0)
    const comDados = chartData.filter((p): p is PontoEvolucao & { diasMedios: number } => p.diasMedios != null && p.resolvidos > 0)
    if (!comDados.length) return { totalResolvido, semanaRapida: null, semanaLenta: null }
    const semanaRapida = comDados.reduce((best, p) => (p.diasMedios < best.diasMedios ? p : best))
    const semanaLenta = comDados.reduce((worst, p) => (p.diasMedios > worst.diasMedios ? p : worst))
    return { totalResolvido, semanaRapida, semanaLenta }
  }, [chartData])

  const maiorGapEntreResolucoes = useMemo(() => {
    const datas = [...new Set(resolvidosFiltrados.map((r) => r.dataResolvido).filter((d): d is string => Boolean(d)))].sort()
    if (datas.length < 2) return { semanas: 0 as number, dataAnterior: null as string | null, dataPosterior: null as string | null }
    const msSemana = 7 * 86_400_000
    let maxSemanas = 0, dataAnterior: string | null = null, dataPosterior: string | null = null
    for (let i = 1; i < datas.length; i++) {
      const semanas = Math.round((parseIsoDate(datas[i]!) - parseIsoDate(datas[i - 1]!)) / msSemana)
      if (semanas > maxSemanas) { maxSemanas = semanas; dataAnterior = datas[i - 1]!; dataPosterior = datas[i]! }
    }
    return { semanas: maxSemanas, dataAnterior, dataPosterior }
  }, [resolvidosFiltrados])

  const linha2Data = useMemo(() => {
    const keyFn = (iso: string) => agregacao === 'semana' ? mondayKeyFromDateIso(iso) : iso.slice(0, 7)
    const filtered = rows.filter((r) => {
      if (filtroBase !== 'todos' && !matchesBaseFilter(r.base, filtroBase)) return false
      if (filtroCoord !== 'todos' && !matchesCoordenadorFilter(r.coordenador, filtroCoord)) return false
      if (filtroResp !== 'todos' && r.responsavel !== filtroResp) return false
      if (filtroPrefixo !== 'todos' && r.prefixo !== filtroPrefixo) return false
      if (boundaryRange) {
        if (r.dataApontamento < boundaryRange.from) return false
        if (r.dataApontamento > boundaryRange.to) return false
      }
      return true
    })
    const map = new Map<string, { abertos: number; resolvidos: number; pendentes: number }>()
    for (const r of filtered) {
      const k = keyFn(r.dataApontamento)
      if (!map.has(k)) map.set(k, { abertos: 0, resolvidos: 0, pendentes: 0 })
      const entry = map.get(k)!
      entry.abertos++
      if (r.resolvido) entry.resolvidos++
      else entry.pendentes++
    }
    return chartData.map((p) => {
      const d = map.get(p.chave) ?? { abertos: 0, resolvidos: 0, pendentes: 0 }
      return { chave: p.chave, periodo: p.periodo, ...d }
    })
  }, [rows, filtroBase, filtroCoord, filtroResp, filtroPrefixo, agregacao, chartData, boundaryRange])

  // KPIs globais: total de defeitos no recorte (resolvidos + pendentes)
  const totalDefeitos = useMemo(() => {
    return rows.filter((r) => {
      if (filtroBase !== 'todos' && !matchesBaseFilter(r.base, filtroBase)) return false
      if (filtroCoord !== 'todos' && !matchesCoordenadorFilter(r.coordenador, filtroCoord)) return false
      if (filtroResp !== 'todos' && r.responsavel !== filtroResp) return false
      if (filtroPrefixo !== 'todos' && r.prefixo !== filtroPrefixo) return false
      return true
    }).length
  }, [rows, filtroBase, filtroCoord, filtroResp, filtroPrefixo])

  const totalPendentes = totalDefeitos - resolvidosFiltrados.length

  // Tendência: compara últimos 2 períodos com dados
  const tendencia = useMemo(() => {
    const comDados = chartData.filter((p) => p.resolvidos > 0)
    if (comDados.length < 2) return null
    const ult = comDados[comDados.length - 1]!
    const pen = comDados[comDados.length - 2]!
    if (ult.diasMedios == null || pen.diasMedios == null) return null
    const delta = ult.diasMedios - pen.diasMedios
    return { delta: Math.round(Math.abs(delta) * 10) / 10, melhorou: delta < 0, igual: delta === 0 }
  }, [chartData])

  const barChartData: BarChartDatum[] = useMemo(() => {
    return chartData.map((p, i) => ({
      periodo: p.periodo,
      chave: p.chave,
      resolvidos: p.resolvidos,
      pendentes: linha2Data[i]?.pendentes ?? 0,
      abertos: linha2Data[i]?.abertos ?? 0,
      diasMedios: p.diasMedios,
    }))
  }, [chartData, linha2Data])

  const defeitosRows = useMemo(() => {
    const filtered = rows.filter((r) => {
      if (filtroCoord !== 'todos' && !matchesCoordenadorFilter(r.coordenador, filtroCoord)) return false
      if (filtroResp !== 'todos' && r.responsavel !== filtroResp) return false
      if (filtroPrefixo !== 'todos' && r.prefixo !== filtroPrefixo) return false
      return true
    })
    return filtered
  }, [rows, filtroCoord, filtroResp, filtroPrefixo])

  const limparFiltros = () => {
    setFiltroBase('todos'); setFiltroCoord('todos')
    setFiltroResp('todos'); setFiltroPrefixo('todos'); setFiltroData('todos')
  }

  const filtrosAtivos = filtroBase !== 'todos' || filtroCoord !== 'todos' ||
    filtroResp !== 'todos' || filtroPrefixo !== 'todos' || filtroData !== 'todos'

  const isMobile = wrapW > 0 && wrapW < 640
  const cellSize = isMobile ? 60 : 80

  const exportarCsv = () => {
    const csv = buildResolvidosCsv(resolvidosFiltrados)
    const now = new Date()
    const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
    downloadCsv(`frota-evolucao-resolvidos-${stamp}.csv`, csv)
  }

  return (
    <div className="space-y-5">

      {/* ── Cabeçalho ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Link
            to="/gerenciar"
            className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
            aria-label="Voltar para Gerenciar"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-900 text-white shadow-soft dark:bg-slate-100 dark:text-slate-900">
              <TrendingUp size={18} />
            </div>
            <div>
              <div className="text-xl font-black tracking-tight text-slate-900 dark:text-slate-100">Evolução</div>
              <div className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                Ritmo de tratamento de defeitos — resolvidos vs pendentes, velocidade e tendência
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportarCsv}
            disabled={resolvidosFiltrados.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-900 shadow-soft hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900"
          >
            <Download size={18} aria-hidden />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* ── Filtros ── */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-soft dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Filtros</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={limparFiltros}
              disabled={!filtrosAtivos}
              className={['inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-extrabold transition',
                filtrosAtivos ? 'text-brand-700 hover:bg-slate-100 dark:text-brand-400 dark:hover:bg-slate-800' : 'cursor-not-allowed text-slate-400 dark:text-slate-600',
              ].join(' ')}
            >
              <RotateCcw size={14} />
              Limpar filtros
            </button>
            <button
              type="button"
              onClick={() => setFiltrosVisiveis((v) => {
                const next = !v
                try { localStorage.setItem('frota.filtros.evolucao', String(next)) } catch { /* ignore */ }
                return next
              })}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200/80 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-700 transition hover:bg-slate-100/60 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-600/60 dark:text-slate-200 dark:hover:bg-white/5"
            >
              {filtrosVisiveis ? <><ChevronUp size={13} className="text-slate-400" /> Ocultar filtros</> : <><ChevronDown size={13} className="text-slate-400" /> Mostrar filtros</>}
            </button>
          </div>
        </div>
        <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${filtrosVisiveis ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
          <div className="overflow-hidden">
            <div className="grid grid-cols-1 gap-3 border-t border-slate-100 px-4 pb-4 pt-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 dark:border-slate-800">
              <Select label="Base" value={filtroBase} options={BASE_FILTER_SELECT_OPTIONS} onChange={setFiltroBase} />
              <Select label="Coordenador" value={filtroCoord} options={COORDENADOR_FILTER_SELECT_OPTIONS} onChange={setFiltroCoord} />
              <Select label="Responsável" value={filtroResp} options={optResp} onChange={setFiltroResp} />
              <Select label="Prefixo" value={filtroPrefixo} options={optPrefixo} onChange={setFiltroPrefixo} />
              <Select label="Data" value={filtroData} options={DATA_OPTS} onChange={(v) => setFiltroData(v as EvolucaoFiltros['data'])} />
            </div>
          </div>
        </div>
      </div>

      {/* ── KPIs principais ── */}
      <div data-tour="evolucao-kpis" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">

        {/* Resolvidos */}
        <div className="flex flex-col gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-soft dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 size={13} />
            Resolvidos
          </div>
          <div className="text-3xl font-black text-emerald-700 dark:text-emerald-300">{resolvidosFiltrados.length}</div>
          <div className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-500">defeitos fechados no recorte</div>
        </div>

        {/* Pendentes */}
        <div className="flex flex-col gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-soft dark:border-rose-900/40 dark:bg-rose-950/20">
          <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-rose-700 dark:text-rose-400">
            <AlertTriangle size={13} />
            Pendentes
          </div>
          <div className="text-3xl font-black text-rose-700 dark:text-rose-300">{totalPendentes}</div>
          <div className="text-[10px] font-semibold text-rose-600 dark:text-rose-500">ainda em aberto</div>
        </div>

        {/* Dias médios */}
        <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <Clock size={13} />
            Dias médios
          </div>
          <div className={`text-3xl font-black ${cardTextStyle(mediaGeralDias)}`}>
            {mediaGeralDias != null ? `${mediaGeralDias}d` : '—'}
          </div>
          <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">apontamento → resolução</div>
        </div>

        {/* Tendência */}
        <div className={`flex flex-col gap-2 rounded-2xl border p-4 shadow-soft ${
          tendencia == null ? 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950'
          : tendencia.melhorou ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20'
          : tendencia.igual ? 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950'
          : 'border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20'
        }`}>
          <div className={`flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider ${
            tendencia?.melhorou ? 'text-emerald-700 dark:text-emerald-400'
            : tendencia && !tendencia.igual ? 'text-amber-700 dark:text-amber-400'
            : 'text-slate-500 dark:text-slate-400'
          }`}>
            {tendencia?.melhorou ? <TrendingDown size={13} /> : <TrendingUp size={13} />}
            Tendência
          </div>
          <div className={`text-2xl font-black ${
            tendencia?.melhorou ? 'text-emerald-700 dark:text-emerald-300'
            : tendencia && !tendencia.igual ? 'text-amber-700 dark:text-amber-300'
            : 'text-slate-500 dark:text-slate-400'
          }`}>
            {tendencia == null ? '—'
              : tendencia.igual ? 'Estável'
              : tendencia.melhorou ? `−${tendencia.delta}d`
              : `+${tendencia.delta}d`}
          </div>
          <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
            {tendencia?.melhorou ? 'Melhorou — mais rápido' : tendencia && !tendencia.igual ? 'Piorou — mais lento' : 'vs. período anterior'}
          </div>
        </div>

        {/* Gauge taxa */}
        <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-950">
          <TaxaGauge resolvidos={resolvidosFiltrados.length} total={totalDefeitos} />
        </div>
      </div>

      {/* ── Painel principal com toggle de visão ── */}
      <div data-tour="evolucao-chart" className="rounded-2xl border border-slate-200 bg-white shadow-soft dark:border-slate-800 dark:bg-slate-950">

        {/* Cabeçalho com toggles */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setVisao('grafico')}
                className={['rounded-lg px-3 py-1.5 text-xs font-extrabold transition',
                  visao === 'grafico' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800',
                ].join(' ')}
              >
                Gráfico
              </button>
              <button
                type="button"
                onClick={() => setVisao('heatmap')}
                className={['rounded-lg px-3 py-1.5 text-xs font-extrabold transition',
                  visao === 'heatmap' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800',
                ].join(' ')}
              >
                Heatmap
              </button>
              <button
                type="button"
                onClick={() => setVisao('defeitos')}
                className={['rounded-lg px-3 py-1.5 text-xs font-extrabold transition',
                  visao === 'defeitos' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800',
                ].join(' ')}
              >
                Defeitos
              </button>
            </div>
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
              {visao === 'grafico'
                ? 'Resolvidos vs pendentes · linha = dias médios'
                : visao === 'defeitos'
                ? 'Defeito e prazo de correção · com pesquisa'
                : 'Velocidade por período · cores = performance'}
            </span>
          </div>
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-900/60">
            {(['semana', 'mes'] as const).map((op) => (
              <button
                key={op}
                type="button"
                onClick={() => setAgregacao(op)}
                className={['rounded-lg px-3 py-1.5 text-xs font-extrabold transition',
                  agregacao === op ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800',
                ].join(' ')}
                aria-pressed={agregacao === op}
              >
                {op === 'semana' ? 'Semana' : 'Mês'}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5">
          {chartData.length === 0 ? (
            <div className="flex min-h-[160px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center text-sm font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
              Nenhum defeito resolvido com os filtros atuais.{' '}
              <Link to="/gerenciar" className="mt-1 font-extrabold text-brand-600 underline dark:text-brand-400">Gerenciar →</Link>
            </div>
          ) : visao === 'defeitos' ? (
            <DefeitosChart rows={defeitosRows} />
          ) : visao === 'grafico' ? (
            <BarLineChart data={barChartData} agregacao={agregacao} />
          ) : (
            <>{/* ── Heatmap ── */}
          <div className="mb-4 text-sm font-black text-slate-900 dark:text-slate-100">Velocidade de resolução — detalhe por {agregacao === 'semana' ? 'semana' : 'mês'}</div>

          {/* Mini KPIs de velocidade */}
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                <Zap size={11} /> Mais rápido
              </div>
              <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                {heatmapStats.semanaRapida ? `${heatmapStats.semanaRapida.diasMedios}d` : '—'}
              </div>
              {heatmapStats.semanaRapida && <div className="text-[9px] font-semibold text-slate-400 truncate">{heatmapStats.semanaRapida.periodo}</div>}
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                <TrendingDown size={11} /> Mais lento
              </div>
              <div className={`text-xl font-black ${cardTextStyle(heatmapStats.semanaLenta?.diasMedios ?? null)}`}>
                {heatmapStats.semanaLenta ? `${heatmapStats.semanaLenta.diasMedios}d` : '—'}
              </div>
              {heatmapStats.semanaLenta && <div className="text-[9px] font-semibold text-slate-400 truncate">{heatmapStats.semanaLenta.periodo}</div>}
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                <AlertTriangle size={11} /> Maior gap
              </div>
              <div className={`text-xl font-black ${gapColor(maiorGapEntreResolucoes.semanas)}`}>
                {resolvidosFiltrados.length < 2 ? '—' : `${maiorGapEntreResolucoes.semanas}sem`}
              </div>
              {maiorGapEntreResolucoes.dataAnterior && (
                <div className="text-[9px] font-semibold text-slate-400 truncate">{maiorGapEntreResolucoes.dataAnterior} → {maiorGapEntreResolucoes.dataPosterior}</div>
              )}
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                <CheckCircle2 size={11} /> Total período
              </div>
              <div className="text-xl font-black text-slate-900 dark:text-slate-100">{heatmapStats.totalResolvido}</div>
              <div className="text-[9px] font-semibold text-slate-400">defeitos resolvidos</div>
            </div>
          </div>

          {/* Heatmap */}
          <div ref={wrapRef} className="min-w-0">
            <div className="overflow-x-auto pb-2">
              <div className="inline-flex flex-col gap-3 px-1 pt-2" style={{ minWidth: '100%' }}>

                {/* Linha 1: Velocidade */}
                <div className="flex items-end gap-2">
                  <div style={{ width: 54, flexShrink: 0, height: cellSize }} className="flex flex-col items-center justify-center gap-0.5">
                    <span className="text-sm leading-none">⏱</span>
                    <span className="text-[7px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">Veloc.</span>
                  </div>
                  <div className="flex gap-2 pb-1">
                    {chartData.map((p) => {
                      const cls = classifyCelula(p.diasMedios)
                      return (
                        <div key={p.chave} className="flex flex-shrink-0 flex-col items-center gap-1.5">
                          <div
                            style={{ width: cellSize, height: cellSize }}
                            className={['relative cursor-pointer rounded-xl transition-opacity hover:opacity-90', cls.cellClass].join(' ')}
                            onMouseEnter={(e) => setTooltipCell({ point: p, x: e.clientX, y: e.clientY })}
                            onMouseLeave={() => setTooltipCell(null)}
                            onMouseMove={(e) => setTooltipCell((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : null))}
                          >
                            <span className="absolute right-1.5 top-1.5 flex min-w-[18px] items-center justify-center rounded-full bg-black/30 px-1 text-[9px] font-extrabold text-white">
                              {p.resolvidos}
                            </span>
                            <div className={`flex h-full items-center justify-center text-sm font-black ${cls.textClass}`}>
                              {p.diasMedios != null ? `${p.diasMedios}d` : '—'}
                            </div>
                          </div>
                          <div className="text-center font-semibold leading-tight text-slate-500 dark:text-slate-400" style={{ fontSize: isMobile ? 8 : 9, maxWidth: cellSize }}>
                            {p.periodo}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Linha 2: Defeitos abertos vs resolvidos */}
                <div className="flex items-center gap-2 pb-1">
                  <div style={{ width: 54, flexShrink: 0, height: cellSize }} className="flex flex-col items-center justify-center gap-0.5">
                    <span className="text-sm leading-none">📋</span>
                    <span className="text-[7px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">Def.</span>
                  </div>
                  <div className="flex gap-2">
                    {linha2Data.map((d) => (
                      <div key={d.chave} className="flex flex-shrink-0 flex-col items-center">
                        <div
                          style={{ width: cellSize, height: cellSize, backgroundColor: '#1e293b', border: `2px solid ${bordaDefeitos(d.abertos, d.resolvidos)}` }}
                          className="flex cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl transition-opacity hover:opacity-90"
                          onMouseEnter={(e) => setTooltipLine2({ ...d, x: e.clientX, y: e.clientY })}
                          onMouseLeave={() => setTooltipLine2(null)}
                          onMouseMove={(e) => setTooltipLine2((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : null))}
                        >
                          <span className="text-base font-black leading-none text-white">{d.abertos > 0 ? d.abertos : '—'}</span>
                          {d.resolvidos > 0 && <span className="text-[9px] font-extrabold leading-none text-emerald-400">{d.resolvidos} resol.</span>}
                          {d.pendentes > 0 && <span className="text-[9px] font-extrabold leading-none text-red-400">{d.pendentes} pend.</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Legenda heatmap */}
            <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
              <div className="mb-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">Legenda — dias médios</div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Rápido →</span>
                {LEGENDA_CORES.map((l) => (
                  <div key={l.label} className="flex items-center gap-1">
                    <span className={['inline-block h-4 w-4 rounded', l.className].join(' ')} />
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">{l.label}{l.desc ? ` ${l.desc}` : ''}</span>
                  </div>
                ))}
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">← Lento</span>
              </div>
              {mediaGeralDias != null && (
                <div className="mt-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Referência: <span className="font-extrabold text-slate-700 dark:text-slate-200">{mediaGeralDias} dias</span>
                </div>
              )}
            </div>
          </div>
            </>
          )}
        </div>
      </div>

      {/* Tooltips */}
      {tooltipCell && (
        <div style={{ position: 'fixed', ...tooltipPosition(tooltipCell.x, tooltipCell.y), zIndex: 9999, pointerEvents: 'none' }}
          className="max-w-[220px] rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <div className="font-black text-slate-900 dark:text-slate-100">{tooltipCell.point.periodo}</div>
          <div className="mt-2 space-y-1 font-semibold text-slate-600 dark:text-slate-300">
            <div className="flex justify-between gap-4"><span>Resolvidos</span><span className="font-black text-emerald-600 dark:text-emerald-400">{tooltipCell.point.resolvidos}</span></div>
            <div className="flex justify-between gap-4"><span>Dias médios</span><span className="font-black text-sky-600 dark:text-sky-400">{tooltipCell.point.diasMedios != null ? `${tooltipCell.point.diasMedios} d` : '—'}</span></div>
            <div className="flex justify-between gap-4"><span>Classificação</span><span className="font-extrabold">{classifyCelula(tooltipCell.point.diasMedios).label}</span></div>
            {tooltipCell.point.exemplos.length > 0 && (
              <div className="mt-2 border-t border-slate-100 pt-2 dark:border-slate-800">
                <div className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">Exemplos</div>
                <ul className="mt-1 list-inside list-disc text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                  {tooltipCell.point.exemplos.slice(0, TOOLTIP_EXEMPLOS_MAX).map((t, idx) => <li key={idx} className="truncate">{t}</li>)}
                </ul>
                {tooltipCell.point.exemplos.length > TOOLTIP_EXEMPLOS_MAX && (
                  <p className="mt-1.5 text-[10px] font-semibold text-slate-500">+{tooltipCell.point.exemplos.length - TOOLTIP_EXEMPLOS_MAX} itens não listados</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {tooltipLine2 && (
        <div style={{ position: 'fixed', ...tooltipPosition(tooltipLine2.x, tooltipLine2.y), zIndex: 9999, pointerEvents: 'none' }}
          className="max-w-[220px] rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <div className="font-black text-slate-900 dark:text-slate-100">{tooltipLine2.periodo}</div>
          <div className="mt-2 space-y-1 font-semibold text-slate-600 dark:text-slate-300">
            <div className="flex justify-between gap-4"><span>Defeitos abertos</span><span className="font-black text-slate-800 dark:text-slate-100">{tooltipLine2.abertos}</span></div>
            <div className="flex justify-between gap-4"><span>Resolvidos</span><span className="font-black text-emerald-600 dark:text-emerald-400">{tooltipLine2.resolvidos}{tooltipLine2.abertos > 0 ? ` (${Math.round((tooltipLine2.resolvidos / tooltipLine2.abertos) * 100)}%)` : ''}</span></div>
            <div className="flex justify-between gap-4"><span>Pendentes</span><span className="font-black text-red-500 dark:text-red-400">{tooltipLine2.pendentes}</span></div>
          </div>
        </div>
      )}
    </div>
  )
}
