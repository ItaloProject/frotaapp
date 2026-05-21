import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import {
  getDisplayedFleetVehicles,
  normalizePlaca,
  type FleetVehicle,
  type VehicleStatus,
  VEHICLE_TYPE_IDS,
  type VehicleTipo,
} from './vehicleRegistry'

// ── Supabase row → FleetVehicle ───────────────────────────────────────────

type SupabaseRow = {
  id: string
  placa: string
  modelo: string
  tipo: string
  prefixo: string
  responsavel: string
  supervisor: string
  coordenador: string
  base: string
  ano: string
  status: string
  created_at: string
  deleted_at: string | null
}

function rowToVehicle(r: SupabaseRow): FleetVehicle {
  const tipo = VEHICLE_TYPE_IDS.includes(r.tipo as VehicleTipo)
    ? (r.tipo as VehicleTipo)
    : 'VEICULOS LEVES'
  return {
    id: r.id,
    placa: normalizePlaca(r.placa),
    modelo: r.modelo || '—',
    tipo,
    prefixo: r.prefixo || 'N/A',
    responsavel: r.responsavel || 'NÃO ATRIBUÍDO',
    supervisor: r.supervisor || 'NÃO ATRIBUÍDO',
    coordenador: r.coordenador || 'NÃO ATRIBUÍDO',
    base: r.base || 'N/A',
    status: (r.status === 'INATIVO' ? 'INATIVO' : 'ATIVO') as VehicleStatus,
    emManutencao: false,
    ano: r.ano || '',
    createdAt: r.created_at,
    source: 'local' as const,
  }
}

// ── contexto ──────────────────────────────────────────────────────────────

type FleetContextValue = {
  /** Frota completa: Supabase tem precedência, catálogo embebido preenche o restante. */
  vehicles: FleetVehicle[]
  loading: boolean
  /** Força re-fetch do Supabase. */
  reload: () => void
}

const FleetContext = createContext<FleetContextValue>({
  vehicles: [],
  loading: true,
  reload: () => undefined,
})

export function FleetProvider({ children }: { children: ReactNode }) {
  const [supabaseVehicles, setSupabaseVehicles] = useState<FleetVehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    setLoading(true)
    void supabase
      .from('vehicles')
      .select('*')
      .is('deleted_at', null)
      .order('placa', { ascending: true })
      .then(({ data }: { data: SupabaseRow[] | null }) => {
        setSupabaseVehicles((data ?? []).map((r) => rowToVehicle(r)))
        setLoading(false)
      })
  }, [tick])

  const reload = () => setTick((t) => t + 1)

  // Supabase prevalece; catálogo embebido preenche placas ausentes no Supabase
  const vehicles = useMemo(() => {
    const supaPlacas = new Set(supabaseVehicles.map((v) => v.placa))
    const embedded = getDisplayedFleetVehicles().filter((v) => !supaPlacas.has(v.placa))
    return [...supabaseVehicles, ...embedded].sort((a, b) => a.placa.localeCompare(b.placa))
  }, [supabaseVehicles])

  return (
    <FleetContext.Provider value={{ vehicles, loading, reload }}>
      {children}
    </FleetContext.Provider>
  )
}

export function useFleet(): FleetContextValue {
  return useContext(FleetContext)
}
