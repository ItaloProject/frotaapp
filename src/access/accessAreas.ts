/** Rótulos alinhados ao vocabulário operacional da frota (exibição no registo e filtros). */
export const ACCESS_AREA_OPTIONS = [
  { value: 'TODAS', label: 'Todas' },
  { value: 'SKY', label: 'Cesto Aéreo (Sky)' },
  { value: 'MUNK', label: 'MUNK' },
  { value: 'MOTO', label: 'MOTO' },
  { value: 'PICAPE_4X4', label: 'PICAPE 4X4' },
  { value: 'PICAPE_LEVE', label: 'PICAPE LEVE' },
  { value: 'VEICULOS_LEVES', label: 'VEICULOS LEVES' },
] as const

export type AccessArea = (typeof ACCESS_AREA_OPTIONS)[number]['value']

export function labelForArea(area: AccessArea): string {
  return ACCESS_AREA_OPTIONS.find((o) => o.value === area)?.label ?? area
}

export function isAccessArea(value: string): value is AccessArea {
  return ACCESS_AREA_OPTIONS.some((o) => o.value === value)
}
