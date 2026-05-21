/** Opções fixas do filtro "Processo" (valor em minúsculas para comparação). */
export type ProcessoFilterSelectOption = { value: string; label: string }

export const PROCESSO_FILTER_SELECT_OPTIONS: ProcessoFilterSelectOption[] = [
  { value: 'todos',       label: 'Todos' },
  { value: 'proc-a',      label: 'PROC-A' },
  { value: 'proc-b',      label: 'PROC-B' },
  { value: 'proc-c',      label: 'PROC-C' },
  { value: 'proc-d',      label: 'PROC-D' },
  { value: 'proc-e',      label: 'PROC-E' },
  { value: 'adm',         label: 'ADM' },
  { value: 'frota',       label: 'FROTA' },
]

export function matchesProcessoFilter(rowProcesso: string, filterValue: string): boolean {
  if (filterValue === 'todos') return true
  return rowProcesso.trim().toLowerCase() === filterValue.trim().toLowerCase()
}
