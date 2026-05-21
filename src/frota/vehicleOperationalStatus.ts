import { TOTAL_VEHICLE_ROWS } from '../data/totalVehiclesFleet.gen'
import { FLEET_CATALOG_DESMOBILIZADO_PLACAS } from './fleetCatalogDesmobilizadoPlacas'

function normalizePlacaCatalogo(s: string): string {
  return s.trim().toUpperCase()
}

/** Cartões e total — cada placa em uma categoria; ATIVOS = operação ativa sem os prefixos Reserva/Transporte (estes têm cartão próprio). */
export const VEHICLE_OPERATIONAL_STATUS_LABELS = [
  'ATIVOS',
  'DESMOBILIZADO',
  'EM MOBILIZAÇÃO',
  'AGUARDANDO',
  'RESERVA',
  'TRANSPORTE',
  'AVARIADO',
] as const

export type VehicleOperationalStatus = (typeof VEHICLE_OPERATIONAL_STATUS_LABELS)[number]

const NOT_ACTIVE_OPERATIONAL_STATUS_SET = new Set<string>([
  'DESMOBILIZADO',
  'EM MOBILIZAÇÃO',
  'AGUARDANDO',
  'AVARIADO',
])

/** Prefixo normalizado para classificação operacional (planilha vazia → catálogo `N/A`). */
export function prefixoParaStatusOperacional(prefixo: string): string {
  const p = prefixo.trim().toUpperCase()
  if (!p || p === 'N/A') return ''
  return p
}

export function isVehicleOperacionalAtivo(prefixo: string): boolean {
  return !NOT_ACTIVE_OPERATIONAL_STATUS_SET.has(prefixoParaStatusOperacional(prefixo))
}

export function statusOperacionalCatalogo(placa: string, prefixoPlanilha: string): string {
  const p = normalizePlacaCatalogo(placa)
  if (p && FLEET_CATALOG_DESMOBILIZADO_PLACAS.has(p)) return 'DESMOBILIZADO'
  return prefixoParaStatusOperacional(prefixoPlanilha)
}

/** Classificação operacional considerando cadastro (INATIVO → DESMOBILIZADO). */
export function resolveStatusOperacional(
  placa: string,
  prefixoPlanilha: string,
  fleetStatus?: string,
): string {
  if (fleetStatus === 'INATIVO') return 'DESMOBILIZADO'
  return statusOperacionalCatalogo(placa, prefixoPlanilha)
}

/**
 * Critério do KPI «Total de veículos ativos» no dashboard / registo: soma operacional
 * equivalente às caixas ATIVOS ∪ TRANSPORTE (exclui Reserva e estados não ativos).
 */
export function isOperacionalAtivosDashboardKpi(
  placa: string,
  prefixoPlanilha: string,
  fleetStatus?: string,
): boolean {
  const op = resolveStatusOperacional(placa, prefixoPlanilha, fleetStatus)
  if (NOT_ACTIVE_OPERATIONAL_STATUS_SET.has(op)) return false
  return op !== 'RESERVA'
}

export function getVehicleOperationalStatusRows() {
  return TOTAL_VEHICLE_ROWS.map((row) => ({
    ...row,
    statusOperacional: statusOperacionalCatalogo(row.placa, row.prefixo),
  }))
}

/**
 * Versão que inclui veículos adicionados localmente pelo admin.
 * Usada pelo Dashboard e pelo Registro para manter o KPI sincronizado.
 */
export function getVehicleOperationalStatusRowsWithLocals(
  displayedVehicles: { placa: string; prefixo: string; base: string; status?: string }[],
) {
  return displayedVehicles.map((v) => ({
    placa: v.placa,
    prefixo: v.prefixo ?? '',
    base: v.base ?? '',
    processo: '',
    statusOperacional: resolveStatusOperacional(v.placa, v.prefixo ?? '', v.status),
  }))
}

export type VehicleOperationalStatusRow = ReturnType<typeof getVehicleOperationalStatusRows>[number]

export type VehicleOperationalStatusRowMin = Pick<VehicleOperationalStatusRow, 'placa' | 'prefixo' | 'base' | 'processo' | 'statusOperacional'>

export function getVehicleOperationalStatusSummary(rowsParam?: VehicleOperationalStatusRowMin[]) {
  const rows = rowsParam ?? getVehicleOperationalStatusRows()
  return VEHICLE_OPERATIONAL_STATUS_LABELS.map((label) => {
    const vehicles =
      label === 'ATIVOS'
        ? rows.filter(
            (row) =>
              !NOT_ACTIVE_OPERATIONAL_STATUS_SET.has(row.statusOperacional) &&
              row.statusOperacional !== 'RESERVA' &&
              row.statusOperacional !== 'TRANSPORTE',
          )
        : rows.filter((row) => row.statusOperacional === label)

    return {
      label,
      count: vehicles.length,
      vehicles,
    }
  })
}
