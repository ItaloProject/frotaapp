/** Opções fixas do filtro "Base" em todo o app (valor em minúsculas para comparação). */
export type BaseFilterSelectOption = { value: string; label: string }

export const BASE_FILTER_SELECT_OPTIONS: BaseFilterSelectOption[] = [
  { value: 'todos',   label: 'Todos' },
  { value: 'base-a',  label: 'BASE-A' },
  { value: 'base-b',  label: 'BASE-B' },
  { value: 'base-c',  label: 'BASE-C' },
  { value: 'base-d',  label: 'BASE-D' },
  { value: 'base-e',  label: 'BASE-E' },
  { value: 'base-f',  label: 'BASE-F' },
]

/** Mesmas opções; no dashboard o atalho usa o rótulo "Todas as bases". */
export const BASE_DASHBOARD_QUICK_SELECT_OPTIONS: BaseFilterSelectOption[] = [
  { value: 'todos', label: 'Todas as bases' },
  ...BASE_FILTER_SELECT_OPTIONS.filter((o) => o.value !== 'todos'),
]

/** Compara `dados_veiculo.localidade` / campo base do apontamento com o valor do filtro. */
export function matchesBaseFilter(rowBase: string, filterValue: string): boolean {
  if (filterValue === 'todos') return true
  return rowBase.trim().toLowerCase() === filterValue.trim().toLowerCase()
}
