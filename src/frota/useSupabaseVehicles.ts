import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  type FleetVehicle,
  type AddFleetVehicleInput,
  type VehicleStatus,
  type VehicleTipo,
  normalizePlaca,
  VEHICLE_TYPE_IDS,
} from './vehicleRegistry'

type SupabaseVehicleRow = {
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
  em_manutencao: boolean
  created_at: string
  deleted_at: string | null
}

function rowToFleetVehicle(r: SupabaseVehicleRow): FleetVehicle {
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
    status: r.status === 'INATIVO' ? 'INATIVO' : 'ATIVO',
    emManutencao: r.em_manutencao ?? false,
    ano: r.ano || '',
    createdAt: r.created_at,
    source: 'local',
  }
}

export type SaveVehicleInput = AddFleetVehicleInput & { status?: VehicleStatus }

export type DeletedFleetVehicle = FleetVehicle & { deletedAt: string }

export type UseSupabaseVehiclesResult = {
  vehicles: FleetVehicle[]
  deletedVehicles: DeletedFleetVehicle[]
  loading: boolean
  reload: () => void
  saveVehicle: (input: SaveVehicleInput, editId?: string) => Promise<{ ok: true } | { ok: false; message: string }>
  softDeleteVehicle: (id: string) => Promise<{ ok: true } | { ok: false; message: string }>
  restoreVehicle: (id: string) => Promise<{ ok: true } | { ok: false; message: string }>
  hardDeleteVehicle: (id: string) => Promise<{ ok: true } | { ok: false; message: string }>
  setManutencao: (id: string, emManutencao: boolean) => Promise<{ ok: true } | { ok: false; message: string }>
  setStatus: (id: string, status: VehicleStatus) => Promise<{ ok: true } | { ok: false; message: string }>
}

export function useSupabaseVehicles(): UseSupabaseVehiclesResult {
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([])
  const [deletedVehicles, setDeletedVehicles] = useState<DeletedFleetVehicle[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [activeRes, deletedRes] = await Promise.all([
      supabase.from('vehicles').select('*').is('deleted_at', null).order('placa', { ascending: true }),
      supabase.from('vehicles').select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
    ])

    if (!activeRes.error && activeRes.data) {
      setVehicles((activeRes.data as SupabaseVehicleRow[]).map(rowToFleetVehicle))
    }
    if (!deletedRes.error && deletedRes.data) {
      setDeletedVehicles(
        (deletedRes.data as SupabaseVehicleRow[]).map((r) => ({
          ...rowToFleetVehicle(r),
          deletedAt: r.deleted_at ?? '',
        }))
      )
    }
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const reload = useCallback(() => { void load() }, [load])

  const saveVehicle = useCallback(async (
    input: SaveVehicleInput,
    editId?: string,
  ): Promise<{ ok: true } | { ok: false; message: string }> => {
    const placa = normalizePlaca(input.placa)
    if (!placa) return { ok: false, message: 'Informe a placa.' }
    const modelo = input.modelo.trim()
    if (!modelo) return { ok: false, message: 'Informe o modelo / marca.' }

    const row = {
      placa,
      modelo: modelo.toUpperCase(),
      tipo: input.tipo,
      prefixo: input.prefixo.trim().toUpperCase() || 'N/A',
      responsavel: input.responsavel.trim().toUpperCase() || 'NÃO ATRIBUÍDO',
      supervisor: input.supervisor.trim().toUpperCase() || 'NÃO ATRIBUÍDO',
      coordenador: input.coordenador.trim().toUpperCase() || 'NÃO ATRIBUÍDO',
      base: input.base.trim().toUpperCase() || 'N/A',
      ano: input.ano.trim() || new Date().getFullYear().toString(),
      status: input.status ?? 'ATIVO',
    }

    if (editId) {
      const { error } = await supabase.from('vehicles').update(row).eq('id', editId)
      if (error) return { ok: false, message: error.message }
    } else {
      const { error } = await supabase.from('vehicles').insert(row)
      if (error) {
        if (error.code === '23505') return { ok: false, message: 'Já existe um veículo com esta placa.' }
        return { ok: false, message: error.message }
      }
    }

    await load()
    return { ok: true }
  }, [load])

  const softDeleteVehicle = useCallback(async (id: string): Promise<{ ok: true } | { ok: false; message: string }> => {
    const { error } = await supabase
      .from('vehicles')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return { ok: false, message: error.message }
    await load()
    return { ok: true }
  }, [load])

  const restoreVehicle = useCallback(async (id: string): Promise<{ ok: true } | { ok: false; message: string }> => {
    const { error } = await supabase
      .from('vehicles')
      .update({ deleted_at: null })
      .eq('id', id)
    if (error) return { ok: false, message: error.message }
    await load()
    return { ok: true }
  }, [load])

  const hardDeleteVehicle = useCallback(async (id: string): Promise<{ ok: true } | { ok: false; message: string }> => {
    const { error } = await supabase.from('vehicles').delete().eq('id', id)
    if (error) return { ok: false, message: error.message }
    await load()
    return { ok: true }
  }, [load])

  const setManutencao = useCallback(async (id: string, emManutencao: boolean): Promise<{ ok: true } | { ok: false; message: string }> => {
    const { error } = await supabase.from('vehicles').update({ em_manutencao: emManutencao }).eq('id', id)
    if (error) return { ok: false, message: error.message }
    setVehicles((prev) => prev.map((v) => v.id === id ? { ...v, emManutencao } : v))
    return { ok: true }
  }, [])

  const setStatus = useCallback(async (id: string, status: VehicleStatus): Promise<{ ok: true } | { ok: false; message: string }> => {
    const { error } = await supabase.from('vehicles').update({ status }).eq('id', id)
    if (error) return { ok: false, message: error.message }
    setVehicles((prev) => prev.map((v) => v.id === id ? { ...v, status } : v))
    return { ok: true }
  }, [])

  return { vehicles, deletedVehicles, loading, reload, saveVehicle, softDeleteVehicle, restoreVehicle, hardDeleteVehicle, setManutencao, setStatus }
}
