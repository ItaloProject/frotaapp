import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  AlertCircle,
  AlertTriangle,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  ExternalLink,
  History,
  Inbox,
  Loader2,
  TrendingUp,
  RotateCcw,
  Upload,
  Search,
  Settings2,
  Truck,
  X,
  ZoomIn,
  MessageSquareWarning,
  Image as ImageIcon,
} from 'lucide-react'
import type { Apontamento } from '../apontamentos/ApontamentosContext'
import { useApontamentos } from '../apontamentos/ApontamentosContext'
import { formatDefeitoParaExibicao } from '../apontamentos/defeitoExibicao'
import {
  buildManageTableRows,
  findRecorrenteSiblingIds,
  type ApontamentoGroup,
} from '../apontamentos/groupApontamentos'
import { useAuth } from '../auth/AuthContext'
import { BASE_FILTER_SELECT_OPTIONS, matchesBaseFilter } from '../data/baseFilterOptions'
import { COORDENADOR_FILTER_SELECT_OPTIONS, matchesCoordenadorFilter } from '../data/coordenadorFilterOptions'
import { SUPERVISOR_FILTER_SELECT_OPTIONS, matchesSupervisorFilter } from '../data/supervisorFilterOptions'
import { Select, type SelectOption } from '../components/ui/Select'
import { Portal } from '../components/ui/Portal'
import {
  apontamentoMatchesVehicleFilter,
  normalizePlaca,
  placaFromApontamentoVeiculoId,
} from '../frota/vehicleRegistry'

