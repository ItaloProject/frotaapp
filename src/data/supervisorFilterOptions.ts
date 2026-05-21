/** Opções fixas do filtro "Supervisor" (valor normalizado para comparação). */
export type SupervisorFilterSelectOption = { value: string; label: string }

function normSup(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

export function matchesSupervisorFilter(rowSupervisor: string, filterValue: string): boolean {
  if (filterValue === 'todos') return true
  return normSup(rowSupervisor).includes(normSup(filterValue))
}

export const SUPERVISOR_FILTER_SELECT_OPTIONS: SupervisorFilterSelectOption[] = [
  { value: 'todos',       label: 'Todos' },
  { value: 'Carlos Lima',    label: 'CARLOS LIMA' },
  { value: 'Diego Souza',    label: 'DIEGO SOUZA' },
  { value: 'Eduardo Nunes',  label: 'EDUARDO NUNES' },
  { value: 'Fabio Martins',  label: 'FABIO MARTINS' },
  { value: 'Gabriel Costa',  label: 'GABRIEL COSTA' },
  { value: 'Hugo Ferreira',  label: 'HUGO FERREIRA' },
  { value: 'Igor Pereira',   label: 'IGOR PEREIRA' },
  { value: 'Jonas Rocha',    label: 'JONAS ROCHA' },
  { value: 'Lucas Alves',    label: 'LUCAS ALVES' },
  { value: 'Marcos Dias',    label: 'MARCOS DIAS' },
  { value: 'Nelson Cunha',   label: 'NELSON CUNHA' },
  { value: 'Otavio Reis',    label: 'OTAVIO REIS' },
  { value: 'Paulo Borges',   label: 'PAULO BORGES' },
  { value: 'Rafael Teixeira', label: 'RAFAEL TEIXEIRA' },
  { value: 'Sergio Moura',   label: 'SERGIO MOURA' },
]
