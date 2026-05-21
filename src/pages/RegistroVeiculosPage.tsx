import { useEffect, useMemo, useRef, useState, type FormEvent, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  Ban,
  Bike,
  BrainCircuit,
  Calendar,
  Car,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  FileSpreadsheet,
  LayoutGrid,
  List,
  Loader2,
  MapPin,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  Sparkles,
  Tag,
  Truck,
  Upload,
  User,
  Wrench,
  X,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { useApontamentos } from '../apontamentos/ApontamentosContext'
import { useAuth } from '../auth/AuthContext'
import { askGemini, isGeminiConfigured } from '../services/aiService'
import {
  apontamentoVeiculoIdFromPlaca,
  FLEET_MANUTENCAO_BY_PLACA_STORAGE_KEY,
  FLEET_OVERRIDE_BY_PLACA_STORAGE_KEY,
  FLEET_STATUS_BY_PLACA_STORAGE_KEY,
  formatPlaca,
  getDisplayedFleetVehicles,
  isEmbeddedCatalogFleetVehicleId,
  normalizePlaca,
  removeFleetVehicle,
  VEHICLE_TYPE_IDS,
  type FleetVehicle,
  type VehicleStatus,
  type VehicleTipo,
} from '../frota/vehicleRegistry'
import { useSupabaseVehicles } from '../frota/useSupabaseVehicles'
import { isOperacionalAtivosDashboardKpi } from '../frota/vehicleOperationalStatus'
import { useFleet } from '../frota/FleetContext'
import { renderFormattedText } from '../utils/renderFormattedAiText'

const TYPE_FILTER_IDLE =
  'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'

const VEHICLE_TYPES: {
  id: VehicleTipo
  label: string
  icon: typeof Truck
  color: string
  pillActive: string
}[] = [
  {
    id: 'MUNCK',
    label: 'Munck',
    icon: Truck,
    color: 'text-blue-500',
    pillActive:
      'bg-blue-100 text-blue-900 ring-2 ring-blue-500/30 dark:bg-blue-950/60 dark:text-blue-200 dark:ring-blue-400/40',
  },
  {
    id: 'SKY',
    label: 'Sky',
    icon: Wrench,
    color: 'text-purple-500',
    pillActive:
      'bg-purple-100 text-purple-900 ring-2 ring-purple-500/30 dark:bg-purple-950/60 dark:text-purple-200 dark:ring-purple-400/40',
  },
  {
    id: 'MOTO',
    label: 'Moto',
    icon: Bike,
    color: 'text-orange-500',
    pillActive:
      'bg-orange-100 text-orange-900 ring-2 ring-orange-500/30 dark:bg-orange-950/60 dark:text-orange-200 dark:ring-orange-400/40',
  },
  {
    id: 'PICAPE 4X4',
    label: 'Picape 4x4',
    icon: Truck,
    color: 'text-emerald-500',
    pillActive:
      'bg-teal-100 text-teal-900 ring-2 ring-teal-500/30 dark:bg-teal-950/60 dark:text-teal-200 dark:ring-teal-400/40',
  },
  {
    id: 'PICAPE LEVE',
    label: 'Picape leve',
    icon: Truck,
    color: 'text-slate-500',
    pillActive:
      'bg-slate-200 text-slate-900 ring-2 ring-slate-400/40 dark:bg-slate-700 dark:text-slate-100 dark:ring-slate-500/40',
  },
  {
    id: 'VEICULOS LEVES',
    label: 'Veículo leve',
    icon: Car,
    color: 'text-indigo-500',
    pillActive:
      'bg-indigo-100 text-indigo-900 ring-2 ring-indigo-500/30 dark:bg-indigo-950/60 dark:text-indigo-200 dark:ring-indigo-400/40',
  },
  {
    id: 'CARRETA',
    label: 'Carreta',
    icon: Truck,
    color: 'text-cyan-500',
    pillActive:
      'bg-cyan-100 text-cyan-900 ring-2 ring-cyan-500/30 dark:bg-cyan-950/60 dark:text-cyan-200 dark:ring-cyan-400/40',
  },
  {
    id: 'CAMINHÃO',
    label: 'Caminhão',
    icon: Truck,
    color: 'text-blue-600',
    pillActive:
      'bg-blue-100 text-blue-900 ring-2 ring-blue-500/30 dark:bg-blue-950/60 dark:text-blue-200 dark:ring-blue-400/40',
  },
  {
    id: 'OFICINA',
    label: 'Oficina',
    icon: Wrench,
    color: 'text-rose-500',
    pillActive:
      'bg-rose-100 text-rose-900 ring-2 ring-rose-500/30 dark:bg-rose-950/60 dark:text-rose-200 dark:ring-rose-400/40',
  },
  {
    id: 'MOTOPODA',
    label: 'Motopoda',
    icon: Wrench,
    color: 'text-lime-600',
    pillActive:
      'bg-lime-100 text-lime-900 ring-2 ring-lime-500/30 dark:bg-lime-950/60 dark:text-lime-200 dark:ring-lime-400/40',
  },
]

/** Chips principais na barra; Oficina e Motopoda entram no menu "Mais". */
const VEHICLE_TYPES_TOOLBAR_MAIN = VEHICLE_TYPES.filter((t) => t.id !== 'OFICINA' && t.id !== 'MOTOPODA')
const VEHICLE_TYPES_TOOLBAR_MORE = VEHICLE_TYPES.filter((t) => t.id === 'OFICINA' || t.id === 'MOTOPODA')

const LAYOUT_STORAGE_KEY = 'frota.vehicles.registroLayout'

/** Fecha `{` correspondente (assume strings JSON com aspas `"`). */
function findMatchingBraceEnd(src: string, startIdx: number): number {
  let depth = 0
  let inStr = false
  let escape = false
  for (let i = startIdx; i < src.length; i++) {
    const ch = src[i]!
    if (escape) {
      escape = false
      continue
    }
    if (inStr) {
      if (ch === '\\') escape = true
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') {
      inStr = true
      continue
    }
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

/**
 * Remove ecos do resumo JSON e fenced code que o modelo às vezes cola na análise
 * (melhora legibilidade no painel).
 */
function sanitizeAiFleetSuggestionText(raw: string): string {
  const trimmed = raw.replace(/\r\n/g, '\n').trim()
  if (!trimmed) return trimmed
  if (/^Erro\b/i.test(trimmed) || /^Desculpe\b/i.test(trimmed)) return trimmed

  let s = trimmed.replace(/```(?:json)?\s*[\s\S]*?```/gi, '\n')
  s = s.replace(/\n{3,}/g, '\n\n').trim()

  const reSummary = /\{\s*"totalFrota"\s*:/
  let idx = s.search(reSummary)
  while (idx !== -1) {
    const end = findMatchingBraceEnd(s, idx)
    if (end === -1) break
    s = (s.slice(0, idx) + s.slice(end + 1)).replace(/^\s*\n/, '').trim()
    idx = s.search(reSummary)
  }

  return s.trim()
}

function readInitialLayout(): 'grid' | 'list' {
  try {
    return localStorage.getItem(LAYOUT_STORAGE_KEY) === 'list' ? 'list' : 'grid'
  } catch {
    return 'grid'
  }
}

function vehicleToFormData(vehicle: FleetVehicle) {
  return {
    placa: vehicle.placa,
    modelo: vehicle.modelo === '—' ? '' : vehicle.modelo,
    tipo: vehicle.tipo,
    prefixo: vehicle.prefixo === 'N/A' ? '' : vehicle.prefixo,
    responsavel: vehicle.responsavel === 'NÃO ATRIBUÍDO' || vehicle.responsavel === '—' ? '' : vehicle.responsavel,
    supervisor: vehicle.supervisor === 'NÃO ATRIBUÍDO' ? '' : vehicle.supervisor,
    coordenador: vehicle.coordenador === 'NÃO ATRIBUÍDO' ? '' : vehicle.coordenador,
    base: vehicle.base === 'N/A' ? '' : vehicle.base,
    ano: vehicle.ano || new Date().getFullYear().toString(),
  }
}

function PaginationBar({
  pagina,
  totalPaginas,
  total,
  pageSize,
  onChange,
}: {
  pagina: number
  totalPaginas: number
  total: number
  pageSize: number
  onChange: (p: number) => void
}) {
  const from = (pagina - 1) * pageSize + 1
  const to = Math.min(pagina * pageSize, total)
  return (
    <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
        {from}–{to} de {total} veículos
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={pagina === 1}
          onClick={() => onChange(pagina - 1)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          aria-label="Página anterior"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="min-w-[4rem] text-center text-xs font-extrabold text-slate-700 dark:text-slate-300">
          {pagina} / {totalPaginas}
        </span>
        <button
          type="button"
          disabled={pagina === totalPaginas}
          onClick={() => onChange(pagina + 1)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          aria-label="Próxima página"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}

function AttentionBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-amber-700 dark:bg-amber-950 dark:text-amber-300">
      <AlertCircle size={compact ? 10 : 11} />
      {compact ? 'Atenção' : 'Precisa de atenção'}
    </span>
  )
}

function ImpedidoBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-rose-700 dark:bg-rose-950 dark:text-rose-300">
      <Ban size={compact ? 10 : 11} />
      Impedido
    </span>
  )
}

function VehicleOverflowMenu({
  vehicle,
  menuForId,
  setMenuForId,
  refresh,
  reloadFleet,
  showNotification,
  placement = 'up',
  isAdmin = false,
  onEdit,
  supabaseVehicleIds,
  onDeleteRequest,
  setStatus,
}: {
  vehicle: FleetVehicle
  menuForId: string | null
  setMenuForId: (id: string | null) => void
  refresh: () => void
  reloadFleet: () => void
  showNotification: (message: string, type: 'success' | 'error') => void
  placement?: 'up' | 'down'
  isAdmin?: boolean
  onEdit?: (vehicle: FleetVehicle) => void
  supabaseVehicleIds: Set<string>
  onDeleteRequest: (id: string, placa: string, isSupabase: boolean) => void
  setStatus: (id: string, status: VehicleStatus) => Promise<{ ok: true } | { ok: false; message: string }>
}) {
  const menuOpen = menuForId === vehicle.id
  const menuPosition =
    placement === 'up'
      ? 'absolute bottom-10 right-0 z-20 min-w-[160px]'
      : 'absolute right-0 top-full z-30 mt-1 min-w-[160px]'

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          setMenuForId(menuOpen ? null : vehicle.id)
        }}
        className="flex size-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
        aria-label="Mais opções"
      >
        <MoreHorizontal size={18} />
      </button>
      {menuOpen ? (
        <div
          className={`${menuPosition} overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-950`}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          role="menu"
        >
          {isAdmin && onEdit ? (
            <button
              type="button"
              role="menuitem"
              className="w-full px-4 py-2 text-left text-xs font-black uppercase tracking-wide text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40"
              onClick={() => {
                onEdit(vehicle)
                setMenuForId(null)
              }}
            >
              Editar
            </button>
          ) : null}
          {isAdmin && supabaseVehicleIds.has(vehicle.id) && vehicle.status !== 'ATIVO' && (
            <button
              type="button"
              role="menuitem"
              className="w-full px-4 py-2 text-left text-xs font-black uppercase tracking-wide text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
              onClick={() => {
                void setStatus(vehicle.id, 'ATIVO').then(() => {
                  refresh(); reloadFleet(); setMenuForId(null)
                  showNotification('Estado: ativo.', 'success')
                })
              }}
            >
              Marcar ativo
            </button>
          )}
          {isAdmin && supabaseVehicleIds.has(vehicle.id) && vehicle.status !== 'INATIVO' && (
            <button
              type="button"
              role="menuitem"
              className="w-full px-4 py-2 text-left text-xs font-black uppercase tracking-wide text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
              onClick={() => {
                void setStatus(vehicle.id, 'INATIVO').then(() => {
                  refresh(); reloadFleet(); setMenuForId(null)
                  showNotification('Veículo marcado como inativo.', 'success')
                })
              }}
            >
              Marcar inativo
            </button>
          )}
          {isAdmin && !isEmbeddedCatalogFleetVehicleId(vehicle.id) ? (
            <button
              type="button"
              role="menuitem"
              className="w-full px-4 py-2 text-left text-xs font-black uppercase tracking-wide text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
              onClick={() => {
                onDeleteRequest(vehicle.id, vehicle.placa, supabaseVehicleIds.has(vehicle.id))
                setMenuForId(null)
              }}
            >
              Remover
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

// ── Import Excel ──────────────────────────────────────────────────────────────

type ImportRow = {
  placa: string
  tipo: string
  modelo: string
  prefixo: string
  ano: string
  base: string
  supervisor: string
  coordenador: string
  _error?: string
}

const IMPORT_COLUMN_MAP: Record<string, keyof ImportRow> = {
  placa: 'placa',
  'tipo de veículo': 'tipo', tipo: 'tipo',
  'modelo/marca': 'modelo', modelo: 'modelo', marca: 'modelo',
  prefixo: 'prefixo',
  ano: 'ano',
  base: 'base',
  supervisor: 'supervisor',
  gerência: 'coordenador', gerencia: 'coordenador', coordenador: 'coordenador',
}

function parseImportSheet(file: File): Promise<ImportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
        const rows: ImportRow[] = raw.map((r) => {
          const row: ImportRow = { placa: '', tipo: '', modelo: '', prefixo: '', ano: '', base: '', supervisor: '', coordenador: '' }
          for (const [col, val] of Object.entries(r)) {
            const key = IMPORT_COLUMN_MAP[col.trim().toLowerCase()]
            if (key) row[key] = String(val ?? '').trim()
          }
          if (!row.placa) row._error = 'Placa ausente'
          return row
        }).filter((r) => r.placa || r._error)
        resolve(rows)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(file)
  })
}

function downloadImportTemplate() {
  const headers = ['Placa', 'Tipo de Veículo', 'Modelo/Marca', 'Prefixo', 'Ano', 'Base', 'Supervisor', 'Gerência']
  const example = ['ABC1D23', 'PICAPE 4X4', 'HILUX', 'STI301', '2024', 'BCB', 'NOME SUPERVISOR', 'NOME GERÊNCIA']
  const ws = XLSX.utils.aoa_to_sheet([headers, example])
  ws['!cols'] = headers.map(() => ({ wch: 20 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Veículos')
  XLSX.writeFile(wb, 'template-importacao-veiculos.xlsx')
}

// ──────────────────────────────────────────────────────────────────────────────

function defaultForm() {
  const y = new Date().getFullYear().toString()
  return {
    placa: '',
    modelo: '',
    tipo: 'VEICULOS LEVES' as VehicleTipo,
    prefixo: '',
    responsavel: '',
    supervisor: '',
    coordenador: '',
    base: '',
    ano: y,
  }
}

/**
 * Controlo da frota: cadastro e listagem de veículos (UI alinhada ao painel operacional).
 */
export function RegistroVeiculosPage() {
  const { vehicles: supabaseVehicles, deletedVehicles, saveVehicle, softDeleteVehicle, restoreVehicle, hardDeleteVehicle, setStatus, reload: reloadSupabase } = useSupabaseVehicles()
  const { reload: reloadFleet } = useFleet()
  const supabaseVehicleIds = useMemo(() => new Set(supabaseVehicles.map((v) => v.id)), [supabaseVehicles])
  const [vehicles, setVehicles] = useState<FleetVehicle[]>(() => getDisplayedFleetVehicles())
  const [activeTab, setActiveTab] = useState<'ativos' | 'removidos'>('ativos')
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; placa: string; isSupabase: boolean } | null>(null)
  const [confirmHardDelete, setConfirmHardDelete] = useState<{ id: string; placa: string } | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<'ALL' | VehicleTipo>('ALL')
  const [moreTypeMenuOpen, setMoreTypeMenuOpen] = useState(false)
  const moreTypeMenuRef = useRef<HTMLDivElement>(null)
  const fleetTableRef = useRef<HTMLDivElement>(null)
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [formData, setFormData] = useState(defaultForm)
  const [menuForId, setMenuForId] = useState<string | null>(null)
  const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>(readInitialLayout)
  /** Filtros por coluna (só aplicados na vista em lista). */
  const [colFilterPlaca, setColFilterPlaca] = useState('')
  const [colFilterModeloPrefixo, setColFilterModeloPrefixo] = useState('')
  const [colFilterOrgResp, setColFilterOrgResp] = useState('')
  const [colFilterLocalBase, setColFilterLocalBase] = useState('')
  const [colFilterCoordSup, setColFilterCoordSup] = useState('')
  const [colFilterStatus, setColFilterStatus] = useState<'ALL' | VehicleStatus | 'ATENÇÃO' | 'IMPEDIDO'>('ALL')
  // Import Excel modal
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importRows, setImportRows] = useState<ImportRow[]>([])
  const [importLoading, setImportLoading] = useState(false)
  const [importResult, setImportResult] = useState<{ ok: number; skip: number; errors: string[] } | null>(null)
  const importFileRef = useRef<HTMLInputElement>(null)

  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null)
  const [isAiLoading, setIsAiLoading] = useState(false)
  const [chatMessage, setChatMessage] = useState('')
  const [isChatSending, setIsChatSending] = useState(false)
  const [isChatCollapsed, setIsChatCollapsed] = useState(true)
  const [isChatVisible, setIsChatVisible] = useState(false)
  const [chatHistory, setChatHistory] = useState<
    { role: 'user' | 'assistant'; content: string }[]
  >([
    {
      role: 'assistant',
      content: 'Olá! Sou o assistente FROTA AI. Como posso ajudar com a frota hoje?',
    },
  ])

  const refresh = () => {
    const embedded = getDisplayedFleetVehicles()
    const supaPlacas = new Set(supabaseVehicles.map((v) => v.placa))
    const merged = [
      ...supabaseVehicles,
      ...embedded.filter((v) => !supaPlacas.has(v.placa)),
    ].sort((a, b) => a.placa.localeCompare(b.placa))
    setVehicles(merged)
  }

  useEffect(() => {
    refresh()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabaseVehicles])

  const handleImportFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const rows = await parseImportSheet(file)
      setImportRows(rows)
      setImportResult(null)
    } catch {
      showNotification('Erro ao ler o arquivo. Verifique o formato.', 'error')
    }
    e.target.value = ''
  }

  const handleImportConfirm = async () => {
    const validRows = importRows.filter((r) => !r._error && r.placa)
    if (!validRows.length) return
    setImportLoading(true)
    let ok = 0
    const errors: string[] = []

    for (const row of validRows) {
      const res = await saveVehicle({
        placa: row.placa,
        modelo: row.modelo || '—',
        tipo: (VEHICLE_TYPE_IDS.includes(row.tipo as VehicleTipo) ? row.tipo : 'VEICULOS LEVES') as VehicleTipo,
        prefixo: row.prefixo || 'N/A',
        responsavel: 'NÃO ATRIBUÍDO',
        supervisor: row.supervisor || 'NÃO ATRIBUÍDO',
        coordenador: row.coordenador || 'NÃO ATRIBUÍDO',
        base: row.base || 'N/A',
        ano: row.ano || new Date().getFullYear().toString(),
      })
      if (res.ok) { ok++ } else { errors.push(`${row.placa}: ${res.message}`) }
    }

    setImportResult({ ok, skip: importRows.filter((r) => !!r._error).length, errors })
    setImportLoading(false)
    await reloadSupabase()
    reloadFleet()
  }

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return
    const { id, isSupabase } = confirmDelete
    if (isSupabase) {
      const res = await softDeleteVehicle(id)
      if (!res.ok) { showNotification(res.message, 'error') }
      else { showNotification('Veículo removido.', 'success'); reloadFleet() }
    } else {
      removeFleetVehicle(id)
      refresh()
      showNotification('Veículo removido.', 'success')
    }
    setConfirmDelete(null)
  }

  const { rows: apontamentosRows, carregando: apontamentosCarregando } = useApontamentos()

  /** NC pendentes em itens não impeditivos (sem 🚫 no checklist). */
  const ncNaoImpeditivosPendentes = useMemo(
    () => apontamentosRows.filter((r) => !r.resolvido && !r.imperativo).length,
    [apontamentosRows],
  )

  /** NC imperativos pendentes — itens marcados com 🚫 que impedem condução. */
  const ncImpeditivosPendentes = useMemo(
    () => apontamentosRows.filter((r) => !r.resolvido && r.imperativo).length,
    [apontamentosRows],
  )

  /** Set de placas normalizadas com pelo menos um NC imperativo não resolvido. */
  const placasComImpedimento = useMemo(
    () => new Set(apontamentosRows.filter((r) => !r.resolvido && r.imperativo).map((r) => normalizePlaca(r.placa)).filter(Boolean)),
    [apontamentosRows],
  )

  /** Placas com NC não impeditivo pendente (Precisam de atenção). */
  const placasComAtencao = useMemo(
    () => new Set(apontamentosRows.filter((r) => !r.resolvido && !r.imperativo).map((r) => normalizePlaca(r.placa)).filter(Boolean)),
    [apontamentosRows],
  )

  const navigate = useNavigate()
  const { user } = useAuth()

  const VEHICLE_REGISTER_ALLOWED_EMAILS = [
    'demo@frotaapp.com',
    'admin@frotaapp.com',
    'user1@frotaapp.com',
    'user2@frotaapp.com',
    'user3@frotaapp.com',
  ]

  const canRegisterVehicle =
    (user?.role === 'admin' || user?.role === 'super_admin') &&
    VEHICLE_REGISTER_ALLOWED_EMAILS.includes((user?.email ?? '').trim().toLowerCase())

  const goToGerenciarVeiculo = (vehicle: FleetVehicle) => {
    const veiculoId = apontamentoVeiculoIdFromPlaca(vehicle.placa)
    const rotulo =
      vehicle.prefixo && vehicle.prefixo !== 'N/A'
        ? `${vehicle.prefixo} · ${formatPlaca(vehicle.placa)}`
        : formatPlaca(vehicle.placa)
    const params = new URLSearchParams({
      veiculo: veiculoId,
      rotulo,
      placa: normalizePlaca(vehicle.placa),
    })
    if (vehicle.prefixo && vehicle.prefixo !== 'N/A') {
      params.set('prefixo', vehicle.prefixo.trim())
    }
    navigate(`/gerenciar?${params.toString()}`)
  }

  useEffect(() => {
    if (!menuForId) return
    const close = () => setMenuForId(null)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menuForId])

  useEffect(() => {
    if (!moreTypeMenuOpen) return
    const onDoc = (e: MouseEvent) => {
      const el = moreTypeMenuRef.current
      if (el && !el.contains(e.target as Node)) setMoreTypeMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreTypeMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [moreTypeMenuOpen])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (
        e.key === 'frota.vehicles.registry' ||
        e.key === FLEET_STATUS_BY_PLACA_STORAGE_KEY ||
        e.key === FLEET_MANUTENCAO_BY_PLACA_STORAGE_KEY ||
        e.key === FLEET_OVERRIDE_BY_PLACA_STORAGE_KEY ||
        e.key === null
      ) {
        refresh()
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  useEffect(() => {
    if (!canRegisterVehicle && isModalOpen) {
      queueMicrotask(() => {
        setIsModalOpen(false)
        setEditingVehicleId(null)
        setFormData(defaultForm())
      })
    }
  }, [canRegisterVehicle, isModalOpen])

  /** Busca + tipo (barra superior); igual em grelha e em lista. */
  const globallyFilteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      const placaNorm = normalizePlaca(v.placa)
      const placaDisplay = formatPlaca(v.placa).toLowerCase()
      const modeloStr = String(v.modelo || '').toLowerCase()
      const prefixoStr = String(v.prefixo || '').toLowerCase()
      const baseStr = String(v.base || '').toLowerCase()
      const respStr = String(v.responsavel || '').toLowerCase()
      const searchStr = search.toLowerCase()
      const searchPlaca = normalizePlaca(search)
      const matchesSearch =
        !searchStr ||
        (searchPlaca ? placaNorm.includes(searchPlaca) : false) ||
        placaDisplay.includes(searchStr) ||
        modeloStr.includes(searchStr) ||
        prefixoStr.includes(searchStr) ||
        baseStr.includes(searchStr) ||
        respStr.includes(searchStr)
      const matchesType = filterType === 'ALL' || v.tipo === filterType
      return matchesSearch && matchesType
    })
  }, [vehicles, search, filterType])

  /** Filtros por coluna (lista) e filtro de apontamento (cards Atenção / Impedido). */
  const filteredVehicles = useMemo(() => {
    const fp = normalizePlaca(colFilterPlaca)
    const fm = colFilterModeloPrefixo.trim().toLowerCase()
    const fo = colFilterOrgResp.trim().toLowerCase()
    const fl = colFilterLocalBase.trim().toLowerCase()
    const fc = colFilterCoordSup.trim().toLowerCase()

    return globallyFilteredVehicles.filter((v) => {
      if (colFilterStatus === 'ATENÇÃO') {
        if (!placasComAtencao.has(normalizePlaca(v.placa))) return false
      } else if (colFilterStatus === 'IMPEDIDO') {
        if (!placasComImpedimento.has(normalizePlaca(v.placa))) return false
      } else if (colFilterStatus !== 'ALL' && v.status !== colFilterStatus) {
        return false
      }

      if (layoutMode !== 'list') return true

      if (fp && !normalizePlaca(v.placa).includes(fp)) return false
      if (fm) {
        const blob = `${v.modelo} ${v.prefixo}`.toLowerCase()
        if (!blob.includes(fm)) return false
      }
      if (fo && !String(v.responsavel || '').toLowerCase().includes(fo)) return false
      if (fl && !String(v.base || '').toLowerCase().includes(fl)) return false
      if (fc) {
        const blob = `${v.coordenador || ''} ${v.supervisor || ''}`.toLowerCase()
        if (!blob.includes(fc)) return false
      }
      return true
    })
  }, [
    globallyFilteredVehicles,
    layoutMode,
    colFilterPlaca,
    colFilterModeloPrefixo,
    colFilterOrgResp,
    colFilterLocalBase,
    colFilterCoordSup,
    colFilterStatus,
    placasComAtencao,
    placasComImpedimento,
  ])

  const filteredInactive = useMemo(
    () => filteredVehicles.filter((v) => v.status === 'INATIVO'),
    [filteredVehicles],
  )

  const [pagina, setPagina] = useState(1)
  // Grid: 24 (múltiplo de 3 colunas). Lista: 50.
  const pageSize = layoutMode === 'grid' ? 24 : 50
  const totalPaginas = Math.max(1, Math.ceil(filteredVehicles.length / pageSize))
  // Garante que a página não fique fora do intervalo quando filtros mudam
  const paginaSegura = Math.min(pagina, totalPaginas)
  const paginaVehicles = filteredVehicles.slice((paginaSegura - 1) * pageSize, paginaSegura * pageSize)
  const paginaActive = paginaVehicles.filter((v) => v.status !== 'INATIVO')
  const paginaInactive = paginaVehicles.filter((v) => v.status === 'INATIVO')

  const clearListColumnFilters = () => {
    setColFilterPlaca('')
    setColFilterModeloPrefixo('')
    setColFilterOrgResp('')
    setColFilterLocalBase('')
    setColFilterCoordSup('')
    setColFilterStatus('ALL')
    setPagina(1)
  }

  const applyApontamentoCardFilter = (filter: 'ATENÇÃO' | 'IMPEDIDO') => {
    setColFilterPlaca('')
    setColFilterModeloPrefixo('')
    setColFilterOrgResp('')
    setColFilterLocalBase('')
    setColFilterCoordSup('')
    setColFilterStatus((prev) => (prev === filter ? 'ALL' : filter))
    setPagina(1)
    setLayout('list')
    window.setTimeout(() => {
      fleetTableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  const listColFiltersActive = Boolean(
    colFilterPlaca.trim() ||
      colFilterModeloPrefixo.trim() ||
      colFilterOrgResp.trim() ||
      colFilterLocalBase.trim() ||
      colFilterCoordSup.trim() ||
      colFilterStatus !== 'ALL',
  )

  /** Totais da frota carregada (`getDisplayedFleetVehicles`). */
  const fleetStats = useMemo(
    () => ({
      total: vehicles.length,
      ativos: vehicles.filter(
        (v) => isOperacionalAtivosDashboardKpi(v.placa, v.prefixo, v.status),
      ).length,
      manutencao: vehicles.filter((v) => v.emManutencao).length,
    }),
    [vehicles],
  )

  /** Contagem por tipo (frota completa) para tooltip nos filtros. */
  const countByTipo = useMemo(() => {
    const m = new Map<VehicleTipo, number>()
    for (const id of VEHICLE_TYPE_IDS) m.set(id, 0)
    for (const v of vehicles) {
      m.set(v.tipo, (m.get(v.tipo) ?? 0) + 1)
    }
    return m
  }, [vehicles])

  /**
   * Totais exactos para a IA: o JSON detalhado (`fleetContextJson`) é truncado (~45k chars)
   * e pode omitir veículos; contagens devem usar sempre este bloco.
   */
  const fleetAiSummaryJson = useMemo(() => {
    const porTipo = {} as Record<VehicleTipo, number>
    for (const id of VEHICLE_TYPE_IDS) {
      porTipo[id] = countByTipo.get(id) ?? 0
    }
    return JSON.stringify({
      totalFrota: vehicles.length,
      porTipo,
      porStatus: {
        ativo: fleetStats.ativos,
        inativo: vehicles.filter((v) => v.status === 'INATIVO').length,
        emManutencao: fleetStats.manutencao,
      },
    })
  }, [vehicles, countByTipo, fleetStats])

  /** JSON compacto da frota para prompts (limite de tamanho para a API). */
  const fleetContextJson = useMemo(() => {
    const compact = vehicles.map((v) => ({
      placa: v.placa,
      modelo: v.modelo,
      tipo: v.tipo,
      status: v.status,
      prefixo: v.prefixo,
      base: v.base,
      responsavel: v.responsavel,
      ano: v.ano,
      source: v.source,
    }))
    const maxLen = 45_000
    let n = compact.length
    while (n > 0) {
      const s = JSON.stringify(compact.slice(0, n))
      if (s.length <= maxLen) return s
      n = Math.max(1, Math.floor(n * 0.85))
    }
    return '[]'
  }, [vehicles])

  const aiSuggestionSanitized = useMemo(() => {
    if (!aiAnalysis) return ''
    return sanitizeAiFleetSuggestionText(aiAnalysis)
  }, [aiAnalysis])

  const geminiConfigured = isGeminiConfigured()

  const inputFilterClass =
    'w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-center text-[11px] font-bold text-slate-900 outline-none placeholder:font-semibold placeholder:text-slate-400 focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500'
  const selectFilterClass =
    'w-full min-w-0 rounded-lg border border-slate-200 bg-white px-1.5 py-1.5 text-[10px] font-black uppercase tracking-tight text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white'
  const selectFilterCenterClass = `${selectFilterClass} text-center`

  const handleOpenModal = () => {
    if (!canRegisterVehicle) return
    setEditingVehicleId(null)
    setFormData(defaultForm())
    setIsModalOpen(true)
  }
  const handleOpenEditModal = (vehicle: FleetVehicle) => {
    if (!canRegisterVehicle) return
    setEditingVehicleId(vehicle.id)
    setFormData(vehicleToFormData(vehicle))
    setIsModalOpen(true)
  }
  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingVehicleId(null)
    setFormData(defaultForm())
  }

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type })
    window.setTimeout(() => setNotification(null), 3000)
  }

  const handleFleetAiAnalysis = async () => {
    if (!geminiConfigured) {
      showNotification('Configure VITE_GEMINI_API_KEY no .env para usar a análise IA.', 'error')
      return
    }
    setIsAiLoading(true)
    try {
      const prompt = `Resumo factual (fonte de verdade para totais e contagens por tipo; não contradigas estes números): ${fleetAiSummaryJson}\n\nAmostra detalhada da frota em JSON (pode estar truncada, só para contexto qualitativo): ${fleetContextJson}\n\nTarefa: analisa a frota PROC-A e apresenta **3 sugestões estratégicas** curtas e acionáveis.\n\nFormato (obrigatório):\n- Usa parágrafos curtos e listas com linhas começadas por "* " para cada ponto principal.\n- Não incluas JSON nem blocos de código (código entre três crases). Não repitas o resumo factual; se citares números, integra-os na frase.`

      const result = await askGemini(
        prompt,
        'És um analista de dados de logística. Para totais ou contagens, usa apenas totalFrota, porTipo e porStatus do resumo factual no início do prompt. Nunca incluas JSON, fences de código markdown nem dados em bruto na resposta ao utilizador — só texto útil. Português de Portugal, conciso e profissional.',
      )
      setAiAnalysis(result.ok ? result.text : 'Erro ao conectar com o serviço de inteligência. Tente novamente.')
    } catch {
      setAiAnalysis('Erro ao conectar com o serviço de inteligência. Tente novamente.')
      showNotification('Falha na análise IA.', 'error')
    } finally {
      setIsAiLoading(false)
    }
  }

  const handleChatSend = async () => {
    const trimmed = chatMessage.trim()
    if (!trimmed || isChatSending) return
    if (!geminiConfigured) {
      showNotification('Configure VITE_GEMINI_API_KEY no .env para usar o assistente.', 'error')
      return
    }
    setChatMessage('')
    setChatHistory((prev) => [...prev, { role: 'user', content: trimmed }])
    setIsChatSending(true)
    try {
      const prompt = `Resumo factual (fonte de verdade para totais e contagens; o JSON seguinte pode estar truncado): ${fleetAiSummaryJson}\n\nDetalhe parcial da frota (JSON): ${fleetContextJson}\n\nPergunta do utilizador: ${trimmed}`
      const response = await askGemini(
        prompt,
        'És o assistente FROTA AI. Responde de forma útil e educada em Português de Portugal. Para totais ou contagens por tipo ou estado, baseia-te exclusivamente em totalFrota, porTipo e porStatus do resumo factual; não contes veículos só pelo array detalhado.',
      )
      setChatHistory((prev) => [
        ...prev,
        { role: 'assistant', content: response.ok ? response.text : 'Desculpe, tive um problema técnico. Pode repetir?' },
      ])
    } catch {
      setChatHistory((prev) => [
        ...prev,
        { role: 'assistant', content: 'Desculpe, tive um problema técnico. Pode repetir?' },
      ])
    } finally {
      setIsChatSending(false)
    }
  }

  const setLayout = (mode: 'grid' | 'list') => {
    setLayoutMode(mode)
    setPagina(1)
    try {
      localStorage.setItem(LAYOUT_STORAGE_KEY, mode)
    } catch {
      /* ignore */
    }
  }

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    if (!canRegisterVehicle) return
    if (!formData.placa.trim() || !formData.modelo.trim()) {
      showNotification('Por favor, preencha placa e modelo.', 'error')
      return
    }
    const tipo = VEHICLE_TYPE_IDS.includes(formData.tipo as VehicleTipo) ? formData.tipo : 'VEICULOS LEVES'
    const payload = {
      placa: formData.placa,
      modelo: formData.modelo,
      tipo,
      prefixo: formData.prefixo,
      responsavel: formData.responsavel,
      supervisor: formData.supervisor,
      coordenador: formData.coordenador,
      base: formData.base,
      ano: formData.ano,
    }

    // Se estiver editando veículo do Supabase, atualiza lá; senão tenta adicionar no Supabase
    const editingSupabase = editingVehicleId
      ? supabaseVehicles.find((v) => v.id === editingVehicleId)
      : null

    const res = await saveVehicle(payload, editingSupabase?.id)
    if (!res.ok) {
      showNotification(res.message, 'error')
      return
    }

    await reloadSupabase()
    reloadFleet()
    showNotification(editingVehicleId ? 'Veículo atualizado com sucesso!' : 'Veículo cadastrado com sucesso!', 'success')
    handleCloseModal()
  }

  const isEditingVehicle = editingVehicleId !== null

  return (
    <div className="min-h-screen w-full min-w-0 bg-slate-50 pb-32 font-sans text-slate-900 dark:bg-slate-950 dark:text-slate-100 -mx-3 px-3 sm:-mx-4 sm:px-4 lg:-mx-8 lg:px-4 xl:px-6">
      {notification ? (
        <div
          className={`fixed top-6 right-6 z-[100] flex translate-x-0 items-center gap-3 rounded-2xl px-6 py-4 shadow-2xl transition-opacity duration-300 ${
            notification.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
          }`}
          role="status"
        >
          {notification.type === 'success' ? <Check size={20} /> : <AlertCircle size={20} />}
          <span className="text-sm font-bold">{notification.message}</span>
        </div>
      ) : null}

      <div className="w-full max-w-none space-y-8 pt-3 sm:pt-4 lg:pt-5">
        <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-black tracking-tight text-slate-800 dark:text-white">
              Frota <span className="text-blue-600">PROC-A</span>
            </h1>
            <p className="font-medium italic text-slate-500 dark:text-slate-400">Gestão centralizada de ativos e logística</p>
          </div>

          <div className="flex flex-wrap gap-3 self-start md:self-center">
            <button
              type="button"
              onClick={() => {
                void handleFleetAiAnalysis()
                setIsChatVisible(true)
                setIsChatCollapsed(false)
              }}
              disabled={isAiLoading || !geminiConfigured}
              title={
                geminiConfigured
                  ? 'Sugestões estratégicas com base na frota atual'
                  : 'Defina VITE_GEMINI_API_KEY no ficheiro .env'
              }
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 px-5 py-3 text-sm font-black text-indigo-700 transition-all hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-indigo-500/40 dark:bg-indigo-950/50 dark:text-indigo-200 dark:hover:bg-indigo-950/70"
            >
              {isAiLoading ? <Loader2 size={20} className="animate-spin" aria-hidden /> : <Sparkles size={20} aria-hidden />}
              Análise IA ✨
            </button>
            {canRegisterVehicle ? (
              <div data-tour="registro-actions" className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setImportRows([]); setImportResult(null); setImportModalOpen(true) }}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-black text-emerald-700 transition-all hover:bg-emerald-100 dark:border-emerald-700/40 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/70"
                >
                  <FileSpreadsheet size={18} />
                  Importar Excel
                </button>
                <button
                  type="button"
                  onClick={handleOpenModal}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-700 active:scale-95 dark:shadow-blue-900/30"
                >
                  <Plus size={20} strokeWidth={3} />
                  Novo veículo
                </button>
              </div>
            ) : null}
          </div>
        </header>

        {aiAnalysis ? (
          <div className="relative overflow-hidden rounded-3xl border border-indigo-200/90 bg-white shadow-xl dark:border-indigo-500/30 dark:bg-slate-900">
            <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-600 to-blue-700 px-5 py-4 dark:from-indigo-700 dark:to-blue-900">
              <div className="pointer-events-none absolute -right-8 -top-10 size-32 rounded-full bg-white/10 blur-2xl" aria-hidden />
              <div className="relative flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 shadow-lg shadow-indigo-950/20">
                    <BrainCircuit size={22} className="text-white" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-indigo-100/95">Sugestões</p>
                    <h2 className="mt-0.5 text-lg font-black tracking-tight text-white">Inteligência artificial</h2>
                    <p className="mt-1 max-w-xl text-xs font-semibold leading-snug text-indigo-100/85">
                      Análise com base nos totais da frota e numa amostra dos veículos — sem dados em bruto na resposta.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAiAnalysis(null)}
                  className="shrink-0 rounded-xl p-2 text-white/80 transition-colors hover:bg-white/15 hover:text-white"
                  aria-label="Fechar sugestões"
                >
                  <X size={20} strokeWidth={2.25} aria-hidden />
                </button>
              </div>
              <Sparkles className="pointer-events-none absolute -bottom-6 right-2 text-white/[0.12]" size={88} aria-hidden />
            </div>
            <div className="border-t border-slate-100 bg-slate-50/40 px-5 py-5 dark:border-slate-800 dark:bg-slate-950/40">
              {aiSuggestionSanitized ? (
                <div className="max-w-none text-slate-900 dark:text-slate-100">{renderFormattedText(aiSuggestionSanitized)}</div>
              ) : (
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                  Não foi possível apresentar o texto das sugestões. Gere a análise novamente.
                </p>
              )}
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4 md:gap-6">
          {(
            [
              {
                label: 'Total na frota',
                value: fleetStats.total,
                Icon: List,
                card:
                  'border-blue-200/90 bg-gradient-to-br from-white via-white to-blue-50/90 shadow-blue-500/[0.06] dark:border-blue-500/25 dark:from-slate-900 dark:via-slate-900 dark:to-blue-950/55 dark:shadow-blue-950/30',
                orb: 'bg-blue-400/25 dark:bg-blue-500/15',
                iconWrap:
                  'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-600/25 ring-2 ring-white/30 dark:from-blue-600 dark:to-blue-800 dark:shadow-blue-950/40 dark:ring-blue-400/20',
              },
              {
                label: 'Ativos',
                value: fleetStats.ativos,
                Icon: Check,
                card:
                  'border-emerald-200/90 bg-gradient-to-br from-white via-white to-emerald-50/90 shadow-emerald-500/[0.06] dark:border-emerald-500/25 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/40 dark:shadow-emerald-950/25',
                orb: 'bg-emerald-400/25 dark:bg-emerald-500/12',
                iconWrap:
                  'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-600/25 ring-2 ring-white/30 dark:from-emerald-600 dark:to-teal-800 dark:shadow-emerald-950/35 dark:ring-emerald-400/20',
              },
              {
                label: 'Precisam de atenção',
                value: apontamentosCarregando ? '—' : ncNaoImpeditivosPendentes,
                Icon: AlertCircle,
                filter: 'ATENÇÃO' as const,
                activeRing: 'ring-2 ring-amber-500/80 ring-offset-2 ring-offset-slate-950 dark:ring-amber-400/70',
                card:
                  'border-amber-200/90 bg-gradient-to-br from-white via-white to-amber-50/90 shadow-amber-500/[0.06] dark:border-amber-500/25 dark:from-slate-900 dark:via-slate-900 dark:to-amber-950/35 dark:shadow-amber-950/25',
                orb: 'bg-amber-400/25 dark:bg-amber-500/12',
                iconWrap:
                  'bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-600/25 ring-2 ring-white/30 dark:from-amber-600 dark:to-orange-800 dark:shadow-orange-950/35 dark:ring-amber-400/20',
              },
              {
                label: 'Com impedimento',
                value: apontamentosCarregando ? '—' : ncImpeditivosPendentes,
                Icon: Ban,
                filter: 'IMPEDIDO' as const,
                activeRing: 'ring-2 ring-rose-500/80 ring-offset-2 ring-offset-slate-950 dark:ring-rose-400/70',
                card:
                  'border-rose-200/90 bg-gradient-to-br from-white via-white to-rose-50/90 shadow-rose-500/[0.06] dark:border-rose-500/25 dark:from-slate-900 dark:via-slate-900 dark:to-rose-950/35 dark:shadow-rose-950/25',
                orb: 'bg-rose-400/25 dark:bg-rose-500/12',
                iconWrap:
                  'bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-lg shadow-rose-600/25 ring-2 ring-white/30 dark:from-rose-600 dark:to-red-800 dark:shadow-rose-950/35 dark:ring-rose-400/20',
              },
            ] satisfies {
              label: string
              value: number | string
              Icon: typeof List
              filter?: 'ATENÇÃO' | 'IMPEDIDO'
              activeRing?: string
              card: string
              orb: string
              iconWrap: string
            }[]
          ).map(({ label, value, Icon, filter, activeRing, card, orb, iconWrap }) => {
            const isCardFilterActive = filter != null && colFilterStatus === filter
            const CardTag = filter ? 'button' : 'div'
            return (
            <CardTag
              key={label}
              type={filter ? 'button' : undefined}
              onClick={filter ? () => applyApontamentoCardFilter(filter) : undefined}
              title={filter ? `Filtrar tabela: ${label.toLowerCase()}` : undefined}
              className={`group relative w-full overflow-hidden rounded-3xl border p-6 text-left shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${card} ${
                filter ? 'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50' : ''
              } ${isCardFilterActive && activeRing ? activeRing : ''}`}
            >
              <div
                className={`pointer-events-none absolute -left-12 -bottom-12 size-36 rounded-full opacity-40 blur-3xl transition-opacity duration-300 group-hover:opacity-70 ${orb}`}
                aria-hidden
              />
              <div
                className={`pointer-events-none absolute -right-10 -top-10 size-40 rounded-full blur-3xl transition-opacity duration-300 group-hover:opacity-90 ${orb}`}
                aria-hidden
              />
              <div className="relative flex w-full min-w-0 items-center gap-4">
                <div
                  className={`flex size-14 shrink-0 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-105 ${iconWrap}`}
                >
                  <Icon size={26} strokeWidth={2.25} aria-hidden />
                </div>
                <div className="min-w-0 flex-1 space-y-0.5 text-left">
                  <span className="block text-[11px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    {label}
                  </span>
                  <p className="text-4xl font-black tabular-nums tracking-tight text-slate-900 dark:text-white">{value}</p>
                </div>
              </div>
            </CardTag>
          )})}
        </div>

        {/* Link discreto para aba Removidos */}
        {canRegisterVehicle && (
          <div className="flex items-center justify-end">
            {activeTab === 'removidos' ? (
              <button
                type="button"
                onClick={() => setActiveTab('ativos')}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 transition-colors hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
              >
                <span>← Voltar para frota ativa</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setActiveTab('removidos')}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-400 transition-colors hover:text-rose-500 dark:text-slate-500 dark:hover:text-rose-400"
              >
                <span>Veículos removidos</span>
                {deletedVehicles.length > 0 && (
                  <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    {deletedVehicles.length}
                  </span>
                )}
              </button>
            )}
          </div>
        )}

        {/* Aba Removidos */}
        {activeTab === 'removidos' && canRegisterVehicle ? (
          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            {deletedVehicles.length === 0 ? (
              <div className="py-16 text-center text-sm font-semibold text-slate-400">Nenhum veículo removido.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/50">
                    <tr className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      <th className="px-5 py-3">Placa</th>
                      <th className="px-5 py-3">Tipo</th>
                      <th className="px-5 py-3">Modelo</th>
                      <th className="px-5 py-3">Base</th>
                      <th className="px-5 py-3">Removido em</th>
                      <th className="px-5 py-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {deletedVehicles.map((v) => (
                      <tr key={v.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/40">
                        <td className="px-5 py-3 font-extrabold text-slate-900 dark:text-slate-100">{v.placa}</td>
                        <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{v.tipo}</td>
                        <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{v.modelo}</td>
                        <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{v.base}</td>
                        <td className="px-5 py-3 text-xs text-slate-400">
                          {new Date(v.deletedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => void restoreVehicle(v.id).then((r) => {
                                if (!r.ok) showNotification(r.message, 'error')
                                else { showNotification(`${v.placa} restaurado com sucesso.`, 'success'); reloadFleet() }
                              })}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-extrabold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
                            >
                              <Check size={12} /> Restaurar
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmHardDelete({ id: v.id, placa: v.placa })}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-extrabold text-rose-600 hover:bg-rose-100 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-400"
                            >
                              <X size={12} /> Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}

        {activeTab === 'ativos' ? (<>
        <div className="flex min-w-0 flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            {/*
              O painel do "Mais" não pode ficar dentro de `overflow-x-auto` (recorte vertical).
              A área rolável não usa flex-1: se cresce, cria um vão grande entre o último chip e "Mais".
              Com `max-w-full shrink` ela só ocupa a largura dos chips até o limite do pai e encolhe se necessário.
            */}
            <div className="flex min-w-0 w-full items-center gap-2 sm:w-0 sm:min-w-0 sm:flex-1">
              <div
                className="no-scrollbar max-w-full min-w-0 shrink overflow-x-auto scroll-smooth"
                role="toolbar"
                aria-label="Filtrar por tipo de veículo"
              >
                <div className="flex w-max items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMoreTypeMenuOpen(false)
                      setFilterType('ALL')
                    }}
                    title={`${vehicles.length} ${vehicles.length === 1 ? 'veículo' : 'veículos'} na frota (todos os tipos)`}
                    className={`inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-xl px-4 text-sm font-bold transition-all ${
                      filterType === 'ALL'
                        ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                        : `${TYPE_FILTER_IDLE}`
                    }`}
                  >
                    Todos
                  </button>
                  {VEHICLE_TYPES_TOOLBAR_MAIN.map((type) => {
                    const Icon = type.icon
                    const active = filterType === type.id
                    const n = countByTipo.get(type.id) ?? 0
                    const title = `${n} ${n === 1 ? 'veículo' : 'veículos'} — ${type.label}`
                    return (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => {
                          setMoreTypeMenuOpen(false)
                          setFilterType(type.id)
                        }}
                        title={title}
                        aria-label={title}
                        className={`inline-flex h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-bold transition-all ${
                          active ? type.pillActive : TYPE_FILTER_IDLE
                        }`}
                      >
                        <Icon size={14} strokeWidth={2.5} className="shrink-0" aria-hidden />
                        {type.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="relative shrink-0" ref={moreTypeMenuRef}>
                <button
                  type="button"
                  id="filtro-tipo-mais"
                  aria-expanded={moreTypeMenuOpen}
                  aria-haspopup="menu"
                  aria-controls="menu-filtro-tipo-mais"
                  onClick={() => setMoreTypeMenuOpen((o) => !o)}
                  title={
                    filterType === 'OFICINA' || filterType === 'MOTOPODA'
                      ? `${VEHICLE_TYPES.find((t) => t.id === filterType)?.label ?? ''} — ${countByTipo.get(filterType) ?? 0} veículos`
                      : 'Mais tipos de veículo'
                  }
                  className={`inline-flex h-10 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-4 text-sm font-bold transition-all ${
                    filterType === 'OFICINA' || filterType === 'MOTOPODA'
                      ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                      : moreTypeMenuOpen
                        ? 'bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-white'
                        : TYPE_FILTER_IDLE
                  }`}
                >
                  <span>Mais</span>
                  <ChevronDown
                    size={15}
                    strokeWidth={2.5}
                    aria-hidden
                    className={`shrink-0 opacity-70 transition-transform duration-200 ${moreTypeMenuOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {moreTypeMenuOpen ? (
                  <div
                    id="menu-filtro-tipo-mais"
                    role="menu"
                    aria-labelledby="filtro-tipo-mais"
                    className="anim-dropdown-in absolute left-0 top-[calc(100%+0.375rem)] z-[100] min-w-[14rem] rounded-xl border border-slate-200/90 bg-white p-1.5 shadow-lg shadow-slate-900/10 ring-1 ring-slate-900/[0.04] dark:border-slate-600/80 dark:bg-slate-900 dark:shadow-black/40 dark:ring-white/[0.06]"
                  >
                    {VEHICLE_TYPES_TOOLBAR_MORE.map((type) => {
                      const Icon = type.icon
                      const active = filterType === type.id
                      const n = countByTipo.get(type.id) ?? 0
                      const labelCount = `${n} ${n === 1 ? 'veículo' : 'veículos'}`
                      return (
                        <button
                          key={type.id}
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setFilterType(type.id)
                            setMoreTypeMenuOpen(false)
                          }}
                          className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-bold transition-colors ${
                            active
                              ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
                              : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/80'
                          }`}
                        >
                          <Icon size={16} strokeWidth={2.5} aria-hidden className={`shrink-0 ${type.color}`} />
                          <span className="min-w-0 flex-1">{type.label}</span>
                          <span className="shrink-0 text-[11px] font-semibold tabular-nums text-slate-400 dark:text-slate-500">
                            {labelCount}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            </div>

            <div
              className="flex h-10 shrink-0 items-center justify-center gap-0.5 self-center rounded-xl bg-slate-100 p-0.5 dark:bg-slate-800 sm:self-auto"
              role="group"
              aria-label="Modo de exibição"
            >
              <button
                type="button"
                onClick={() => setLayout('list')}
                aria-pressed={layoutMode === 'list'}
                title="Lista"
                className={`inline-flex size-9 items-center justify-center rounded-lg transition-all ${
                  layoutMode === 'list' ? 'bg-white text-blue-600 shadow-sm dark:bg-slate-900 dark:text-blue-400' : 'text-slate-500'
                }`}
              >
                <List size={18} strokeWidth={2.5} aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => setLayout('grid')}
                aria-pressed={layoutMode === 'grid'}
                title="Grelha"
                className={`inline-flex size-9 items-center justify-center rounded-lg transition-all ${
                  layoutMode === 'grid' ? 'bg-white text-blue-600 shadow-sm dark:bg-slate-900 dark:text-blue-400' : 'text-slate-500'
                }`}
              >
                <LayoutGrid size={18} strokeWidth={2.5} aria-hidden />
              </button>
            </div>
          </div>

          <div className="group relative w-full min-w-0">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-blue-500"
              aria-hidden
            />
            <input
              type="text"
              placeholder="Pesquisar por placa ou modelo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl border border-slate-100 bg-slate-50 py-3 pl-12 pr-4 text-sm font-semibold text-slate-900 outline-none transition-all focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800/80 dark:text-white"
            />
          </div>
        </div>

      {filteredVehicles.length > 0 && layoutMode === 'grid' ? (
        <>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {paginaActive.map((vehicle) => {
            const typeInfo =
              VEHICLE_TYPES.find((t) => t.id === vehicle.tipo) ??
              VEHICLE_TYPES.find((t) => t.id === 'VEICULOS LEVES')!
            const Icon = typeInfo.icon

            const placaNorm = normalizePlaca(vehicle.placa)
            const comImpedimento = placasComImpedimento.has(placaNorm)
            const precisaAtencao = placasComAtencao.has(placaNorm)

            return (
              <div
                key={vehicle.id}
                className={`group relative overflow-hidden rounded-3xl border p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-xl ${
                  comImpedimento
                    ? 'border-rose-300 bg-rose-50 hover:border-rose-400 hover:shadow-rose-200/40 dark:border-rose-800/60 dark:bg-rose-950/25 dark:hover:border-rose-700'
                    : precisaAtencao
                    ? 'border-amber-200 bg-amber-50 hover:border-amber-300 hover:shadow-amber-200/40 dark:border-amber-900/50 dark:bg-amber-950/20 dark:hover:border-amber-800'
                    : vehicle.status === 'INATIVO'
                    ? 'border-slate-300 bg-slate-100 hover:border-slate-400 hover:shadow-slate-200/40 dark:border-slate-700 dark:bg-slate-900/60 dark:hover:border-slate-600'
                    : 'border-slate-200 bg-white hover:border-blue-200 hover:shadow-blue-600/10 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-800'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className={`rounded-2xl bg-slate-50 p-3 dark:bg-slate-800 ${typeInfo.color}`}>
                    <Icon size={24} />
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {vehicle.source === 'total' ? (
                      <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                        BASE
                      </span>
                    ) : null}
                    <div
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${
                        vehicle.status === 'ATIVO'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                          : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {vehicle.status === 'ATIVO' ? <CheckCircle2 size={11} /> : <Ban size={11} />}
                      {vehicle.status}
                    </div>
                    {comImpedimento && <ImpedidoBadge />}
                    {precisaAtencao && <AttentionBadge />}
                  </div>
                </div>

                <div className="mt-5 space-y-1">
                  <h3 className="text-xl font-black uppercase leading-none tracking-tight text-slate-900 dark:text-white">
                    {formatPlaca(vehicle.placa)}
                  </h3>
                  <p className="text-sm font-bold uppercase text-slate-500 dark:text-slate-400">
                    {vehicle.modelo} • {vehicle.prefixo}
                  </p>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Responsável</span>
                    <p className="truncate text-xs font-bold uppercase text-slate-700 dark:text-slate-300">{vehicle.responsavel}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Base</span>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{vehicle.base}</p>
                  </div>
                  {(vehicle.coordenador && vehicle.coordenador !== 'NÃO ATRIBUÍDO') || (vehicle.supervisor && vehicle.supervisor !== 'NÃO ATRIBUÍDO') ? (
                    <div className="col-span-2 space-y-1 border-t border-slate-100 pt-3 dark:border-slate-800">
                      <div className="flex gap-4">
                        {vehicle.coordenador && vehicle.coordenador !== 'NÃO ATRIBUÍDO' && (
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Gerência</span>
                            <p className="truncate text-xs font-bold uppercase text-slate-700 dark:text-slate-300">{vehicle.coordenador}</p>
                          </div>
                        )}
                        {vehicle.supervisor && vehicle.supervisor !== 'NÃO ATRIBUÍDO' && (
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Supervisor</span>
                            <p className="truncate text-xs font-bold uppercase text-slate-700 dark:text-slate-300">{vehicle.supervisor}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="absolute bottom-4 right-4">
                  <VehicleOverflowMenu
                    vehicle={vehicle}
                    menuForId={menuForId}
                    setMenuForId={setMenuForId}
                    refresh={refresh}
                    reloadFleet={reloadFleet}
                    showNotification={showNotification}
                    placement="up"
                    isAdmin={canRegisterVehicle}
                    onEdit={canRegisterVehicle ? handleOpenEditModal : undefined}
                    supabaseVehicleIds={supabaseVehicleIds}
                    onDeleteRequest={(id, placa, isSup) => setConfirmDelete({ id, placa, isSupabase: isSup })}
                    setStatus={setStatus}
                  />
                </div>
              </div>
            )
          })}
        </div>
        {paginaInactive.length > 0 && (
          <>
            <div className="mt-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-4 py-1.5 dark:border-slate-700 dark:bg-slate-800">
                <Ban size={12} className="text-slate-400" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Inativos — {filteredInactive.length}
                </span>
              </div>
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
            </div>
            <div className="mt-4 grid gap-4 opacity-60 md:grid-cols-2 lg:grid-cols-3">
              {paginaInactive.map((vehicle) => {
                const typeInfo =
                  VEHICLE_TYPES.find((t) => t.id === vehicle.tipo) ??
                  VEHICLE_TYPES.find((t) => t.id === 'VEICULOS LEVES')!
                const Icon = typeInfo.icon
                return (
                  <div
                    key={vehicle.id}
                    className="relative flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:opacity-100 dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="flex items-start justify-between">
                      <div className={`inline-flex rounded-2xl bg-slate-100 p-3 dark:bg-slate-800 ${typeInfo.color}`}>
                        <Icon size={22} />
                      </div>
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <div className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                          <Ban size={11} />
                          INATIVO
                        </div>
                        <VehicleOverflowMenu
                          vehicle={vehicle}
                          menuForId={menuForId}
                          setMenuForId={setMenuForId}
                          refresh={refresh}
                          reloadFleet={reloadFleet}
                          showNotification={showNotification}
                          placement="up"
                          isAdmin={canRegisterVehicle}
                          onEdit={canRegisterVehicle ? handleOpenEditModal : undefined}
                          supabaseVehicleIds={supabaseVehicleIds}
                          onDeleteRequest={(id, placa, isSup) => setConfirmDelete({ id, placa, isSupabase: isSup })}
                          setStatus={setStatus}
                        />
                      </div>
                    </div>
                    <div className="mt-5 space-y-1">
                      <h3 className="text-xl font-black uppercase leading-none tracking-tight text-slate-900 dark:text-white">
                        {formatPlaca(vehicle.placa)}
                      </h3>
                      <p className="text-sm font-bold uppercase text-slate-500 dark:text-slate-400">
                        {vehicle.modelo} • {vehicle.prefixo}
                      </p>
                    </div>
                    <div className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                      <div className="space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Responsável</span>
                        <p className="truncate text-xs font-bold uppercase text-slate-700 dark:text-slate-300">{vehicle.responsavel}</p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Base</span>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{vehicle.base}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
        {totalPaginas > 1 && (
          <PaginationBar
            pagina={paginaSegura}
            totalPaginas={totalPaginas}
            total={filteredVehicles.length}
            pageSize={pageSize}
            onChange={setPagina}
          />
        )}
        </>
      ) : null}

      {layoutMode === 'list' ? (
        <div
          ref={fleetTableRef}
          className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <table className="w-full min-w-[720px] border-collapse text-center text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Placa</th>
                <th className="px-4 py-3">Modelo / Prefixo</th>
                <th className="hidden px-4 py-3 md:table-cell">Responsável</th>
                <th className="hidden px-4 py-3 lg:table-cell">Local / Base</th>
                <th className="hidden px-4 py-3 xl:table-cell">Coord. / Sup.</th>
                <th className="px-4 py-3">Estado</th>
                <th scope="col" className="w-12 px-2 py-3 pr-4 text-right">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
              <tr className="border-b border-slate-200 bg-slate-100/90 dark:border-slate-800 dark:bg-slate-900/90">
                <th className="px-2 py-2 align-top">
                  <label className="sr-only" htmlFor="flt-tipo-col">
                    Filtrar por tipo
                  </label>
                  <select
                    id="flt-tipo-col"
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value as 'ALL' | VehicleTipo)}
                    className={selectFilterCenterClass}
                  >
                    <option value="ALL">Todos</option>
                    {VEHICLE_TYPES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </th>
                <th className="px-2 py-2 align-top">
                  <label className="sr-only" htmlFor="flt-placa-col">
                    Filtrar por placa
                  </label>
                  <input
                    id="flt-placa-col"
                    type="text"
                    value={colFilterPlaca}
                    onChange={(e) => setColFilterPlaca(e.target.value)}
                    placeholder="Placa…"
                    className={inputFilterClass}
                  />
                </th>
                <th className="px-2 py-2 align-top">
                  <label className="sr-only" htmlFor="flt-mod-col">
                    Filtrar modelo ou prefixo
                  </label>
                  <input
                    id="flt-mod-col"
                    type="text"
                    value={colFilterModeloPrefixo}
                    onChange={(e) => setColFilterModeloPrefixo(e.target.value)}
                    placeholder="Modelo / prefixo…"
                    className={inputFilterClass}
                  />
                </th>
                <th className="hidden px-2 py-2 align-top md:table-cell">
                  <label className="sr-only" htmlFor="flt-org-col">
                    Filtrar responsável
                  </label>
                  <input
                    id="flt-org-col"
                    type="text"
                    value={colFilterOrgResp}
                    onChange={(e) => setColFilterOrgResp(e.target.value)}
                    placeholder="Responsável…"
                    className={inputFilterClass}
                  />
                </th>
                <th className="hidden px-2 py-2 align-top lg:table-cell">
                  <label className="sr-only" htmlFor="flt-loc-col">
                    Filtrar local ou base
                  </label>
                  <input
                    id="flt-loc-col"
                    type="text"
                    value={colFilterLocalBase}
                    onChange={(e) => setColFilterLocalBase(e.target.value)}
                    placeholder="Local / base…"
                    className={inputFilterClass}
                  />
                </th>
                <th className="hidden px-2 py-2 align-top xl:table-cell">
                  <label className="sr-only" htmlFor="flt-coord-col">
                    Filtrar coordenador ou supervisor
                  </label>
                  <input
                    id="flt-coord-col"
                    type="text"
                    value={colFilterCoordSup}
                    onChange={(e) => setColFilterCoordSup(e.target.value)}
                    placeholder="Coord. / sup.…"
                    className={inputFilterClass}
                  />
                </th>
                <th className="px-2 py-2 align-top">
                  <label className="sr-only" htmlFor="flt-status-col">
                    Filtrar por estado
                  </label>
                  <select
                    id="flt-status-col"
                    value={colFilterStatus}
                    onChange={(e) => setColFilterStatus(e.target.value as 'ALL' | VehicleStatus | 'ATENÇÃO' | 'IMPEDIDO')}
                    className={selectFilterCenterClass}
                  >
                    <option value="ALL">Todos</option>
                    <option value="ATIVO">Ativo</option>
                    <option value="INATIVO">Inativo</option>
                    <option value="ATENÇÃO">Atenção</option>
                    <option value="IMPEDIDO">Impedido</option>
                  </select>
                </th>
                <th className="px-2 py-2 pr-4 text-right align-top">
                  <button
                    type="button"
                    onClick={clearListColumnFilters}
                    disabled={!listColFiltersActive}
                    title="Limpar filtros desta linha"
                    className="inline-flex size-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-white hover:text-slate-900 disabled:pointer-events-none disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
                  >
                    <X size={16} strokeWidth={2.5} aria-hidden />
                    <span className="sr-only">Limpar filtros da tabela</span>
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredVehicles.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-14 text-center">
                    <p className="text-base font-bold text-slate-600 dark:text-slate-300">Nenhum veículo com estes critérios.</p>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                      {globallyFilteredVehicles.length === 0
                        ? 'Ajuste a busca ou o tipo de veículo na barra acima.'
                        : 'Os filtros por coluna estão a excluir todos os resultados. Limpe-os com o botão no fim da linha de filtros.'}
                    </p>
                    {listColFiltersActive ? (
                      <button
                        type="button"
                        onClick={clearListColumnFilters}
                        className="mt-5 inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-black uppercase tracking-wide text-white shadow-md hover:bg-blue-700"
                      >
                        Limpar filtros da tabela
                      </button>
                    ) : null}
                  </td>
                </tr>
              ) : (
                <>
                {paginaActive.map((vehicle) => {
                  const typeInfo =
                    VEHICLE_TYPES.find((t) => t.id === vehicle.tipo) ??
                    VEHICLE_TYPES.find((t) => t.id === 'VEICULOS LEVES')!
                  const Icon = typeInfo.icon
                  const placaNorm = normalizePlaca(vehicle.placa)
                  const comImpedimento = placasComImpedimento.has(placaNorm)
                  const precisaAtencao = placasComAtencao.has(placaNorm)

                  return (
                    <tr
                      key={vehicle.id}
                      className={`border-b transition-colors ${
                        comImpedimento
                          ? 'border-rose-200 bg-rose-50/70 hover:bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/25 dark:hover:bg-rose-950/35'
                          : precisaAtencao
                          ? 'border-amber-200 bg-amber-50/60 hover:bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20 dark:hover:bg-amber-950/30'
                          : vehicle.status === 'INATIVO'
                          ? 'border-slate-200 bg-slate-100/60 hover:bg-slate-100 dark:border-slate-800/80 dark:bg-slate-900/40 dark:hover:bg-slate-800/40'
                          : 'border-slate-100 hover:bg-slate-50/80 dark:border-slate-800/80 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="px-4 py-3 align-middle">
                        <div className="flex justify-center">
                          <button
                            type="button"
                            onClick={() => goToGerenciarVeiculo(vehicle)}
                            title={`Gerenciar apontamentos — ${formatPlaca(vehicle.placa)}`}
                            aria-label={`Gerenciar apontamentos do veículo ${formatPlaca(vehicle.placa)}`}
                            className={`inline-flex rounded-xl bg-slate-100 p-2 transition-colors hover:bg-blue-100 hover:ring-2 hover:ring-blue-500/30 dark:bg-slate-800 dark:hover:bg-blue-950/50 ${typeInfo.color}`}
                          >
                            <Icon size={20} />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <span className="font-mono text-sm font-black uppercase text-slate-900 dark:text-white">{formatPlaca(vehicle.placa)}</span>
                      </td>
                      <td className="max-w-[220px] px-4 py-3 align-middle">
                        <div className="mx-auto max-w-full truncate text-xs font-bold uppercase text-slate-600 dark:text-slate-300">
                          {vehicle.modelo} • {vehicle.prefixo}
                        </div>
                      </td>
                      <td className="hidden max-w-[160px] px-4 py-3 align-middle md:table-cell">
                        <span className="mx-auto block max-w-full truncate text-xs font-bold uppercase text-slate-700 dark:text-slate-300">
                          {vehicle.responsavel}
                        </span>
                      </td>
                      <td className="hidden max-w-[160px] px-4 py-3 align-middle lg:table-cell">
                        <span className="mx-auto block max-w-full truncate text-xs font-bold text-slate-700 dark:text-slate-300">{vehicle.base}</span>
                      </td>
                      <td className="hidden px-4 py-3 align-middle xl:table-cell">
                        <div className="flex flex-col items-center gap-1 text-center">
                          {vehicle.coordenador && vehicle.coordenador !== 'NÃO ATRIBUÍDO' && (
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Coord.</span>
                              <span className="max-w-[160px] truncate text-xs font-bold uppercase text-slate-700 dark:text-slate-300">{vehicle.coordenador}</span>
                            </div>
                          )}
                          {vehicle.supervisor && vehicle.supervisor !== 'NÃO ATRIBUÍDO' && (
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Sup.</span>
                              <span className="max-w-[160px] truncate text-xs font-bold uppercase text-slate-700 dark:text-slate-300">{vehicle.supervisor}</span>
                            </div>
                          )}
                          {(!vehicle.coordenador || vehicle.coordenador === 'NÃO ATRIBUÍDO') && (!vehicle.supervisor || vehicle.supervisor === 'NÃO ATRIBUÍDO') && (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <div className="flex flex-wrap items-center justify-center gap-1.5">
                          {vehicle.source === 'total' ? (
                            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                              BASE
                            </span>
                          ) : null}
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest ${
                              vehicle.status === 'ATIVO'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                                : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                            }`}
                          >
                            {vehicle.status === 'ATIVO' ? <CheckCircle2 size={10} /> : <Ban size={10} />}
                            {vehicle.status}
                          </span>
                          {comImpedimento && <ImpedidoBadge compact />}
                          {precisaAtencao && <AttentionBadge compact />}
                        </div>
                      </td>
                      <td className="relative px-2 py-3 pr-4 text-right align-middle">
                        <VehicleOverflowMenu
                          vehicle={vehicle}
                          menuForId={menuForId}
                          setMenuForId={setMenuForId}
                          refresh={refresh}
                          reloadFleet={reloadFleet}
                          showNotification={showNotification}
                          placement="down"
                          isAdmin={canRegisterVehicle}
                          onEdit={canRegisterVehicle ? handleOpenEditModal : undefined}
                          supabaseVehicleIds={supabaseVehicleIds}
                          onDeleteRequest={(id, placa, isSup) => setConfirmDelete({ id, placa, isSupabase: isSup })}
                          setStatus={setStatus}
                        />
                      </td>
                    </tr>
                  )
                })}
                {paginaInactive.length > 0 && (
                  <>
                    <tr>
                      <td colSpan={8} className="border-b border-slate-200 bg-slate-100/80 px-4 py-2 dark:border-slate-700 dark:bg-slate-800/60">
                        <div className="flex items-center gap-2">
                          <Ban size={13} className="text-slate-400" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                            Inativos — {filteredInactive.length}
                          </span>
                        </div>
                      </td>
                    </tr>
                    {paginaInactive.map((vehicle) => {
                      const typeInfo =
                        VEHICLE_TYPES.find((t) => t.id === vehicle.tipo) ??
                        VEHICLE_TYPES.find((t) => t.id === 'VEICULOS LEVES')!
                      const Icon = typeInfo.icon
                      return (
                        <tr
                          key={vehicle.id}
                          className="border-b border-slate-200 bg-slate-100/60 opacity-70 transition-colors hover:bg-slate-100 hover:opacity-100 dark:border-slate-800/80 dark:bg-slate-900/40 dark:hover:bg-slate-800/40"
                        >
                          <td className="px-4 py-3 align-middle">
                            <div className="flex justify-center">
                              <button
                                type="button"
                                onClick={() => goToGerenciarVeiculo(vehicle)}
                                title={`Gerenciar apontamentos — ${formatPlaca(vehicle.placa)}`}
                                aria-label={`Gerenciar apontamentos do veículo ${formatPlaca(vehicle.placa)}`}
                                className={`inline-flex rounded-xl bg-slate-100 p-2 transition-colors hover:bg-blue-100 hover:ring-2 hover:ring-blue-500/30 dark:bg-slate-800 dark:hover:bg-blue-950/50 ${typeInfo.color}`}
                              >
                                <Icon size={20} />
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3 align-middle">
                            <span className="font-mono text-sm font-black uppercase text-slate-900 dark:text-white">{formatPlaca(vehicle.placa)}</span>
                          </td>
                          <td className="max-w-[220px] px-4 py-3 align-middle">
                            <div className="mx-auto max-w-full truncate text-xs font-bold uppercase text-slate-600 dark:text-slate-300">
                              {vehicle.modelo} • {vehicle.prefixo}
                            </div>
                          </td>
                          <td className="hidden max-w-[160px] px-4 py-3 align-middle md:table-cell">
                            <span className="mx-auto block max-w-full truncate text-xs font-bold uppercase text-slate-700 dark:text-slate-300">
                              {vehicle.responsavel}
                            </span>
                          </td>
                          <td className="hidden max-w-[160px] px-4 py-3 align-middle lg:table-cell">
                            <span className="mx-auto block max-w-full truncate text-xs font-bold text-slate-700 dark:text-slate-300">{vehicle.base}</span>
                          </td>
                          <td className="hidden px-4 py-3 align-middle xl:table-cell">
                            <div className="flex flex-col items-center gap-1 text-center">
                              {vehicle.coordenador && vehicle.coordenador !== 'NÃO ATRIBUÍDO' && (
                                <div className="flex flex-col items-center gap-0.5">
                                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Coord.</span>
                                  <span className="max-w-[160px] truncate text-xs font-bold uppercase text-slate-700 dark:text-slate-300">{vehicle.coordenador}</span>
                                </div>
                              )}
                              {vehicle.supervisor && vehicle.supervisor !== 'NÃO ATRIBUÍDO' && (
                                <div className="flex flex-col items-center gap-0.5">
                                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Sup.</span>
                                  <span className="max-w-[160px] truncate text-xs font-bold uppercase text-slate-700 dark:text-slate-300">{vehicle.supervisor}</span>
                                </div>
                              )}
                              {(!vehicle.coordenador || vehicle.coordenador === 'NÃO ATRIBUÍDO') && (!vehicle.supervisor || vehicle.supervisor === 'NÃO ATRIBUÍDO') && (
                                <span className="text-xs text-slate-400">—</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 align-middle">
                            <div className="flex flex-wrap items-center justify-center gap-1.5">
                              <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                <Ban size={10} />
                                INATIVO
                              </span>
                            </div>
                          </td>
                          <td className="relative px-2 py-3 pr-4 text-right align-middle">
                            <VehicleOverflowMenu
                              vehicle={vehicle}
                              menuForId={menuForId}
                              setMenuForId={setMenuForId}
                              refresh={refresh}
                              reloadFleet={reloadFleet}
                              showNotification={showNotification}
                              placement="down"
                              isAdmin={canRegisterVehicle}
                              onEdit={canRegisterVehicle ? handleOpenEditModal : undefined}
                              supabaseVehicleIds={supabaseVehicleIds}
                              onDeleteRequest={(id, placa, isSup) => setConfirmDelete({ id, placa, isSupabase: isSup })}
                              setStatus={setStatus}
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </>
                )}
                </>
              )}
            </tbody>
          </table>
          {totalPaginas > 1 && (
            <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800">
              <PaginationBar
                pagina={paginaSegura}
                totalPaginas={totalPaginas}
                total={filteredVehicles.length}
                pageSize={pageSize}
                onChange={setPagina}
              />
            </div>
          )}
        </div>
      ) : null}

      {filteredVehicles.length === 0 && layoutMode === 'grid' ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white py-20 text-slate-400 dark:border-slate-600 dark:bg-slate-900/50">
          <div className="mb-4 inline-flex h-20 w-20 items-center justify-center rounded-full bg-slate-50 text-slate-300 dark:bg-slate-800">
            <Search size={40} strokeWidth={1.5} />
          </div>
          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">Nenhum veículo encontrado</h3>
          <p className="mt-1 text-slate-500 dark:text-slate-400">Tente ajustar os filtros ou o termo de pesquisa.</p>
        </div>
      ) : null}
        </>) : null /* fim aba ativos */}

      {canRegisterVehicle && isModalOpen ? (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm dark:bg-black/70"
            onClick={handleCloseModal}
            role="presentation"
          />

          <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-[2.5rem] bg-white shadow-2xl dark:bg-slate-900">
            <header className="flex items-center justify-between border-b border-slate-50 p-8 dark:border-slate-800">
              <div>
                <h2 className="text-2xl font-black text-slate-800 dark:text-white">
                  {isEditingVehicle ? 'Editar veículo' : 'Novo registro'}
                </h2>
                <p className="mt-0.5 text-sm font-medium text-slate-400">
                  {isEditingVehicle
                    ? 'Atualize os dados do ativo na frota PROC-A'
                    : 'Adicione um novo ativo à frota PROC-A'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
              >
                <X size={20} />
              </button>
            </header>

            <form onSubmit={handleSave} className="space-y-5 p-8 pt-6">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Placa</label>
                  <div className="relative">
                    <Tag className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      required
                      readOnly={isEditingVehicle}
                      className={`w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 text-sm font-bold uppercase text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white ${
                        isEditingVehicle ? 'cursor-not-allowed opacity-70' : ''
                      }`}
                      placeholder="ABC-1234"
                      value={formatPlaca(formData.placa)}
                      onChange={(e) => setFormData({ ...formData, placa: normalizePlaca(e.target.value) })}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Tipo de Veículo</label>
                  <select
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 px-4 text-sm font-bold text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    value={formData.tipo}
                    onChange={(e) => setFormData({ ...formData, tipo: e.target.value as VehicleTipo })}
                  >
                    {VEHICLE_TYPES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Modelo / Marca</label>
                <div className="relative">
                  <Truck className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 text-sm font-bold text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    placeholder="Ex: Toyota Hilux"
                    value={formData.modelo}
                    onChange={(e) => setFormData({ ...formData, modelo: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Prefixo</label>
                  <input
                    type="text"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3.5 text-sm font-bold uppercase text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    placeholder="Ex: STI302"
                    value={formData.prefixo}
                    onChange={(e) => setFormData({ ...formData, prefixo: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Ano</label>
                  <div className="relative">
                    <Calendar className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="number"
                      min={1980}
                      max={2100}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 text-sm font-bold text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      value={formData.ano}
                      onChange={(e) => setFormData({ ...formData, ano: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Responsável</label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 text-sm font-bold text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      placeholder="Nome do condutor"
                      value={formData.responsavel}
                      onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Base</label>
                  <div className="relative">
                    <MapPin className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 text-sm font-bold uppercase text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      placeholder="PDS / STI"
                      value={formData.base}
                      onChange={(e) => setFormData({ ...formData, base: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Supervisor</label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 text-sm font-bold text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      placeholder="Nome do supervisor"
                      value={formData.supervisor}
                      onChange={(e) => setFormData({ ...formData, supervisor: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Gerência</label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 text-sm font-bold text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      placeholder="Nome do coordenador"
                      value={formData.coordenador}
                      onChange={(e) => setFormData({ ...formData, coordenador: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-6">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 rounded-2xl border border-slate-200 py-4 text-sm font-black text-slate-500 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                >
                  Descartar
                </button>
                <button
                  type="submit"
                  className="flex-[1.5] rounded-2xl bg-blue-600 py-4 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-700 active:scale-95"
                >
                  {isEditingVehicle ? 'Guardar alterações' : 'Salvar veículo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      </div>

      {isChatVisible && (
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[90] flex justify-end p-3 pb-4 md:p-4 md:pb-5">
        <div className="pointer-events-auto flex w-full max-w-[17rem] flex-col sm:max-w-xs md:max-w-sm">
          {isChatCollapsed ? (
            <button
              type="button"
              onClick={() => setIsChatCollapsed(false)}
              className="flex w-full items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-blue-600 px-3 py-2 text-left text-white shadow-xl transition-colors hover:bg-blue-700 dark:border-slate-700 dark:bg-blue-700 dark:hover:bg-blue-600"
              aria-label="Expandir chat FROTA Assistant"
            >
              <div className="flex min-w-0 items-center gap-1.5">
                <div className="shrink-0 rounded-lg bg-white/20 p-1.5">
                  <BrainCircuit size={15} aria-hidden />
                </div>
                <span className="truncate text-xs font-bold tracking-tight">FROTA Assistant ✨</span>
              </div>
              <ChevronUp size={17} className="shrink-0 opacity-90" aria-hidden />
            </button>
          ) : (
            <div className="flex h-[min(26rem,65vh)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
              <div className="flex shrink-0 items-center justify-between gap-2 bg-blue-600 px-3 py-2.5 text-white dark:bg-blue-700">
                <div className="flex min-w-0 items-center gap-1.5">
                  <div className="shrink-0 rounded-lg bg-white/20 p-1.5">
                    <BrainCircuit size={15} aria-hidden />
                  </div>
                  <span className="truncate text-xs font-bold">FROTA Assistant ✨</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setIsChatCollapsed(true)}
                    className="shrink-0 rounded-lg p-1.5 text-white/85 transition-colors hover:bg-white/15 hover:text-white"
                    aria-label="Minimizar chat"
                  >
                    <ChevronDown size={17} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsChatVisible(false); setIsChatCollapsed(true) }}
                    className="shrink-0 rounded-lg p-1.5 text-white/85 transition-colors hover:bg-white/15 hover:text-white"
                    aria-label="Fechar assistente"
                  >
                    <X size={15} aria-hidden />
                  </button>
                </div>
              </div>
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-slate-50 p-4 dark:bg-slate-950/80">
                {chatHistory.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl p-3 text-xs font-medium ${
                        msg.role === 'user'
                          ? 'rounded-br-none bg-blue-600 text-white'
                          : 'rounded-bl-none border border-slate-100 bg-white text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                      }`}
                    >
                      {renderFormattedText(msg.content)}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex shrink-0 gap-2 border-t border-slate-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                <input
                  type="text"
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void handleChatSend()
                    }
                  }}
                  disabled={!geminiConfigured || isChatSending}
                  placeholder={geminiConfigured ? 'Perguntar sobre a frota…' : 'Configure a chave Gemini no .env'}
                  className="min-w-0 flex-1 rounded-xl border-none bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-900 outline-none ring-blue-500 focus:ring-2 disabled:opacity-60 dark:bg-slate-800 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => void handleChatSend()}
                  disabled={!geminiConfigured || isChatSending || !chatMessage.trim()}
                  className="rounded-xl bg-blue-600 p-2 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-700 dark:hover:bg-blue-600"
                  aria-label="Enviar mensagem"
                >
                  {isChatSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Modal confirmação de remoção */}
      {confirmDelete ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-4 flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-100 dark:bg-rose-950/50">
                <AlertCircle size={20} className="text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <p className="text-sm font-extrabold text-slate-900 dark:text-slate-100">Remover veículo</p>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Esta ação pode ser desfeita na aba Removidos.</p>
              </div>
            </div>
            <p className="mb-5 rounded-xl bg-slate-50 px-4 py-3 text-sm font-extrabold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {confirmDelete.placa}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-sm font-extrabold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmDelete()}
                className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-extrabold text-white hover:bg-rose-700"
              >
                Remover
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal confirmação de exclusão permanente */}
      {confirmHardDelete ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-4 flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-100 dark:bg-rose-950/50">
                <AlertCircle size={20} className="text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <p className="text-sm font-extrabold text-slate-900 dark:text-slate-100">Excluir permanentemente</p>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Esta ação não pode ser desfeita.</p>
              </div>
            </div>
            <p className="mb-5 rounded-xl bg-slate-50 px-4 py-3 text-sm font-extrabold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {confirmHardDelete.placa}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmHardDelete(null)}
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-sm font-extrabold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const { id, placa } = confirmHardDelete
                  setConfirmHardDelete(null)
                  void hardDeleteVehicle(id).then((r) => {
                    if (!r.ok) showNotification(r.message, 'error')
                    else { showNotification(`${placa} excluído permanentemente.`, 'success'); reloadFleet() }
                  })
                }}
                className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-extrabold text-white hover:bg-rose-700"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal importar Excel */}
      {importModalOpen && canRegisterVehicle ? (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          onClick={() => setImportModalOpen(false)}
        >
          <div
            className="flex w-full max-w-2xl flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet size={18} className="text-emerald-500" />
                <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100">Importar veículos via Excel</span>
              </div>
              <button type="button" onClick={() => setImportModalOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X size={16} />
              </button>
            </div>

            {/* Download template */}
            <div className="flex items-center justify-between rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
              <div>
                <p className="text-xs font-extrabold text-slate-700 dark:text-slate-200">Modelo de planilha</p>
                <p className="mt-0.5 text-[11px] font-semibold text-slate-400">Colunas: Placa, Tipo de Veículo, Modelo/Marca, Prefixo, Ano, Base, Supervisor, Gerência</p>
              </div>
              <button
                type="button"
                onClick={downloadImportTemplate}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-extrabold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:bg-slate-900 dark:text-emerald-400"
              >
                <Download size={14} />
                Baixar modelo
              </button>
            </div>

            {/* Upload */}
            <div>
              <input ref={importFileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportFile} />
              <button
                type="button"
                onClick={() => importFileRef.current?.click()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 py-4 text-sm font-extrabold text-slate-500 transition hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400"
              >
                <Upload size={18} />
                {importRows.length > 0 ? `${importRows.length} linha(s) carregada(s) — clique para trocar` : 'Selecionar arquivo .xlsx / .xls'}
              </button>
            </div>

            {/* Preview */}
            {importRows.length > 0 && !importResult && (
              <div className="max-h-52 overflow-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800">
                    <tr>
                      {['Placa','Tipo','Modelo','Prefixo','Ano','Base','Supervisor','Gerência'].map((h) => (
                        <th key={h} className="px-3 py-2 font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">{h}</th>
                      ))}
                      <th className="px-3 py-2 font-black uppercase tracking-wide text-slate-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {importRows.map((r, i) => (
                      <tr key={i} className={r._error ? 'bg-rose-50 dark:bg-rose-950/20' : ''}>
                        <td className="px-3 py-2 font-extrabold text-slate-900 dark:text-slate-100">{r.placa}</td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{r.tipo}</td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{r.modelo}</td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{r.prefixo}</td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{r.ano}</td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{r.base}</td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{r.supervisor}</td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{r.coordenador}</td>
                        <td className="px-3 py-2">
                          {r._error
                            ? <span className="font-extrabold text-rose-500">{r._error}</span>
                            : <span className="font-extrabold text-emerald-600">✓ OK</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Resultado */}
            {importResult && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900/40 dark:bg-emerald-950/30">
                <p className="text-sm font-extrabold text-emerald-700 dark:text-emerald-300">
                  ✓ {importResult.ok} veículo(s) importado(s) com sucesso
                  {importResult.skip > 0 && ` · ${importResult.skip} linha(s) ignorada(s)`}
                </p>
                {importResult.errors.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {importResult.errors.map((e, i) => (
                      <li key={i} className="text-xs font-semibold text-rose-600 dark:text-rose-400">{e}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-sm font-extrabold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                {importResult ? 'Fechar' : 'Cancelar'}
              </button>
              {!importResult && (
                <button
                  type="button"
                  onClick={() => void handleImportConfirm()}
                  disabled={importLoading || importRows.filter((r) => !r._error).length === 0}
                  className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-extrabold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {importLoading
                    ? <span className="inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin" />Importando...</span>
                    : `Importar ${importRows.filter((r) => !r._error).length} veículo(s)`}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