function formatDateBR(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function isApontamentoHoje(dataApontamento: string, nowMs: number) {
  const d = new Date(nowMs)
  const hoje = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return dataApontamento.slice(0, 10) === hoje
}

/** Defeito novo do dia: apontado hoje e ainda não resolvido. */
function isDefeitoEntrante(r: Apontamento, nowMs: number) {
  if (r.resolvido) return false
  return isApontamentoHoje(r.dataApontamento, nowMs)
}

function formatCurrency(digits: string): string {
  const cents = parseInt(digits, 10)
  if (!Number.isFinite(cents)) return ''
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

function parseCurrency(masked: string): number | null {
  const raw = masked.replace(/\./g, '').replace(',', '.')
  const n = parseFloat(raw)
  return Number.isFinite(n) ? n : null
}

function DefeitoSeveridadeIcon({ imperativo, size = 14 }: { imperativo: boolean; size?: number }) {
  if (imperativo) {
    return (
      <span
        title="Impeditivo — impede condução do veículo"
        className="inline-flex shrink-0 leading-none select-none"
        style={{ fontSize: size }}
        aria-hidden
      >
        🚫
      </span>
    )
  }
  return (
    <span title="Não impeditivo — precisa de atenção" className="inline-flex shrink-0">
      <AlertCircle size={size} className="text-amber-600 dark:text-amber-400" aria-hidden />
    </span>
  )
}



const PAGE_SIZE_OPTIONS: SelectOption[] = [
  { value: '25', label: '25 por página' },
  { value: '50', label: '50 por página' },
  { value: '100', label: '100 por página' },
]

function StatPill({
  label,
  value,
  icon,
  tone,
  selected = false,
  onClick,
}: {
  label: string
  value: string
  icon: React.ReactNode
  tone: 'slate' | 'emerald' | 'rose' | 'sky'
  selected?: boolean
  onClick?: () => void
}) {
  const toneClass =
    tone === 'emerald'
      ? 'border-emerald-200/80 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100'
      : tone === 'rose'
        ? 'border-rose-200/80 bg-rose-50 text-rose-950 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-100'
        : tone === 'sky'
          ? 'border-sky-200/80 bg-sky-50 text-sky-950 dark:border-sky-900/45 dark:bg-sky-950/35 dark:text-sky-100'
          : 'border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-100'

  const Tag = onClick ? 'button' : 'div'

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={[
        'flex flex-col items-center gap-2 rounded-2xl border px-4 py-3 text-center shadow-soft',
        onClick ? 'transition hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0' : '',
        selected ? 'ring-2 ring-brand-500/60' : 'ring-0',
        toneClass,
      ].join(' ')}
    >
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/80 text-current shadow-sm dark:bg-slate-950/50">
        {icon}
      </span>
      <div>
        <div className="text-xs font-extrabold uppercase tracking-wide opacity-80">{label}</div>
        <div className="text-lg font-black tracking-tight">{value}</div>
      </div>
    </Tag>
  )
}

export function ManagePage() {
  const { rows, carregando, marcarResolvido, marcarJustificado, checklistsRealizadosTotal } = useApontamentos()
  const { user } = useAuth()
  const canMarkResolved = user?.role === 'admin' || user?.role === 'super_admin'
  const [searchParams, setSearchParams] = useSearchParams()

  const [visao, setVisao] = useState<'apontamentos' | 'pendentes' | 'resolvidos' | 'entrantes'>('apontamentos')
  const [severidade, setSeveridade] = useState<'todos' | 'imperativo' | 'atencao'>('todos')
  const [vehicleId, setVehicleId] = useState(() => searchParams.get('veiculo') ?? 'todos')
  const [filtrosVisiveis, setFiltrosVisiveis] = useState(() => {
    if (searchParams.get('veiculo')) return true
    try { return localStorage.getItem('frota.filtros.manage') === 'true' }
    catch { return false }
  })
  const [query, setQuery] = useState('')
  const [base, setBase] = useState('todos')
  const [coordenador, setCoordenador] = useState('todos')
  const [responsavel, setResponsavel] = useState('todos')
  const [supervisor, setSupervisor] = useState('todos')
  const [prefixo, setPrefixo] = useState('todos')
  const [data, setData] = useState('todos')
  const [pagina, setPagina] = useState(1)
  const [dataOrdem, setDataOrdem] = useState<'asc' | 'desc'>('asc')
  const [pageSizeStr, setPageSizeStr] = useState('25')
  const pageSize = Number(pageSizeStr) || 25
  const [historyGroup, setHistoryGroup] = useState<ApontamentoGroup | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const tabelaRef = useRef<HTMLDivElement | null>(null)
  const syncedVehicleFromUrlRef = useRef<string | null>(null)
  const urlPlaca = searchParams.get('placa')
  const urlPrefixo = searchParams.get('prefixo')
  const urlChecklist = searchParams.get('checklist')

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    const veiculo = searchParams.get('veiculo')
    const placa = searchParams.get('placa')
    if (!veiculo && !placa) return
    if (veiculo) setVehicleId(veiculo)
    setFiltrosVisiveis(true)
    setPagina(1)
  }, [searchParams])

  /** Alinha o select ao veiculoId real dos apontamentos quando a URL traz placa. */
  useEffect(() => {
    if (!urlPlaca || rows.length === 0) return
    const placaNorm = normalizePlaca(urlPlaca)
    if (syncedVehicleFromUrlRef.current === placaNorm) return
    const match = rows.find(
      (r) => normalizePlaca(r.placa ?? placaFromApontamentoVeiculoId(r.veiculoId)) === placaNorm,
    )
    if (match) {
      setVehicleId(match.veiculoId)
      syncedVehicleFromUrlRef.current = placaNorm
    }
  }, [rows, urlPlaca])

  useEffect(() => {
    if (!urlPlaca) syncedVehicleFromUrlRef.current = null
  }, [urlPlaca])

  const vehicleFilter = useMemo(
    () => ({
      vehicleId,
      placa: urlPlaca,
      prefixo: urlPrefixo,
    }),
    [vehicleId, urlPlaca, urlPrefixo],
  )

  const vehicleOptions = useMemo<SelectOption[]>(() => {
    const map = new Map<string, string>()
    for (const r of rows) {
      if (!map.has(r.veiculoId)) map.set(r.veiculoId, r.veiculoLabel)
    }
    const veiculoUrl = searchParams.get('veiculo')
    const rotuloUrl = searchParams.get('rotulo')
    if (urlPlaca) {
      const placaNorm = normalizePlaca(urlPlaca)
      const match = rows.find(
        (r) => normalizePlaca(r.placa ?? placaFromApontamentoVeiculoId(r.veiculoId)) === placaNorm,
      )
      if (match) {
        map.set(match.veiculoId, match.veiculoLabel)
      } else if (veiculoUrl && veiculoUrl !== 'todos') {
        map.set(veiculoUrl, rotuloUrl?.trim() || veiculoUrl)
      }
    } else if (veiculoUrl && veiculoUrl !== 'todos' && !map.has(veiculoUrl)) {
      map.set(veiculoUrl, rotuloUrl?.trim() || veiculoUrl)
    }
    const opts = Array.from(map.entries()).map(([value, label]) => ({ value, label }))
    opts.sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
    return [{ value: 'todos', label: 'Todos os veículos' }, ...opts]
  }, [rows, searchParams, urlPlaca])


  const dataOpts = useMemo<SelectOption[]>(() => {
    const anos = [...new Set(rows.map((r) => r.dataApontamento.slice(0, 4)).filter(Boolean))]
      .sort((a, b) => Number(b) - Number(a))
    const anoAtual = String(new Date().getFullYear())
    return [
      { value: 'todos', label: 'Todos' },
      { value: 'hoje', label: 'Hoje' },
      { value: '7d', label: 'Últimos 7 dias' },
      { value: '30d', label: 'Últimos 30 dias' },
      { value: 'ano', label: `Ano atual (${anoAtual})` },
      ...anos.map((a) => ({ value: a, label: a })),
    ]
  }, [rows])

  /** Filtros da página (veículo, data, busca, etc.) sem recorte por visão Pendentes/Resolvidos — usado nos KPIs e como base da tabela. */
  const rowsMatchingFiltros = useMemo(() => {
    let list = rows
    if (urlChecklist) list = list.filter((r) => r.checklistId === urlChecklist)
    if (vehicleId !== 'todos') list = list.filter((r) => apontamentoMatchesVehicleFilter(r, vehicleFilter))
    if (base !== 'todos') list = list.filter((r) => matchesBaseFilter(r.base, base))
    if (coordenador !== 'todos') list = list.filter((r) => matchesCoordenadorFilter(r.coordenador, coordenador))
    if (responsavel !== 'todos') list = list.filter((r) => r.responsavel === responsavel)
    if (supervisor !== 'todos') list = list.filter((r) => matchesSupervisorFilter(r.responsavel, supervisor))
    if (prefixo !== 'todos') list = list.filter((r) => r.prefixo === prefixo)

    if (data !== 'todos') {
      const now = new Date()
      now.setHours(23, 59, 59, 999)
      const nowMs = now.getTime()
      const ano = now.getFullYear()

      if (data === 'ano') {
        list = list.filter((r) => Number(r.dataApontamento.slice(0, 4)) === ano)
      } else if (/^\d{4}$/.test(data)) {
        list = list.filter((r) => r.dataApontamento.startsWith(data))
      } else if (data === 'hoje') {
        const inicioHoje = new Date()
        inicioHoje.setHours(0, 0, 0, 0)
        list = list.filter((r) => new Date(r.dataApontamento + 'T00:00:00').getTime() >= inicioHoje.getTime())
      } else {
        const dias = data === '7d' ? 7 : 30
        const min = nowMs - dias * 86_400_000
        list = list.filter((r) => new Date(r.dataApontamento + 'T00:00:00').getTime() >= min)
      }
    }
    const q = query.trim().toLowerCase()
    if (q) {
      const qNorm = q.replace(/[-\s]/g, '')
      list = list.filter((r) => {
        const labelNorm = r.veiculoLabel.toLowerCase().replace(/[-\s]/g, '')
        return (
          r.defeito.toLowerCase().includes(q) ||
          r.veiculoLabel.toLowerCase().includes(q) ||
          labelNorm.includes(qNorm) ||
          r.prefixo.toLowerCase().includes(q) ||
          r.base.toLowerCase().includes(q) ||
          r.responsavel.toLowerCase().includes(q)
        )
      })
    }
    const dir = dataOrdem === 'asc' ? 1 : -1
    return [...list].sort(
      (a, b) =>
        dir * (new Date(a.dataApontamento).getTime() - new Date(b.dataApontamento).getTime()),
    )
  }, [rows, vehicleFilter, base, coordenador, responsavel, supervisor, prefixo, data, query, dataOrdem, urlChecklist])

  const sortedFiltered = useMemo(() => {
    let list = rowsMatchingFiltros
    if (visao === 'pendentes') list = list.filter((r) => !r.resolvido)
    if (visao === 'resolvidos') list = list.filter((r) => r.resolvido)
    if (visao === 'entrantes') list = list.filter((r) => isDefeitoEntrante(r, nowMs))
    if (severidade === 'imperativo') list = list.filter((r) => r.imperativo)
    if (severidade === 'atencao') list = list.filter((r) => !r.imperativo)
    return list
  }, [rowsMatchingFiltros, visao, severidade])

  const stats = useMemo(() => {
    const pendentes = rowsMatchingFiltros.filter((r) => !r.resolvido).length
    const resolvidos = rowsMatchingFiltros.filter((r) => r.resolvido).length
    const entrantes = rowsMatchingFiltros.filter((r) => isDefeitoEntrante(r, nowMs)).length
    return { total: rowsMatchingFiltros.length, pendentes, resolvidos, entrantes }
  }, [rowsMatchingFiltros, nowMs])

  const severidadeStats = useMemo(() => {
    let list = rowsMatchingFiltros
    if (visao === 'pendentes') list = list.filter((r) => !r.resolvido)
    if (visao === 'resolvidos') list = list.filter((r) => r.resolvido)
    if (visao === 'entrantes') list = list.filter((r) => isDefeitoEntrante(r, nowMs))
    return {
      total: list.length,
      imperativos: list.filter((r) => r.imperativo).length,
      atencao: list.filter((r) => !r.imperativo).length,
    }
  }, [rowsMatchingFiltros, visao, nowMs])

  const tableRowsAll = useMemo(
    () => buildManageTableRows(sortedFiltered, true, dataOrdem),
    [sortedFiltered, dataOrdem],
  )

  const totalFiltrados = tableRowsAll.length
  const totalPaginas = Math.max(1, Math.ceil(totalFiltrados / pageSize))
  const paginaEfetiva = Math.min(Math.max(1, pagina), totalPaginas)

  const paginaRows = useMemo(() => {
    const start = (paginaEfetiva - 1) * pageSize
    return tableRowsAll.slice(start, start + pageSize)
  }, [tableRowsAll, paginaEfetiva, pageSize])

  const irParaPagina = (p: number) => {
    const next = Math.min(Math.max(1, p), totalPaginas)
    setPagina(next)
    tabelaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const filtrosAtivos =
    vehicleId !== 'todos' ||
    base !== 'todos' ||
    coordenador !== 'todos' ||
    responsavel !== 'todos' ||
    supervisor !== 'todos' ||
    prefixo !== 'todos' ||
    data !== 'todos'

  const limparFiltros = () => {
    setVehicleId('todos')
    setBase('todos')
    setCoordenador('todos')
    setResponsavel('todos')
    setSupervisor('todos')
    setPrefixo('todos')
    setData('todos')
    setPagina(1)
    if (searchParams.get('veiculo') || searchParams.get('placa') || searchParams.get('prefixo')) {
      const next = new URLSearchParams(searchParams)
      next.delete('veiculo')
      next.delete('rotulo')
      next.delete('placa')
      next.delete('prefixo')
      setSearchParams(next, { replace: true })
    }
  }

  const prazoPassou = (prazoIso: string | null, resolvido: boolean) => {
    if (resolvido || !prazoIso) return false
    const t = new Date(prazoIso + 'T23:59:59').getTime()
    return nowMs > t
  }

  const [resolveOpen, setResolveOpen] = useState(false)
  const [resolveId, setResolveId] = useState<string | null>(null)
  const [resolveGroupIds, setResolveGroupIds] = useState<string[] | null>(null)
  const [resolveValor, setResolveValor] = useState<string>('')
  const [resolveData, setResolveData] = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [resolveDescricao, setResolveDescricao] = useState<string>('')
  const [resolveImgs, setResolveImgs] = useState<string[]>([])
  const [resolveOsFile, setResolveOsFile] = useState<{ name: string; data: string } | null>(null)
  const [salvando, setSalvando] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const osFileRef = useRef<HTMLInputElement | null>(null)

  // ── Modal de Agenda ───────────────────────────────────────────────────────
  const [agendaOpen, setAgendaOpen] = useState(false)

  const agendados = useMemo(() =>
    rows
      .filter((r) => !r.resolvido && r.agendamentoData)
      .sort((a, b) => (a.agendamentoData! > b.agendamentoData! ? 1 : -1)),
    [rows],
  )

  // ── Modal de Justificativa ────────────────────────────────────────────────
  const [justOpen, setJustOpen] = useState(false)
  const [justId, setJustId] = useState<string | null>(null)
  const [justData, setJustData] = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [justTexto, setJustTexto] = useState<string>('')
  const [justImagem, setJustImagem] = useState<string | null>(null)
  const [justAgendamento, setJustAgendamento] = useState<string>('')
  const [salvandoJust, setSalvandoJust] = useState(false)
  const justImgRef = useRef<HTMLInputElement | null>(null)

  const openJustModal = (r: Apontamento) => {
    if (!canMarkResolved) return
    setJustId(r.id)
    setJustData(r.justificativaData ?? new Date().toISOString().slice(0, 10))
    setJustTexto(r.justificativa ?? '')
    setJustImagem(r.justificativaImagem ?? null)
    setJustAgendamento(r.agendamentoData ?? '')
    setJustOpen(true)
  }

  const closeJustModal = () => {
    setJustOpen(false)
    setJustId(null)
    setJustData(new Date().toISOString().slice(0, 10))
    setJustTexto('')
    setJustImagem(null)
    setJustAgendamento('')
    if (justImgRef.current) justImgRef.current.value = ''
  }

  const addJustImagem = (files: FileList | null) => {
    if (!files || files.length === 0) return
    const file = files[0]!
    const reader = new FileReader()
    reader.onload = () => setJustImagem(String(reader.result ?? ''))
    reader.readAsDataURL(file)
    if (justImgRef.current) justImgRef.current.value = ''
  }

  const confirmJust = async () => {
    if (!canMarkResolved || !justId || !justTexto.trim()) return
    setSalvandoJust(true)
    await marcarJustificado(
      justId,
      { justificativa: justTexto.trim(), data: justData, imagem: justImagem, agendamentoData: justAgendamento || null },
      user?.email ?? 'desconhecido',
    )
    setSalvandoJust(false)
    closeJustModal()
  }

  const currentResolve = useMemo(
    () => (resolveId ? rows.find((r) => r.id === resolveId) ?? null : null),
    [rows, resolveId],
  )

  const openResolveModal = (r: Apontamento, groupIds?: string[]) => {
    if (!canMarkResolved) return
    const ids = groupIds?.length ? groupIds : findRecorrenteSiblingIds(rows, r.id)
    setResolveId(r.id)
    setResolveGroupIds(ids.length > 1 ? ids : null)
    const digits = r.reparoValor != null ? String(Math.round(r.reparoValor * 100)) : ''
    setResolveValor(digits ? formatCurrency(digits) : '')
    setResolveData(r.dataResolvido ?? new Date().toISOString().slice(0, 10))
    setResolveDescricao(r.reparoDescricao ?? '')
    setResolveImgs(r.reparoImagens ?? [])
    setResolveOsFile(r.osArquivo ? { name: 'OS Anexada', data: r.osArquivo } : null)
    setResolveOpen(true)
  }

  const closeResolveModal = () => {
    setResolveOpen(false)
    setResolveId(null)
    setResolveGroupIds(null)
    setResolveValor('')
    setResolveData(new Date().toISOString().slice(0, 10))
    setResolveDescricao('')
    setResolveImgs([])
    setResolveOsFile(null)
    if (fileRef.current) fileRef.current.value = ''
    if (osFileRef.current) osFileRef.current.value = ''
  }

  const addOsFile = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const file = files[0]
    const reader = new FileReader()
    const data = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(String(reader.result ?? ''))
      reader.onerror = () => reject(new Error('Falha ao ler arquivo'))
      reader.readAsDataURL(file)
    })
    setResolveOsFile({ name: file.name, data })
    if (osFileRef.current) osFileRef.current.value = ''
  }

  const addImages = async (files: FileList | null) => {
    if (!files) return
    const remaining = Math.max(0, 3 - resolveImgs.length)
    const picked = Array.from(files).slice(0, remaining)
    const toDataUrl = (f: File) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result ?? ''))
        reader.onerror = () => reject(new Error('Falha ao ler imagem'))
        reader.readAsDataURL(f)
      })
    try {
      const urls = (await Promise.all(picked.map(toDataUrl))).filter(Boolean)
      setResolveImgs((prev) => [...prev, ...urls].slice(0, 3))
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const confirmResolve = async () => {
    if (!canMarkResolved || !resolveId) return
    setSalvando(true)
    const v = resolveValor.trim()
    const valor = v ? parseCurrency(v) : null
    const desc = resolveDescricao.trim()
    const payload = {
      valor: Number.isFinite(valor ?? NaN) ? valor : null,
      dataResolvido: resolveData || null,
      descricao: desc ? desc : null,
      imagens: resolveImgs,
      osArquivo: resolveOsFile?.data ?? null,
    }
    const ids = resolveGroupIds?.length ? resolveGroupIds : [resolveId]
    for (const id of ids) {
      const isPrimary = id === resolveId
      await marcarResolvido(
        id,
        isPrimary
          ? payload
          : {
              valor: null,
              descricao: null,
              imagens: [],
              osArquivo: null,
              dataResolvido: payload.dataResolvido,
            },
      )
    }
    setSalvando(false)
    closeResolveModal()
    setHistoryGroup(null)
  }

  useEffect(() => {
    if (!canMarkResolved && resolveOpen) {
      queueMicrotask(() => {
        setResolveOpen(false)
        setResolveId(null)
        setResolveValor('')
        setResolveData(new Date().toISOString().slice(0, 10))
        setResolveDescricao('')
        setResolveImgs([])
        setResolveOsFile(null)
        if (fileRef.current) fileRef.current.value = ''
        if (osFileRef.current) osFileRef.current.value = ''
      })
    }
  }, [canMarkResolved, resolveOpen])

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-900 text-white shadow-soft dark:bg-slate-100 dark:text-slate-900">
            <Settings2 size={18} />
          </div>
          <div>
            <div className="text-xl font-black tracking-tight text-slate-900 dark:text-slate-100">
              Gerenciar
            </div>
            <div className="text-sm font-semibold text-slate-500 dark:text-slate-400">
              Controle de defeitos e relatórios da frota.
            </div>
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          <Link
            to="/gerenciar/evolucao"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-900 shadow-soft hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900 sm:flex-initial"
          >
            <TrendingUp size={18} />
            Evolução
          </Link>
          <button
            type="button"
            onClick={() => setAgendaOpen(true)}
            className="relative inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-900 shadow-soft hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900 sm:flex-initial"
          >
            <CalendarClock size={18} />
            Agenda
            {agendados.length > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-extrabold text-white">
                {agendados.length}
              </span>
            )}
          </button>
          <Link
            to="/gerenciar/historico"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-900 shadow-soft hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900 sm:flex-initial"
          >
            <History size={18} />
            Histórico
          </Link>
        </div>
      </div>

      <div data-tour="manage-stats" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatPill
          label="Checklists realizados"
          value={String(filtrosAtivos ? new Set(rowsMatchingFiltros.map((r) => r.checklistId)).size : checklistsRealizadosTotal)}
          icon={<ClipboardList size={18} />}
          tone="slate"
          selected={visao === 'apontamentos'}
          onClick={() => { setVisao('apontamentos'); setPagina(1) }}
        />
        <StatPill
          label="Pendentes"
          value={String(stats.pendentes)}
          icon={<AlertTriangle size={18} />}
          tone="rose"
          selected={visao === 'pendentes'}
          onClick={() => { setVisao('pendentes'); setPagina(1) }}
        />
        <StatPill
          label="Resolvidos"
          value={String(stats.resolvidos)}
          icon={<CheckCircle2 size={18} />}
          tone="emerald"
          selected={visao === 'resolvidos'}
          onClick={() => { setVisao('resolvidos'); setPagina(1) }}
        />
        <StatPill
          label="Defeitos entrantes"
          value={String(stats.entrantes)}
          icon={<Inbox size={18} />}
          tone="sky"
          selected={visao === 'entrantes'}
          onClick={() => {
            setVisao('entrantes')
            setDataOrdem('desc')
            setPagina(1)
            tabelaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-soft dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Filtros</span>
          <button
            type="button"
            data-tour="manage-filtros-btn"
            onClick={() => setFiltrosVisiveis((v) => {
              const next = !v
              try { localStorage.setItem('frota.filtros.manage', String(next)) } catch { /* ignore */ }
              return next
            })}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-transparent px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-700 transition hover:bg-slate-100/60 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-600/60 dark:text-slate-200 dark:hover:bg-white/5"
          >
            {filtrosVisiveis
              ? <><ChevronUp size={13} className="text-slate-400" /> Ocultar filtros</>
              : <><ChevronDown size={13} className="text-slate-400" /> Mostrar filtros</>
            }
          </button>
        </div>
        <div data-tour="manage-filtros" className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${filtrosVisiveis ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
          <div className="overflow-hidden">
            <div className="flex flex-col gap-3 p-4">
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
                <Select
                  label="Filtrar por veículo"
                  value={vehicleId}
                  options={vehicleOptions}
                  onChange={(v) => { setVehicleId(v); setPagina(1) }}
                />
                <Select
                  label="Base"
                  value={base}
                  options={BASE_FILTER_SELECT_OPTIONS}
                  onChange={(v) => { setBase(v); setPagina(1) }}
                />
                <Select
                  label="Gerência"
                  value={coordenador}
                  options={COORDENADOR_FILTER_SELECT_OPTIONS}
                  onChange={(v) => { setCoordenador(v); setPagina(1) }}
                />
                <Select
                  label="Supervisor"
                  value={supervisor}
                  options={SUPERVISOR_FILTER_SELECT_OPTIONS}
                  onChange={(v) => { setSupervisor(v); setPagina(1) }}
                />
                <Select label="Data" value={data} options={dataOpts} onChange={(v) => { setData(v); setPagina(1) }} />
              </div>
              <div className="flex items-end gap-3">
                <div className="min-w-0 flex-1">
                  <div className="whitespace-nowrap text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Buscar defeito ou veículo
                  </div>
                  <div className="mt-1 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/40">
                    <Search size={16} className="shrink-0 text-slate-400 dark:text-slate-500" />
                    <input
                      value={query}
                      onChange={(e) => { setQuery(e.target.value); setPagina(1) }}
                      placeholder="Texto do defeito, prefixo ou placa..."
                      className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={limparFiltros}
                  disabled={!filtrosAtivos}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 shadow-soft hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                  title="Limpar filtros"
                >
                  <RotateCcw size={18} aria-hidden />
                  Limpar
                </button>
              </div>
            </div>
          </div>
        </div>

        {carregando && (
          <div className="mt-4 flex items-center justify-center gap-2 py-10 text-sm font-semibold text-slate-500 dark:text-slate-400">
            <Loader2 size={18} className="animate-spin" />
            Carregando apontamentos...
          </div>
        )}
        {visao === 'entrantes' && (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 dark:border-sky-900/40 dark:bg-sky-950/40">
            <Inbox size={15} className="shrink-0 text-sky-600 dark:text-sky-400" />
            <p className="flex-1 text-sm font-semibold text-sky-900 dark:text-sky-200">
              Exibindo defeitos novos registrados hoje ({new Date(nowMs).toLocaleDateString('pt-BR')}).
            </p>
            <button
              type="button"
              onClick={() => { setVisao('apontamentos'); setPagina(1) }}
              className="inline-flex items-center gap-1 rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-xs font-extrabold text-sky-800 hover:bg-sky-50 dark:border-sky-700 dark:bg-slate-900 dark:text-sky-300 dark:hover:bg-slate-800"
            >
              <X size={12} />
              Ver todos
            </button>
          </div>
        )}
        {urlChecklist && (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-900/20">
            <ExternalLink size={15} className="shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="flex-1 text-sm font-semibold text-amber-800 dark:text-amber-300">
              Exibindo apenas os defeitos do checklist selecionado.
            </p>
            <Link
              to="/gerenciar"
              className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-extrabold text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:bg-slate-900 dark:text-amber-400 dark:hover:bg-slate-800"
            >
              <X size={12} />
              Limpar filtro
            </Link>
          </div>
        )}
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/50 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-2 text-slate-500 dark:text-slate-400">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white text-sky-600 shadow-sm dark:bg-slate-950/60 dark:text-sky-300">
              <History size={13} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Agrupamento automático
              </p>
              <p className="truncate text-[11px] font-semibold">
                Mesma placa e item aparecem em uma linha. Clique na linha para ver o histórico.
              </p>
            </div>
          </div>

          <div data-tour="manage-severidade" className="flex flex-wrap items-center gap-2 lg:justify-end">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Severidade
            </span>
            <button
              type="button"
              onClick={() => { setSeveridade('todos'); setPagina(1) }}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-extrabold transition ${
                severidade === 'todos'
                  ? 'border-slate-500 bg-slate-800 text-white shadow-sm dark:border-slate-500 dark:bg-slate-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              Todos
              <span className="rounded-full bg-white/20 px-1.5 text-[10px] tabular-nums">{severidadeStats.total}</span>
            </button>
            <button
              type="button"
              onClick={() => { setSeveridade('imperativo'); setPagina(1) }}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-extrabold transition ${
                severidade === 'imperativo'
                  ? 'border-rose-500 bg-rose-600 text-white shadow-sm dark:border-rose-500 dark:bg-rose-700'
                  : 'border-rose-200 bg-white text-rose-700 hover:bg-rose-50 dark:border-rose-900/60 dark:bg-slate-950/60 dark:text-rose-300 dark:hover:bg-rose-950/40'
              }`}
            >
              <DefeitoSeveridadeIcon imperativo size={12} />
              Impeditivos
              <span className="rounded-full bg-white/20 px-1.5 text-[10px] tabular-nums">{severidadeStats.imperativos}</span>
            </button>
            <button
              type="button"
              onClick={() => { setSeveridade('atencao'); setPagina(1) }}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-extrabold transition ${
                severidade === 'atencao'
                  ? 'border-amber-500 bg-amber-500 text-white shadow-sm dark:border-amber-500 dark:bg-amber-600'
                  : 'border-amber-200 bg-white text-amber-700 hover:bg-amber-50 dark:border-amber-900/60 dark:bg-slate-950/60 dark:text-amber-300 dark:hover:bg-amber-950/40'
              }`}
            >
              <DefeitoSeveridadeIcon imperativo={false} size={12} />
              Atenção
              <span className="rounded-full bg-white/20 px-1.5 text-[10px] tabular-nums">{severidadeStats.atencao}</span>
            </button>
          </div>
        </div>
        <div
          ref={tabelaRef}
          data-tour="manage-table"
          className={`mt-3 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 ${carregando ? 'hidden' : ''}`}
        >
          <table className="min-w-[980px] w-full border-collapse text-center text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-400">
                <th className="px-3 py-2 text-center">Veículo</th>
                <th className="px-3 py-2 text-center">Processo</th>
                <th className="px-3 py-2 text-center">Base</th>
                <th className="px-3 py-2 text-center">Gerência</th>
                <th className="px-3 py-2 text-center">Defeito</th>
                <th className="px-3 py-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setDataOrdem((d) => (d === 'asc' ? 'desc' : 'asc'))
                      setPagina(1)
                    }}
                    className="inline-flex items-center justify-center gap-1 hover:text-slate-800 dark:hover:text-slate-200"
                    title={dataOrdem === 'asc' ? 'Mais antigos primeiro — clique para recentes' : 'Mais recentes primeiro — clique para antigos'}
                    aria-label={`Ordenar por data de apontamento: ${dataOrdem === 'asc' ? 'mais antigos primeiro' : 'mais recentes primeiro'}`}
                  >
                    Data de apontamento
                    {dataOrdem === 'desc' ? (
                      <ChevronDown size={12} className="text-blue-500" aria-hidden />
                    ) : (
                      <ChevronUp size={12} className="text-blue-500" aria-hidden />
                    )}
                  </button>
                </th>
                <th className="px-3 py-2 text-center">Prazo</th>
                <th className="px-3 py-2 text-center">Status / ações</th>
              </tr>
            </thead>
            <tbody className="font-semibold text-slate-800 dark:text-slate-200">
              {tableRowsAll.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">
                    {visao === 'entrantes'
                      ? 'Nenhum defeito novo registrado hoje.'
                      : 'Nenhum registro para os filtros atuais.'}
                  </td>
                </tr>
              ) : (
                paginaRows.map((item) => {
                  const group = item.type === 'group' ? item.group : null
                  const r = group ? group.representative : (item as { type: 'single'; row: Apontamento; sortKey: string }).row
                  const rowKey = group ? group.key : r.id
                  const atrasado = prazoPassou(r.prazo, r.resolvido)
                  const agendado = !r.resolvido && !!r.agendamentoData
                  const stopRowClick = (e: MouseEvent) => e.stopPropagation()
                  return (
                    <tr
                      key={rowKey}
                      onClick={group ? () => setHistoryGroup(group) : undefined}
                      className={[
                        'border-b last:border-0',
                        group ? 'cursor-pointer' : '',
                        agendado
                          ? 'border-amber-200/70 bg-amber-50/60 hover:bg-amber-50 dark:border-amber-800/30 dark:bg-amber-950/20 dark:hover:bg-amber-950/30'
                          : group
                            ? 'border-sky-200/60 bg-sky-50/40 hover:bg-sky-50/80 dark:border-sky-900/35 dark:bg-sky-950/15 dark:hover:bg-sky-950/25'
                            : 'border-slate-100 hover:bg-slate-50/80 dark:border-slate-800/80 dark:hover:bg-slate-900/40',
                      ].join(' ')}
                    >
                      <td className="align-middle px-3 py-2">
                        <span className="inline-flex min-w-0 items-center justify-center gap-2">
                          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-900/60 dark:text-slate-300">
                            <Truck size={13} />
                          </span>
                          <span className="truncate font-mono text-xs font-black tracking-tight text-slate-800 dark:text-slate-100">{r.veiculoLabel}</span>
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 align-middle text-center text-xs text-slate-600 dark:text-slate-300">
                        <div className="flex justify-center">
                          {r.checklistId
                            ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"><ClipboardList size={10} />Checklist NC</span>
                            : r.processo}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 align-middle text-xs text-slate-600 dark:text-slate-300">
                        {r.base}
                      </td>
                      <td className="max-w-[150px] px-3 py-2 align-middle text-xs text-slate-600 dark:text-slate-300">
                        <span className="mx-auto block max-w-full truncate">{r.coordenador}</span>
                      </td>
                      <td className="max-w-[320px] px-3 py-2 align-middle text-xs leading-snug sm:text-sm">
                        <div className="flex min-w-0 flex-col items-center gap-1">
                          <span className="inline-flex min-w-0 items-start justify-center gap-1.5 text-center">
                            <DefeitoSeveridadeIcon imperativo={r.imperativo} />
                            <span className="line-clamp-2">{formatDefeitoParaExibicao(r.defeito)}</span>
                          </span>
                          {group ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
                              <History size={9} aria-hidden />
                              Recorrente · {group.count}x
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 align-middle text-center text-xs sm:text-sm">
                        {group ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <div>{formatDateBR(r.dataApontamento)}</div>
                            {r.horaApontamento ? (
                              <div className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">{r.horaApontamento}</div>
                            ) : null}
                          </div>
                        ) : (
                          <>
                            <div>{formatDateBR(r.dataApontamento)}</div>
                            {r.horaApontamento && (
                              <div className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">{r.horaApontamento}</div>
                            )}
                          </>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 align-middle text-center text-xs sm:text-sm">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className={atrasado ? 'font-black text-rose-600 dark:text-rose-400' : ''}>
                            {r.prazo ? formatDateBR(r.prazo) : '—'}
                          </span>
                          {atrasado ? (
                            <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                              Atrasado
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-2 align-middle" onClick={stopRowClick}>
                        <div className="flex items-center justify-center gap-1.5">
                          {group && (
                            <button
                              type="button"
                              onClick={(e) => { stopRowClick(e); setHistoryGroup(group) }}
                              className="inline-flex items-center gap-1 rounded-full border border-sky-300 bg-sky-50 px-2 py-1 text-[10px] font-extrabold text-sky-700 transition hover:bg-sky-100 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-300 dark:hover:bg-sky-950/70"
                              title="Ver histórico de ocorrências"
                            >
                              <History size={11} aria-hidden />
                              {group.count}x
                            </button>
                          )}
                          {r.resolvido ? (
                            <span
                              className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-extrabold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
                              title="Resolvido"
                            >
                              <Check size={14} strokeWidth={3} className="text-emerald-600" aria-hidden />
                              Sim
                            </span>
                          ) : r.justificado ? (
                            <>
                              <div className="flex flex-col items-center gap-0.5">
                                <span
                                  className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-extrabold text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
                                  title={r.justificativa ?? 'Justificado'}
                                >
                                  <MessageSquareWarning size={12} className="text-amber-600" aria-hidden />
                                  Justificado
                                </span>
                                {r.agendamentoData && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-extrabold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                                    📅 {new Date(r.agendamentoData + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                  </span>
                                )}
                              </div>
                              {canMarkResolved ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={(e) => { stopRowClick(e); openJustModal(r) }}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-amber-400/60 bg-amber-50 text-amber-700 shadow-sm transition hover:bg-amber-100 hover:ring-2 hover:ring-amber-300/40 dark:border-amber-600 dark:bg-amber-950/50 dark:text-amber-300 dark:hover:bg-amber-900/60"
                                    title="Editar justificativa"
                                  >
                                    <MessageSquareWarning size={15} aria-hidden />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      stopRowClick(e)
                                      openResolveModal(r, group?.ocorrencias.map((o) => o.id))
                                    }}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-emerald-500/60 bg-emerald-50 text-emerald-700 shadow-sm transition hover:bg-emerald-100 hover:ring-2 hover:ring-emerald-400/40 dark:border-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-900/60"
                                    title="Marcar como resolvido"
                                  >
                                    <Check size={17} strokeWidth={3} aria-hidden />
                                  </button>
                                </>
                              ) : null}
                            </>
                          ) : (
                            <>
                              <span
                                className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-extrabold text-rose-800 dark:bg-rose-950/40 dark:text-rose-200"
                                title="Não resolvido"
                              >
                                <X size={13} strokeWidth={2.5} className="text-rose-600" aria-hidden />
                                Não
                              </span>
                              {canMarkResolved ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={(e) => { stopRowClick(e); openJustModal(r) }}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-amber-400/60 bg-amber-50 text-amber-700 shadow-sm transition hover:bg-amber-100 hover:ring-2 hover:ring-amber-300/40 dark:border-amber-600 dark:bg-amber-950/50 dark:text-amber-300 dark:hover:bg-amber-900/60"
                                    title="Adicionar justificativa"
                                    aria-label="Justificar não resolução"
                                  >
                                    <MessageSquareWarning size={15} aria-hidden />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      stopRowClick(e)
                                      openResolveModal(r, group?.ocorrencias.map((o) => o.id))
                                    }}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-emerald-500/60 bg-emerald-50 text-emerald-700 shadow-sm transition hover:bg-emerald-100 hover:ring-2 hover:ring-emerald-400/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:border-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-900/60 dark:focus-visible:ring-offset-slate-950"
                                    title="Marcar como resolvido"
                                    aria-label={`Marcar defeito ${formatDefeitoParaExibicao(r.defeito).slice(0, 48)} do veículo ${r.prefixo} como resolvido`}
                                  >
                                    <Check size={17} strokeWidth={3} aria-hidden />
                                  </button>
                                </>
                              ) : null}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex flex-col gap-3 border-t border-slate-100 pt-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {totalFiltrados === 0 ? (
              <>Nenhum registro com os filtros atuais.</>
            ) : (
              <>
                Mostrando{' '}
                <span className="font-extrabold text-slate-700 dark:text-slate-300">
                  {(paginaEfetiva - 1) * pageSize + 1}
                </span>
                {' — '}
                <span className="font-extrabold text-slate-700 dark:text-slate-300">
                  {Math.min(paginaEfetiva * pageSize, totalFiltrados)}
                </span>
                {' de '}
                <span className="font-extrabold text-slate-700 dark:text-slate-300">{totalFiltrados}</span>
                {' linha(s). Ordem na coluna '}
                <span className="font-extrabold">&quot;Data de apontamento&quot;</span>
                {': '}
                <span className="font-extrabold">
                  {dataOrdem === 'asc' ? 'mais antigos primeiro' : 'mais recentes primeiro'}
                </span>
                .
              </>
            )}
          </div>
          {totalFiltrados > 0 ? (
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <div className="w-[168px] shrink-0">
                <Select
                  label="Por página"
                  value={pageSizeStr}
                  options={PAGE_SIZE_OPTIONS}
                  onChange={(v) => { setPageSizeStr(v); setPagina(1) }}
                />
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => irParaPagina(paginaEfetiva - 1)}
                  disabled={paginaEfetiva <= 1}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  aria-label="Página anterior"
                >
                  <ChevronLeft size={20} aria-hidden />
                </button>
                <span className="min-w-[7.5rem] px-2 text-center text-xs font-extrabold tabular-nums text-slate-600 dark:text-slate-300">
                  {paginaEfetiva} / {totalPaginas}
                </span>
                <button
                  type="button"
                  onClick={() => irParaPagina(paginaEfetiva + 1)}
                  disabled={paginaEfetiva >= totalPaginas}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  aria-label="Próxima página"
                >
                  <ChevronRight size={20} aria-hidden />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {resolveOpen && canMarkResolved ? (
        <Portal>
          <button
            type="button"
            className="fixed inset-0 z-[9998] bg-black/50"
            onPointerDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              closeResolveModal()
            }}
            aria-label="Fechar"
          />
          <div className="fixed inset-0 z-[9999] overflow-y-auto overscroll-contain">
            <div className="flex min-h-[100dvh] justify-center p-4 py-6 sm:items-center sm:py-8">
              <div
                className="my-auto flex w-full max-w-xl max-h-[min(100dvh-1.5rem,52rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft dark:border-slate-800 dark:bg-slate-950"
                onPointerDown={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label="Finalizar reparo"
              >
              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-4 pb-3 pt-4 dark:border-slate-800">
                <div className="min-w-0 pr-2">
                  <div className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-100">
                    {resolveGroupIds && resolveGroupIds.length > 1
                      ? `Resolver o mesmo defeito (${resolveGroupIds.length} apontamentos)`
                      : 'Marcar como resolvido'}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
                    {currentResolve ? (
                      <>
                        <span className="font-extrabold">{currentResolve.prefixo}</span>
                        {' — '}
                        <span className="inline-flex items-center gap-1.5">
                          <DefeitoSeveridadeIcon imperativo={currentResolve.imperativo} size={13} />
                          {formatDefeitoParaExibicao(currentResolve.defeito)}
                        </span>
                        {resolveGroupIds && resolveGroupIds.length > 1 ? (
                          <span className="mt-1 block text-xs font-semibold text-sky-600 dark:text-sky-400">
                            É o mesmo problema apontado em dias diferentes. Ao confirmar, todas as {resolveGroupIds.length} ocorrências serão marcadas como resolvidas.
                          </span>
                        ) : null}
                      </>
                    ) : (
                      'Informe o valor e anexe evidências.'
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeResolveModal}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                  aria-label="Fechar"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-4">
              {/* Problemas adicionais reportados no checklist */}
              {currentResolve?.problemasAdicionais && (
                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-800/50 dark:bg-amber-950/20">
                  <p className="mb-1 text-[10px] font-extrabold uppercase tracking-widest text-amber-600 dark:text-amber-400">
                    Problemas adicionais reportados
                  </p>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {currentResolve.problemasAdicionais}
                  </p>
                  {currentResolve.descricaoProblema && (
                    <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Local/detalhe: {currentResolve.descricaoProblema}
                    </p>
                  )}
                </div>
              )}
              {/* Fotos da NC de origem (quando apontamento vem de checklist) */}
              {currentResolve?.ncFotos && currentResolve.ncFotos.length > 0 && (
                <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 dark:border-rose-900/50 dark:bg-rose-950/20">
                  <p className="mb-2 text-[10px] font-extrabold uppercase tracking-widest text-rose-500 dark:text-rose-400">
                    Foto(s) da não conformidade registrada no checklist
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {currentResolve.ncFotos.map((src, i) => (
                      <a
                        key={src}
                        href={src}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group relative h-24 w-24 overflow-hidden rounded-xl border-2 border-rose-200 bg-slate-100 shadow-sm transition hover:border-rose-400 dark:border-rose-800 dark:bg-slate-900"
                        title="Ver foto em tamanho real"
                      >
                        <img src={src} alt={`NC foto ${i + 1}`} className="h-full w-full object-cover transition group-hover:scale-105" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/25">
                          <ZoomIn size={18} className="text-white opacity-0 drop-shadow transition group-hover:opacity-100" />
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Data da resolução
                  </div>
                  <input
                    type="date"
                    value={resolveData}
                    onChange={(e) => setResolveData(e.target.value)}
                    max={new Date().toISOString().slice(0, 10)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-brand-500/40 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:[color-scheme:dark]"
                  />
                </div>

                <div>
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Valor gasto no reparo (R$)
                  </div>
                  <input
                    value={resolveValor}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '')
                      setResolveValor(digits ? formatCurrency(digits) : '')
                    }}
                    inputMode="numeric"
                    placeholder="0,00"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-brand-500/40 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                  />
                  <div className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Imagens (máx. 3)
                  </div>
                  <div className="mt-1 flex gap-2">
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => void addImages(e.target.files)}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={resolveImgs.length >= 3}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-extrabold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                    >
                      <Upload size={16} />
                      Anexar
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {resolveImgs.map((src, idx) => (
                      <div key={src} className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
                        <img src={src} alt={`Anexo ${idx + 1}`} className="h-20 w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setResolveImgs((prev) => prev.filter((_, i) => i !== idx))}
                          className="absolute right-1 top-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/75"
                          aria-label="Remover imagem"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <div className="flex items-baseline gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Anexar
                    <span className="text-sky-600 dark:text-sky-400">OS</span>
                    <span className="text-[10px] font-semibold normal-case tracking-normal text-slate-400 dark:text-slate-500">
                      (Ordem de Serviço)
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      ref={osFileRef}
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => void addOsFile(e.target.files)}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => osFileRef.current?.click()}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-extrabold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                    >
                      <Upload size={16} />
                      {resolveOsFile ? 'Substituir' : 'Anexar'}
                    </button>
                    {resolveOsFile ? (
                      <div className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/40">
                        <span className="min-w-0 truncate text-xs font-semibold text-slate-700 dark:text-slate-200">
                          {resolveOsFile.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setResolveOsFile(null)
                            if (osFileRef.current) osFileRef.current.value = ''
                          }}
                          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600 hover:bg-rose-200 dark:bg-rose-950/40 dark:text-rose-400"
                          aria-label="Remover OS"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                        Arquivo ou imagem
                      </span>
                    )}
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Descrição do serviço
                  </div>
                  <textarea
                    value={resolveDescricao}
                    onChange={(e) => setResolveDescricao(e.target.value)}
                    rows={3}
                    className="mt-1 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-brand-500/40 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                  />
                  <div className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  </div>
                </div>
              </div>
              </div>

              <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50/90 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeResolveModal}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void confirmResolve()}
                  disabled={salvando}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-extrabold text-white shadow-soft hover:bg-emerald-700 disabled:opacity-60"
                >
                  {salvando
                    ? <Loader2 size={18} className="animate-spin" />
                    : <Check size={18} strokeWidth={3} />}
                  {salvando ? 'Salvando...' : 'Confirmar resolvido'}
                </button>
              </div>
            </div>
          </div>
          </div>
        </Portal>
      ) : null}

      {/* ── Painel de Agenda ──────────────────────────────────────────────── */}
      {agendaOpen ? (
        <Portal>
          <button
            type="button"
            className="fixed inset-0 z-[9998] bg-black/50 backdrop-blur-sm"
            onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); setAgendaOpen(false) }}
            aria-label="Fechar agenda"
          />
          <div className="fixed inset-0 z-[9999] overflow-y-auto overscroll-contain">
            <div className="flex min-h-[100dvh] justify-center p-4 py-6 sm:items-center sm:py-8">
              <div
                className="my-auto flex w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950"
                onPointerDown={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label="Agenda de correções"
              >
                {/* Header */}
                <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-amber-50 px-5 py-4 dark:border-slate-800 dark:bg-amber-950/30">
                  <div className="flex items-center gap-2">
                    <CalendarClock size={18} className="text-amber-600 dark:text-amber-400" />
                    <div>
                      <div className="text-sm font-extrabold text-amber-800 dark:text-amber-200">
                        Agenda de correções
                      </div>
                      <div className="text-xs font-semibold text-amber-700/70 dark:text-amber-400/70">
                        {agendados.length === 0
                          ? 'Nenhum item agendado'
                          : `${agendados.length} item${agendados.length > 1 ? 's' : ''} aguardando correção`}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAgendaOpen(false)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-amber-200 bg-white text-slate-600 hover:bg-amber-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                    aria-label="Fechar"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Body */}
                <div className="max-h-[min(70dvh,32rem)] overflow-y-auto">
                  {agendados.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400 dark:text-slate-500">
                      <CalendarClock size={36} strokeWidth={1.5} />
                      <p className="text-sm font-semibold">Nenhuma correção agendada no momento.</p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                      {agendados.map((r) => {
                        const dataBR = new Date(r.agendamentoData! + 'T12:00:00').toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })
                        const isVencida = r.agendamentoData! < new Date().toISOString().slice(0, 10)
                        return (
                          <li key={r.id} className="flex items-start gap-3 px-5 py-4">
                            <div className={[
                              'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-sm',
                              isVencida ? 'bg-rose-500' : 'bg-amber-500',
                            ].join(' ')}>
                              <CalendarClock size={16} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-mono text-xs font-extrabold text-slate-700 dark:text-slate-200">
                                  {r.prefixo || r.veiculoLabel}
                                </span>
                                <span className={[
                                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold',
                                  isVencida
                                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
                                ].join(' ')}>
                                  📅 {dataBR}
                                  {isVencida ? ' · vencida' : ''}
                                </span>
                              </div>
                              <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs font-semibold leading-snug text-slate-600 dark:text-slate-300">
                                <DefeitoSeveridadeIcon imperativo={r.imperativo} size={13} />
                                {formatDefeitoParaExibicao(r.defeito)}
                              </p>
                              {r.justificativa && (
                                <p className="mt-1 text-[11px] font-semibold italic text-slate-400 dark:text-slate-500 line-clamp-2">
                                  "{r.justificativa}"
                                </p>
                              )}
                            </div>
                            {canMarkResolved && (
                              <button
                                type="button"
                                onClick={() => { setAgendaOpen(false); openResolveModal(r) }}
                                className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-extrabold text-white shadow-sm hover:bg-emerald-700"
                                title="Marcar como resolvido"
                              >
                                <Check size={13} strokeWidth={3} />
                                Resolver
                              </button>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>

                {/* Footer */}
                <div className="flex shrink-0 justify-end border-t border-slate-200 bg-slate-50/90 px-5 py-3 dark:border-slate-800 dark:bg-slate-900/60">
                  <button
                    type="button"
                    onClick={() => setAgendaOpen(false)}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Portal>
      ) : null}

      {/* ── Modal de Justificativa ─────────────────────────────────────────── */}
      {justOpen ? (
        <Portal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeJustModal} />
            <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-200 bg-amber-50 px-5 py-4 dark:border-slate-800 dark:bg-amber-950/30">
                <div className="flex items-center gap-2">
                  <MessageSquareWarning size={18} className="text-amber-600 dark:text-amber-400" />
                  <span className="text-sm font-extrabold text-amber-800 dark:text-amber-200">
                    Justificativa de não resolução
                  </span>
                </div>
                <button type="button" onClick={closeJustModal} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="space-y-4 p-5">
                {/* Data */}
                <div>
                  <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Data
                  </label>
                  <input
                    type="date"
                    value={justData}
                    onChange={(e) => setJustData(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-amber-400/40 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>

                {/* Justificativa */}
                <div>
                  <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Justificativa <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    value={justTexto}
                    onChange={(e) => setJustTexto(e.target.value)}
                    rows={4}
                    placeholder="Descreva o motivo pelo qual o serviço não foi realizado..."
                    className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm outline-none placeholder:font-normal placeholder:text-slate-400 focus:ring-2 focus:ring-amber-400/40 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-600"
                  />
                </div>

                {/* Agendamento */}
                <div>
                  <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Agendar correção <span className="text-slate-400 font-normal normal-case">(opcional)</span>
                  </label>
                  <input
                    type="date"
                    value={justAgendamento}
                    onChange={(e) => setJustAgendamento(e.target.value)}
                    min={new Date().toISOString().slice(0, 10)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-amber-400/40 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                  />
                  {justAgendamento && (
                    <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                      <AlertTriangle size={11} />
                      Correção agendada para {new Date(justAgendamento + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </p>
                  )}
                </div>

                {/* Imagem opcional */}
                <div>
                  <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Imagem <span className="text-slate-400 font-normal normal-case">(opcional)</span>
                  </label>
                  {justImagem ? (
                    <div className="relative w-full overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
                      <img src={justImagem} alt="Evidência" className="max-h-48 w-full object-contain" />
                      <button
                        type="button"
                        onClick={() => setJustImagem(null)}
                        className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => justImgRef.current?.click()}
                      className="flex w-full items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400 dark:hover:bg-slate-800/60"
                    >
                      <ImageIcon size={16} />
                      Adicionar imagem
                    </button>
                  )}
                  <input
                    ref={justImgRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => addJustImagem(e.target.files)}
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50/90 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeJustModal}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void confirmJust()}
                  disabled={salvandoJust || !justTexto.trim()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-extrabold text-white shadow-soft hover:bg-amber-600 disabled:opacity-60"
                >
                  {salvandoJust
                    ? <Loader2 size={18} className="animate-spin" />
                    : <MessageSquareWarning size={18} />}
                  {salvandoJust ? 'Salvando...' : 'Salvar justificativa'}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      ) : null}

      {historyGroup ? (
        <Portal>
          <button
            type="button"
            className="fixed inset-0 z-[9998] bg-black/45"
            onClick={() => setHistoryGroup(null)}
            aria-label="Fechar histórico"
          />
          <aside
            className="fixed inset-y-0 right-0 z-[9999] flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950"
            role="dialog"
            aria-modal="true"
            aria-label="Histórico do defeito recorrente"
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400">
                  <History size={18} aria-hidden />
                  <span className="text-[11px] font-black uppercase tracking-wider">Histórico recorrente</span>
                </div>
                <h2 className="mt-1 text-lg font-black text-slate-900 dark:text-white">
                  {historyGroup.representative.veiculoLabel}
                </h2>
                <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 dark:text-slate-300">
                  <DefeitoSeveridadeIcon imperativo={historyGroup.representative.imperativo} size={15} />
                  {formatDefeitoParaExibicao(historyGroup.representative.defeito)}
                </p>
                <p className="mt-2 text-xs font-bold text-slate-500 dark:text-slate-400">
                  {historyGroup.count} apontamento(s)
                  {historyGroup.diasConsecutivos > 1
                    ? ` · ${historyGroup.diasConsecutivos} dias consecutivos`
                    : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryGroup(null)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
                aria-label="Fechar"
              >
                <X size={16} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <ol className="space-y-3">
                {historyGroup.ocorrencias.map((o, idx) => (
                  <li
                    key={o.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-slate-900 dark:text-white">
                          {formatDateBR(o.dataApontamento)}
                          {o.horaApontamento ? (
                            <span className="ml-2 text-xs font-bold text-slate-500 dark:text-slate-400">{o.horaApontamento}</span>
                          ) : null}
                        </p>
                        <p className="mt-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          Ocorrência {historyGroup.count - idx} de {historyGroup.count}
                        </p>
                      </div>
                      {idx === 0 ? (
                        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-black uppercase text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
                          Mais recente
                        </span>
                      ) : null}
                    </div>
                    {o.checklistId ? (
                      <Link
                        to={`/gerenciar?checklist=${encodeURIComponent(o.checklistId)}`}
                        onClick={() => setHistoryGroup(null)}
                        className="mt-3 inline-flex items-center gap-1 text-xs font-extrabold text-blue-600 hover:underline dark:text-blue-400"
                      >
                        <ExternalLink size={12} aria-hidden />
                        Ver checklist deste dia
                      </Link>
                    ) : null}
                    {o.ncFotos.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {o.ncFotos.slice(0, 3).map((src, i) => (
                          <a
                            key={src}
                            href={src}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="h-14 w-14 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700"
                          >
                            <img src={src} alt={`Foto NC ${i + 1}`} className="h-full w-full object-cover" />
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>

            {canMarkResolved && !historyGroup.representative.resolvido ? (
              <div className="flex shrink-0 gap-2 border-t border-slate-100 p-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    openResolveModal(
                      historyGroup.representative,
                      historyGroup.ocorrencias.map((o) => o.id),
                    )
                  }}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-emerald-700"
                >
                  <Check size={16} strokeWidth={3} aria-hidden />
                  Resolver mesmo defeito ({historyGroup.count} dias)
                </button>
              </div>
            ) : null}
          </aside>
        </Portal>
      ) : null}
    </div>
  )
}
