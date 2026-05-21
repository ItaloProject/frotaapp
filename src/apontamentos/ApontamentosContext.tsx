import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { supabase, type HistoricoRow } from '../lib/supabase'
import { SCHEMA_MAP } from '../data/checklistSchemas'
import {
  apontamentoVeiculoIdFromPlaca,
  formatPlaca,
  normalizePlaca,
  resolveFleetPlacaFromDadosVeiculo,
  getDisplayedFleetVehicles,
} from '../frota/vehicleRegistry'

// ---------------------------------------------------------------------------
// Tipo público
// ---------------------------------------------------------------------------
export type Apontamento = {
  id: string           // `${checklistId}__${itemId}`
  checklistId: string
  ncItemId: string
  veiculoId: string
  placa: string
  modelo: string
  veiculoLabel: string
  prefixo: string
  defeito: string
  dataApontamento: string
  horaApontamento: string
  prazo: string | null
  resolvido: boolean
  dataResolvido: string | null
  horaResolvido: string | null
  reparoValor: number | null
  reparoDescricao: string | null
  reparoImagens: string[]
  osArquivo: string | null
  processo: string
  base: string
  coordenador: string
  responsavel: string
  ncFotos: string[]
  problemasAdicionais: string
  descricaoProblema: string
  /** Item 🚫 impeditivo no checklist — NC impede condução. */
  imperativo: boolean
  justificado: boolean
  justificativa: string | null
  justificativaData: string | null
  justificativaImagem: string | null
  agendamentoData: string | null
}

export type NovoApontamento = Omit<
  Apontamento,
  'id' | 'resolvido' | 'dataResolvido' | 'horaResolvido' | 'reparoValor' | 'reparoDescricao' | 'reparoImagens' | 'osArquivo'
>

