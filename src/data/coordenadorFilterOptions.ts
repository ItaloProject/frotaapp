/** Opções fixas do filtro "Gerência" (valor normalizado em minúsculas, sem acento, para comparação). */
export type CoordenadorFilterSelectOption = { value: string; label: string }

function normCoord(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

/** Compara nome da gerência no registro com o valor selecionado (ignora maiúsculas e acentos). */
export function matchesCoordenadorFilter(rowCoord: string, filterValue: string): boolean {
  if (filterValue === 'todos') return true
  return normCoord(rowCoord) === normCoord(filterValue)
}

export const COORDENADOR_FILTER_SELECT_OPTIONS: CoordenadorFilterSelectOption[] = [
  { value: 'todos',       label: 'Todos' },
  { value: 'frota',       label: 'FROTA' },
  { value: 'coord-a',     label: 'COORD-A' },
  { value: 'coord-b',     label: 'COORD-B' },
  { value: 'coord-c',     label: 'COORD-C' },
  { value: 'coord-d',     label: 'COORD-D' },
  { value: 'coord-e',     label: 'COORD-E' },
  { value: 'coord-f',     label: 'COORD-F' },
  { value: 'coord-g',     label: 'COORD-G' },
  { value: 'coord-h',     label: 'COORD-H' },
  { value: 'coord-i',     label: 'COORD-I' },
  { value: 'coord-j',     label: 'COORD-J' },
  { value: 'coord-k',     label: 'COORD-K' },
]