// ---------------------------------------------------------------------------
// Resolução armazenada na tabela `apontamentos`
// ---------------------------------------------------------------------------
type Resolucao = {
  id: string          // `${checklistId}__${itemId}`
  resolvido: boolean
  dataResolvido: string | null
  horaResolvido: string | null
  reparoValor: number | null
  reparoDescricao: string | null
  reparoImagens: string[]
  osArquivo: string | null
  justificado: boolean
  justificativa: string | null
  justificativaData: string | null
  justificativaImagem: string | null
  agendamentoData: string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToResolucao(r: any): Resolucao {
  return {
    id:                  r.id,
    resolvido:           Boolean(r.resolvido),
    dataResolvido:       r.data_resolvido      ?? null,
    horaResolvido:       r.hora_resolvido      ?? null,
    reparoValor:         r.reparo_valor        != null ? Number(r.reparo_valor) : null,
    reparoDescricao:     r.reparo_descricao    ?? null,
    reparoImagens:       Array.isArray(r.reparo_imagens) ? r.reparo_imagens : [],
    osArquivo:           r.os_arquivo          ?? null,
    justificado:         Boolean(r.justificado),
    justificativa:       r.justificativa        ?? null,
    justificativaData:   r.justificativa_data   ?? null,
    justificativaImagem: r.justificativa_imagem ?? null,
    agendamentoData:     r.agendamento_data     ?? null,
  }
}

// ---------------------------------------------------------------------------
// Mapa placa → veículo (lazy, reconstruído quando necessário)
// ---------------------------------------------------------------------------
function buildVehicleMap(): Map<string, { coordenador: string; responsavel: string; processo: string; base: string }> {
  const map = new Map<string, { coordenador: string; responsavel: string; processo: string; base: string }>()
  for (const v of getDisplayedFleetVehicles()) {
    const p = normalizePlaca(v.placa)
    if (!p) continue
    map.set(p, { coordenador: v.coordenador, responsavel: v.supervisor, processo: v.tipo, base: v.base })
  }
  return map
}

// ---------------------------------------------------------------------------
// Converte checklist + item NC → Apontamento
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function checklistItemToApontamento(cl: any, itemId: string, resolucoes: Map<string, Resolucao>, vehicleMap: Map<string, { coordenador: string; responsavel: string; processo: string; base: string }>): Apontamento {
  const id = `${cl.id}__${itemId}`
  const dv = cl.dados_veiculo ?? {}
  const placa   = resolveFleetPlacaFromDadosVeiculo(dv)
  const prefixo = (dv.prefixo ?? '').trim()
  const schema  = SCHEMA_MAP[cl.tipo as string]
  const item    = schema?.grupos.flatMap((g) => g.itens).find((i) => i.id === itemId)
  const label   = item?.label ?? itemId

  // Fotos NC do item (extraídas do campo observacoes com marcador __fotos__)
  const obsRaw: string = cl.observacoes?.[itemId] ?? ''
  const fotosMarker = '__fotos__:'
  const fotosIdx = obsRaw.indexOf(fotosMarker)
  const ncFotos = fotosIdx >= 0
    ? obsRaw.slice(fotosIdx + fotosMarker.length).split('|').filter(Boolean)
    : []

  const res = resolucoes.get(id)

  // Prazo: data_apontamento + 7 dias
  const dp = new Date(cl.data_inspecao + 'T12:00:00')
  dp.setDate(dp.getDate() + 7)
  const prazo = dp.toISOString().slice(0, 10)

  return {
    id,
    checklistId:     cl.id,
    ncItemId:        itemId,
    veiculoId:       apontamentoVeiculoIdFromPlaca(placa),
    placa,
    modelo:          (dv.marca_modelo ?? '').trim(),
    veiculoLabel:    prefixo && placa ? `${prefixo} · ${formatPlaca(placa)}` : formatPlaca(placa) || cl.nome_operador,
    prefixo,
    defeito:         label,
    dataApontamento: cl.data_inspecao,
    horaApontamento: cl.created_at ? new Date(cl.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '',
    prazo,
    resolvido:       res?.resolvido       ?? false,
    dataResolvido:   res?.dataResolvido   ?? null,
    horaResolvido:   res?.horaResolvido   ?? null,
    reparoValor:     res?.reparoValor     ?? null,
    reparoDescricao: res?.reparoDescricao ?? null,
    reparoImagens:   res?.reparoImagens   ?? [],
    osArquivo:           res?.osArquivo           ?? null,
    justificado:         res?.justificado         ?? false,
    justificativa:       res?.justificativa       ?? null,
    justificativaData:   res?.justificativaData   ?? null,
    justificativaImagem: res?.justificativaImagem ?? null,
    agendamentoData:     res?.agendamentoData     ?? null,
    processo:             vehicleMap.get(placa)?.processo ?? 'Checklist',
    base:                 vehicleMap.get(placa)?.base || (dv.localidade ?? ''),
    coordenador:          vehicleMap.get(placa)?.coordenador ?? cl.nome_supervisor ?? '',
    responsavel:          vehicleMap.get(placa)?.responsavel ?? cl.nome_operador,
    ncFotos,
    problemasAdicionais:  cl.problemas ?? '',
    descricaoProblema:    cl.descricao_problema ?? '',
    imperativo:           item?.imperativo === true,
  }
}

// ---------------------------------------------------------------------------
// Helpers de data local
// ---------------------------------------------------------------------------
function localIsoDate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function localTimeHHmm(d: Date) {
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

// ---------------------------------------------------------------------------
// Contexto
// ---------------------------------------------------------------------------
type Ctx = {
  rows: Apontamento[]
  /** Total de registros na tabela `checklists` com inspeção concluída (`progresso` = 100). */
  checklistsRealizadosTotal: number
  carregando: boolean
  marcarResolvido: (
    id: string,
    payload?: { valor: number | null; descricao: string | null; imagens: string[]; osArquivo?: string | null; dataResolvido?: string | null },
    usuarioEmail?: string,
  ) => Promise<void>
  marcarJustificado: (
    id: string,
    payload: { justificativa: string; data: string; imagem: string | null; agendamentoData: string | null },
    usuarioEmail?: string,
  ) => Promise<void>
  buscarHistorico: (apontamentoId: string) => Promise<HistoricoRow[]>
  hasByChecklist: (checklistId: string, ncItemId: string) => boolean
  persistError: string | null
  clearPersistError: () => void
  recarregar: () => Promise<void>
}

const ApontamentosContext = createContext<Ctx | null>(null)

export function ApontamentosProvider({ children }: { children: ReactNode }) {
  const [rows, setRows]               = useState<Apontamento[]>([])
  const [checklistsRealizadosTotal, setChecklistsRealizadosTotal] = useState(0)
  const [carregando, setCarregando]   = useState(true)
  const [persistError, setPersistError] = useState<string | null>(null)
  const clearPersistError = useCallback(() => setPersistError(null), [])
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const recarregar = useCallback(async () => {
    setCarregando(true)
    localStorage.removeItem('frota-apontamentos-v1')

    // Modo demo: retorna dados fictícios sem acesso ao Supabase
    const { MOCK_APONTAMENTOS, MOCK_CHECKLISTS_REALIZADOS_TOTAL } = await import('./mockData')
    setRows(MOCK_APONTAMENTOS)
    setChecklistsRealizadosTotal(MOCK_CHECKLISTS_REALIZADOS_TOTAL)
    setPersistError(null)
    setCarregando(false)
    return

    // 1. Total de checklists concluídos (mesmo critério do formulário: progresso 100)
    // eslint-disable-next-line no-unreachable
    const { count: totalRealizados, error: countError } = await supabase
      .from('checklists')
      .select('id', { count: 'exact', head: true })
      .eq('progresso', 100)
    setChecklistsRealizadosTotal(countError ? 0 : (totalRealizados ?? 0))

    // 2. Checklists concluídos — filtra itens NC nas respostas (nc_count pode estar desatualizado).
    const fetchAllNc = async () => {
      const all: unknown[] = []
      let from = 0
      const pageSize = 1000
      while (true) {
        const { data, error } = await supabase
          .from('checklists')
          .select('id, tipo, nome_operador, nome_supervisor, data_inspecao, created_at, dados_veiculo, respostas, observacoes')
          .eq('progresso', 100)
          .order('data_inspecao', { ascending: true })
          .range(from, from + pageSize - 1)
        if (error) return { data: null, error }
        if (data) all.push(...data)
        if (!data || data.length < pageSize) break
        from += pageSize
      }
      return { data: all, error: null }
    }

    const { data: clData, error: clError } = await fetchAllNc()

    if (clError) {
      setPersistError('Erro ao carregar checklists: ' + clError.message)
      setCarregando(false)
      return
    }

    // 3. Busca resoluções da tabela apontamentos
    const { data: resData } = await supabase
      .from('apontamentos')
      .select('id, resolvido, data_resolvido, hora_resolvido, reparo_valor, reparo_descricao, reparo_imagens, os_arquivo, justificado, justificativa, justificativa_data, justificativa_imagem, agendamento_data')

    const resolucoes = new Map<string, Resolucao>(
      ((resData ?? []) as unknown[]).map((r) => {
        const res = rowToResolucao(r)
        return [res.id, res]
      })
    )

    // 4. Expande cada checklist em um apontamento por item NC
    //    Só gera apontamentos para checklists que realmente têm respostas 'nc'.
    const vehicleMap = buildVehicleMap()
    const apontamentos: Apontamento[] = []
    for (const cl of (clData ?? []) as unknown[]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const checklist = cl as any
      const respostas: Record<string, string> = checklist.respostas ?? {}
      const ncItems = Object.entries(respostas).filter(([, v]) => v === 'nc')
      if (ncItems.length === 0) continue
      for (const [itemId] of ncItems) {
        apontamentos.push(checklistItemToApontamento(checklist, itemId, resolucoes, vehicleMap))
      }
    }

    setRows(apontamentos)
    setPersistError(null)
    setCarregando(false)
  }, [])

  useEffect(() => {
    queueMicrotask(() => {
      void recarregar()
    })

    const MAX_BACKOFF_MS = 30_000
    let destroyed = false

    const subscribe = () => {
      if (destroyed) return
      const prev = channelRef.current
      channelRef.current = null
      if (prev) void supabase.removeChannel(prev)

      const channelName = `apontamentos-changes-${Date.now()}`
      const scheduleRecarregar = () => {
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = setTimeout(() => { void recarregar() }, 500)
      }

      const ch = supabase
        .channel(channelName)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'apontamentos' }, scheduleRecarregar)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'checklists' }, scheduleRecarregar)
        .subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            reconnectAttemptsRef.current = 0
          }
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            if (destroyed) return
            const attempts = ++reconnectAttemptsRef.current
            const delay = Math.min(1_000 * 2 ** attempts, MAX_BACKOFF_MS)
            if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
            reconnectTimerRef.current = setTimeout(() => {
              void recarregar()
              subscribe()
            }, delay)
          }
        })

      channelRef.current = ch
    }

    subscribe()

    return () => {
      destroyed = true
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      if (channelRef.current) void supabase.removeChannel(channelRef.current)
    }
  }, [recarregar])

  const marcarResolvido = useCallback(async (
    id: string,
    payload?: { valor: number | null; descricao: string | null; imagens: string[]; osArquivo?: string | null; dataResolvido?: string | null },
    usuarioEmail = 'desconhecido',
  ) => {
    const now = new Date()
    const hoje = localIsoDate(now)
    const dataResolvido = payload?.dataResolvido || hoje
    const hora = localTimeHHmm(now)

    // Atualiza localmente de imediato
    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              resolvido: true,
              dataResolvido,
              horaResolvido: hora,
              reparoValor:     payload?.valor ?? r.reparoValor ?? null,
              reparoDescricao: typeof payload?.descricao === 'string' ? payload.descricao : r.reparoDescricao ?? null,
              reparoImagens:   payload?.imagens?.slice(0, 3) ?? r.reparoImagens ?? [],
              osArquivo:       payload?.osArquivo !== undefined ? payload.osArquivo : r.osArquivo ?? null,
            }
          : r,
      ),
    )

    // Upsert na tabela apontamentos (resolução)
    const row = rows.find((r) => r.id === id)
    const { error } = await supabase
      .from('apontamentos')
      .upsert({
        id,
        veiculo_id:       row?.veiculoId      ?? '',
        veiculo_label:    row?.veiculoLabel   ?? '',
        prefixo:          row?.prefixo        ?? '',
        defeito:          row?.defeito        ?? '',
        data_apontamento: row?.dataApontamento ?? hoje,
        prazo:            row?.prazo          ?? hoje,
        resolvido:        true,
        data_resolvido:   dataResolvido,
        hora_resolvido:   hora,
        reparo_valor:     payload?.valor ?? null,
        reparo_descricao: payload?.descricao ?? null,
        reparo_imagens:   payload?.imagens?.slice(0, 3) ?? [],
        os_arquivo:       payload?.osArquivo ?? null,
        processo:         row?.processo ?? 'Checklist',
        base:             row?.base ?? '',
        coordenador:      row?.coordenador ?? '',
        responsavel:      row?.responsavel ?? '',
        checklist_id:     row?.checklistId ?? null,
        nc_item_id:       row?.ncItemId ?? null,
        nc_fotos:         row?.ncFotos ?? [],
      })

    if (error) {
      setPersistError('Erro ao salvar resolução: ' + error.message)
      void recarregar()
      return
    }

    // Grava no histórico
    await supabase.from('apontamento_historico').insert({
      apontamento_id:  id,
      acao:            'resolvido',
      usuario_email:   usuarioEmail,
      data_hora:       `${dataResolvido}T${hora}:00`,
      descricao:       payload?.descricao ?? null,
      reparo_valor:    payload?.valor ?? null,
      reparo_descricao: payload?.descricao ?? null,
    })
  }, [rows, recarregar])

  const marcarJustificado = useCallback(async (
    id: string,
    payload: { justificativa: string; data: string; imagem: string | null; agendamentoData: string | null },
    usuarioEmail = 'desconhecido',
  ) => {
    const now = new Date()
    const hora = localTimeHHmm(now)

    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              justificado:         true,
              justificativa:       payload.justificativa,
              justificativaData:   payload.data,
              justificativaImagem: payload.imagem,
              agendamentoData:     payload.agendamentoData,
            }
          : r,
      ),
    )

    const row = rows.find((r) => r.id === id)
    const { error } = await supabase
      .from('apontamentos')
      .upsert({
        id,
        veiculo_id:           row?.veiculoId      ?? '',
        veiculo_label:        row?.veiculoLabel   ?? '',
        prefixo:              row?.prefixo        ?? '',
        defeito:              row?.defeito        ?? '',
        data_apontamento:     row?.dataApontamento ?? payload.data,
        prazo:                row?.prazo          ?? payload.data,
        resolvido:            false,
        justificado:          true,
        justificativa:        payload.justificativa,
        justificativa_data:   payload.data,
        justificativa_imagem: payload.imagem,
        agendamento_data:     payload.agendamentoData,
        processo:             row?.processo ?? 'Checklist',
        base:                 row?.base ?? '',
        coordenador:          row?.coordenador ?? '',
        responsavel:          row?.responsavel ?? '',
        checklist_id:         row?.checklistId ?? null,
        nc_item_id:           row?.ncItemId ?? null,
        nc_fotos:             row?.ncFotos ?? [],
      })

    if (error) {
      setPersistError('Erro ao salvar justificativa: ' + error.message)
      await recarregar()
      return
    }

    const descHistorico = payload.agendamentoData
      ? `Justificativa: ${payload.justificativa} | Agendado para: ${payload.agendamentoData}`
      : `Justificativa: ${payload.justificativa}`

    await supabase.from('apontamento_historico').insert({
      apontamento_id:   id,
      acao:             'editado',
      usuario_email:    usuarioEmail,
      data_hora:        `${payload.data}T${hora}:00`,
      descricao:        descHistorico,
      reparo_valor:     null,
      reparo_descricao: null,
    })
  }, [rows, recarregar])

  const buscarHistorico = useCallback(async (apontamentoId: string): Promise<HistoricoRow[]> => {
    const { data } = await supabase
      .from('apontamento_historico')
      .select('*')
      .eq('apontamento_id', apontamentoId)
      .order('data_hora', { ascending: false })
    return (data ?? []) as HistoricoRow[]
  }, [])

  const hasByChecklist = useCallback((checklistId: string, ncItemId: string): boolean => {
    return rows.some((r) => r.checklistId === checklistId && r.ncItemId === ncItemId && r.resolvido)
  }, [rows])

  const value = useMemo(
    () => ({
      rows,
      checklistsRealizadosTotal,
      carregando,
      marcarResolvido,
      marcarJustificado,
      buscarHistorico,
      hasByChecklist,
      persistError,
      clearPersistError,
      recarregar,
    }),
    [rows, checklistsRealizadosTotal, carregando, marcarResolvido, marcarJustificado, buscarHistorico, hasByChecklist, persistError, clearPersistError, recarregar],
  )

  return <ApontamentosContext.Provider value={value}>{children}</ApontamentosContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components -- hook exposto junto ao provider
export function useApontamentos() {
  const ctx = useContext(ApontamentosContext)
  if (!ctx) throw new Error('useApontamentos deve ser usado dentro de ApontamentosProvider')
  return ctx
}
